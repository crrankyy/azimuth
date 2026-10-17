import { describe, expect, it } from "vitest";
import {
  inlineYaml,
  parseFrontmatter,
  splitFrontmatter,
  updateFrontmatter,
} from "../../src/core/frontmatter";

const FEATURE = `---
id: F-005
title: Retry with exponential backoff # trailing comment
status: draft
depends_on:
  - F-003
  - F-002
approved_at: null
approved_commit: 4e12345
tags: [delivery, reliability]
---
# F-005: Retry

## Objective
Body text that must never change.
`;

function diffLines(a: string, b: string): string[] {
  const al = a.split("\n");
  const bl = b.split("\n");
  const out: string[] = [];
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) out.push(`${i + 1}: ${al[i] ?? ""} -> ${bl[i] ?? ""}`);
  }
  return out;
}

describe("splitFrontmatter", () => {
  it("separates YAML from the body and reports the body line", () => {
    const parts = splitFrontmatter(FEATURE);
    expect(parts.yaml?.startsWith("id: F-005")).toBe(true);
    expect(parts.body.startsWith("# F-005: Retry")).toBe(true);
    expect(parts.bodyLine).toBe(12);
  });

  it("treats a file without fences as body only", () => {
    const parts = splitFrontmatter("# Just a title\n");
    expect(parts.yaml).toBeNull();
    expect(parts.body).toBe("# Just a title\n");
  });
});

describe("parseFrontmatter", () => {
  it("parses data, keeps short SHAs as strings and records key lines", () => {
    const parsed = parseFrontmatter(FEATURE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.depends_on).toEqual(["F-003", "F-002"]);
    expect(parsed.data.approved_commit).toBe("4e12345");
    expect(parsed.data.approved_at).toBeNull();
    expect(parsed.keyLines.status).toBe(4);
    expect(parsed.keyLines.tags).toBe(10);
  });

  it("reports YAML errors with file line numbers", () => {
    const parsed = parseFrontmatter("---\nid: Q-0001\nbad: [unclosed\n---\nbody\n");
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0]?.line).toBeGreaterThanOrEqual(3);
  });
});

describe("updateFrontmatter", () => {
  it("is a no-op for an empty update", () => {
    expect(updateFrontmatter(FEATURE, {})).toBe(FEATURE);
  });

  it("changes exactly one line for a scalar edit", () => {
    const out = updateFrontmatter(FEATURE, { status: "approved" });
    expect(diffLines(FEATURE, out)).toEqual(["4: status: draft -> status: approved"]);
  });

  it("keeps trailing comments when replacing a scalar", () => {
    const out = updateFrontmatter(FEATURE, { title: "Retry: with backoff" });
    expect(out).toContain("# trailing comment");
    expect(parseFrontmatter(out).data.title).toBe("Retry: with backoff");
  });

  it("quotes values that would otherwise change type", () => {
    const out = updateFrontmatter(FEATURE, {
      approved_commit: "4e99999",
      approved_at: "2026-10-09",
    });
    expect(parseFrontmatter(out).data.approved_commit).toBe("4e99999");
    expect(parseFrontmatter(out).data.approved_at).toBe("2026-10-09");
  });

  it("rewrites a block list as one flow line", () => {
    const out = updateFrontmatter(FEATURE, { depends_on: ["F-001"] });
    expect(out).toContain("depends_on: [F-001]\napproved_at: null");
    expect(parseFrontmatter(out).data.depends_on).toEqual(["F-001"]);
  });

  it("appends new keys at the end of the frontmatter", () => {
    const out = updateFrontmatter(FEATURE, {
      approved_by: "agent",
      answer: {
        option: "current",
        text: "Use the current secret, always.",
        answered_at: "2026-10-18T12:00:00Z",
      },
    });
    const parsed = parseFrontmatter(out);
    expect(parsed.data.approved_by).toBe("agent");
    expect(parsed.data.answer).toEqual({
      option: "current",
      text: "Use the current secret, always.",
      answered_at: "2026-10-18T12:00:00Z",
    });
    expect(parsed.body).toBe(splitFrontmatter(FEATURE).body);
  });

  it("round-trips multi-line strings", () => {
    const out = updateFrontmatter(FEATURE, { note: "line one\nline two" });
    expect(parseFrontmatter(out).data.note).toBe("line one\nline two");
  });

  it("preserves CRLF line endings and a BOM", () => {
    const crlf = "﻿" + FEATURE.replace(/\n/g, "\r\n");
    const out = updateFrontmatter(crlf, { status: "approved", approved_by: "you" });
    expect(out.startsWith("﻿---\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(parseFrontmatter(out).data.status).toBe("approved");
    expect(splitFrontmatter(out).body).toBe(splitFrontmatter(crlf).body);
  });

  it("fills an empty value", () => {
    const out = updateFrontmatter("---\nid: Q-0001\nresolution:\n---\n", { resolution: "x" });
    expect(out).toBe("---\nid: Q-0001\nresolution: x\n---\n");
  });

  it("adds frontmatter to a file that has none", () => {
    expect(updateFrontmatter("# Title\n", { id: "F-001" })).toBe("---\nid: F-001\n---\n# Title\n");
  });
});

describe("inlineYaml", () => {
  it("writes collections in flow style", () => {
    expect(inlineYaml(["F-001", "F-002"])).toBe("[F-001, F-002]");
    expect(inlineYaml({ kind: "adr", ref: "ADR-0003" })).toBe("{kind: adr, ref: ADR-0003}");
  });
});
