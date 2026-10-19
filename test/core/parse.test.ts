import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/core/config";
import { compareIds, featureOf, idKind, mentions, slugify } from "../../src/core/ids";
import { parseFeatureMd, parsePlan, parseContract } from "../../src/core/parse/feature";
import { formatLogHeader, parseLog } from "../../src/core/parse/log";
import { parseIssue, parseQuestion } from "../../src/core/parse/records";
import { parseStories } from "../../src/core/parse/stories";
import { splitSections, stripTitle } from "../../src/core/sections";

describe("ids", () => {
  it("classifies IDs and finds their feature", () => {
    expect(idKind("S-005.1.2")).toBe("scenario");
    expect(idKind("SES-20261018-1100-2")).toBe("session");
    expect(idKind("XYZ")).toBeNull();
    expect(featureOf("T-005.4")).toBe("F-005");
    expect(featureOf("ADR-0001")).toBeNull();
  });

  it("finds mentions without matching inside session IDs", () => {
    expect(mentions("See F-005, S-005.1.2 and SES-20261018-1100.")).toEqual([
      "F-005",
      "S-005.1.2",
      "SES-20261018-1100",
    ]);
  });

  it("sorts IDs numerically and slugifies titles", () => {
    expect(["T-005.10", "T-005.2", "T-005.1"].sort(compareIds)).toEqual([
      "T-005.1",
      "T-005.2",
      "T-005.10",
    ]);
    expect(slugify("Retry with Exponential Backoff!")).toBe("retry-with-exponential-backoff");
  });
});

describe("sections", () => {
  it("splits on ## headings but not inside code fences", () => {
    const { preamble, sections } = splitSections(
      "# Title\nintro\n## A\none\n```\n## not a heading\n```\n## B\ntwo\n",
    );
    expect(preamble).toBe("intro");
    expect(sections.map((s) => s.title)).toEqual(["A", "B"]);
    expect(sections[0]?.body).toBe("one\n```\n## not a heading\n```");
  });

  it("strips a leading H1", () => {
    expect(stripTitle("\n# Vision\n\n## Problem\nx\n")).toBe("## Problem\nx");
  });
});

const STORIES = `# F-005 stories

## ST-005.1 · Schedule a retry
**Intent:** As the worker, I want retries
so that events survive.

### S-005.1.1 · Retries a 503 {happy}
- **GIVEN** delivery d1 is in flight
- **AND** jitter is seeded
- **WHEN** the receiver responds 503
- **THEN** d1.state = scheduled_retry

### S-005.1.2 · Rejects a 400 {negative}
- **GIVEN** delivery d1
- **THEN** the failure is handled appropriately

### S-005.1.3 · Missing kind
- **GIVEN** a
- **WHEN** b
- **THEN** c
`;

describe("parseStories", () => {
  const { stories, problems } = parseStories(STORIES, "stories.md", "F-005");

  it("parses stories, intents and scenarios", () => {
    expect(stories).toHaveLength(1);
    expect(stories[0]?.intent).toBe("As the worker, I want retries so that events survive.");
    expect(stories[0]?.scenarios.map((s) => s.id)).toEqual(["S-005.1.1", "S-005.1.2"]);
    expect(stories[0]?.scenarios[0]).toMatchObject({
      kind: "happy",
      given: "delivery d1 is in flight and jitter is seeded",
      when: "the receiver responds 503",
      then: "d1.state = scheduled_retry",
      line: 7,
    });
  });

  it("reports missing clauses, kinds and vague THENs with line numbers", () => {
    const byCode = (code: string) => problems.filter((p) => p.code === code);
    expect(byCode("E-STORY-FORMAT").map((p) => p.message)).toEqual([
      "S-005.1.2 is missing WHEN.",
      "S-005.1.3 needs a kind tag: {happy}, {negative} or {edge}.",
    ]);
    expect(byCode("W-VAGUE")).toEqual([expect.objectContaining({ line: 15, ref: "S-005.1.2" })]);
  });

  it("flags IDs that belong to another feature or story", () => {
    const text =
      "## ST-006.1 · Wrong\n**Intent:** x\n\n### S-005.2.1 · Wrong story {happy}\n- **GIVEN** a\n- **WHEN** b\n- **THEN** c\n";
    const codes = parseStories(text, "s.md", "F-005").problems.map((p) => p.code);
    expect(codes).toEqual(["E-ID-MISMATCH", "E-ID-MISMATCH"]);
  });
});

describe("parseLog", () => {
  it("parses headers, transitions and auto markers", () => {
    const text = [
      "# Log",
      "",
      "## 2026-10-09T08:40:00Z · you · transition",
      "draft → approved",
      "",
      "## 2026-10-19T09:00:00Z · agent · transition · SES-20261019-0900 · auto",
      "draft → approved. All checks passed.",
      "",
      "## 2026-10-18T11:58:00Z · agent · note · SES-20261018-1100",
      "Progress.",
    ].join("\n");
    const { entries, problems } = parseLog(text, "log.md");
    expect(problems).toEqual([]);
    expect(entries.map((e) => [e.actor, e.type, e.session, e.auto, e.transition])).toEqual([
      ["you", "transition", null, false, { from: "draft", to: "approved" }],
      ["agent", "transition", "SES-20261019-0900", true, { from: "draft", to: "approved" }],
      ["agent", "note", "SES-20261018-1100", false, null],
    ]);
  });

  it("reports malformed headers", () => {
    const { problems } = parseLog("## yesterday · me · chat\nhi\n", "log.md");
    expect(problems[0]).toMatchObject({ code: "E-LOG-FORMAT", line: 1 });
  });

  it("formats headers that parse back", () => {
    const header = formatLogHeader({
      at: "2026-10-19T09:00:00Z",
      actor: "agent",
      type: "transition",
      session: "SES-20261019-0900",
      auto: true,
    });
    expect(parseLog(`${header}\nidea → draft\n`, "log.md").entries[0]?.auto).toBe(true);
  });
});

describe("parseFeatureMd", () => {
  it("reads frontmatter and context sections", () => {
    const text = `---
id: F-005
title: Retry
summary: Retry failed deliveries.
status: draft
created: 2026-10-02
depends_on: [F-003]
---
# F-005: Retry

## Objective
Retry them.

## Invariants
- Never twice.
`;
    const { header, problems } = parseFeatureMd(text, "feature.md");
    expect(problems).toEqual([]);
    expect(header).toMatchObject({
      id: "F-005",
      status: "draft",
      priority: "P2",
      updated: "2026-10-02",
      depends_on: ["F-003"],
      context: { objective: "Retry them.", invariants: "- Never twice.", assumptions: "" },
    });
  });

  it("leaves out a feature with an invalid status", () => {
    const { header, problems } = parseFeatureMd(
      "---\nid: F-001\ntitle: X\nstatus: wip\ncreated: 2026-01-01\n---\n",
      "f.md",
    );
    expect(header).toBeNull();
    expect(problems[0]?.message).toContain("F-001 was left out of the index.");
    expect(problems[0]?.line).toBe(4);
  });
});

describe("parsePlan", () => {
  it("validates tasks", () => {
    const text = `---
tasks:
  - id: T-005.1
    title: Types
    status: done
    verify: pnpm tsc --noEmit
  - id: T-005.2
    title: Blocked one
    status: blocked
  - id: T-006.1
    title: Wrong feature
---
`;
    const { tasks, problems } = parsePlan(text, "plan.md", "F-005");
    expect(tasks.map((t) => t.id)).toEqual(["T-005.1", "T-005.2", "T-006.1"]);
    expect(problems.map((p) => p.code)).toEqual(["E-SCHEMA", "E-ID-MISMATCH"]);
  });
});

describe("parseContract", () => {
  it("takes the language from the first fence when not declared", () => {
    const { contract } = parseContract("## Types\n```ts\ntype A = 1;\n```\n", "contract.md");
    expect(contract).toEqual({
      language: "typescript",
      sections: [{ title: "Types", body: "```ts\ntype A = 1;\n```" }],
    });
  });
});

describe("records", () => {
  it("excludes an issue with an invalid level and explains why", () => {
    const text =
      "---\nid: RISK-0002\ntype: risk\ntitle: Memory growth\nstatus: open\nlikelihood: med\nimpact: high\ncreated: 2026-10-15\n---\n";
    const { entity, problems } = parseIssue(text, ".azimuth/issues/RISK-0002-memory-growth.md");
    expect(entity).toBeNull();
    expect(problems).toEqual([
      {
        code: "E-SCHEMA",
        severity: "error",
        file: ".azimuth/issues/RISK-0002-memory-growth.md",
        line: 6,
        ref: null,
        message:
          'likelihood must be low, medium or high (got "med"). RISK-0002 was left out of the index.',
      },
    ]);
  });

  it("rejects an issue type that does not match its prefix", () => {
    const { entity } = parseIssue(
      "---\nid: BUG-0001\ntype: debt\ntitle: x\nseverity: low\ncreated: 2026-01-01\n---\n",
      "i.md",
    );
    expect(entity).toBeNull();
  });

  it("parses a question with options and context", () => {
    const text = `---
id: Q-0003
title: Which secret?
status: open
feature: F-008
blocking: true
raised_by: SES-20261018-0930
raised_at: 2026-10-18T10:12:00Z
options:
  - key: current
    label: Current secret
    recommended: true
  - key: original
    label: Original secret
---
## Context
Rotation matters.
`;
    const { entity, problems } = parseQuestion(text, "q.md");
    expect(problems).toEqual([]);
    expect(entity).toMatchObject({
      feature: "F-008",
      blocking: true,
      context: "Rotation matters.",
      answer: null,
    });
    expect(entity?.options.map((o) => o.recommended)).toEqual([true, false]);
  });
});

describe("parseConfig", () => {
  it("applies defaults and warns about unknown keys", () => {
    const { config, problems } = parseConfig(
      "project:\n  name: Demo\n  colour: blue\nstack:\n  languages: [typescript]\n",
    );
    expect(config.project.name).toBe("Demo");
    expect(config.autonomy).toEqual({ approve_specs: "auto", accept_adrs: "auto", strict: false });
    expect(config.stack.display).toEqual(["typescript"]);
    expect(problems).toEqual([expect.objectContaining({ code: "W-UNKNOWN-KEY", line: 3 })]);
  });

  it("requires a project name", () => {
    expect(parseConfig("schema: 1\n").problems.map((p) => p.code)).toEqual(["E-SCHEMA"]);
  });

  const DEFAULT_SHARED = [
    "package.json",
    "pnpm-lock.yaml",
    "Cargo.toml",
    "Cargo.lock",
    "go.mod",
    "go.sum",
    "pyproject.toml",
    "uv.lock",
  ];

  it("S-006.6.1 applies the default verify.shared_paths when the key is absent", () => {
    const { config, problems } = parseConfig(
      "project:\n  name: Demo\nverify:\n  timeout_seconds: 600\n",
    );
    expect(config.verify.shared_paths).toEqual(DEFAULT_SHARED);
    expect(problems).toEqual([]);
  });

  it("S-006.6.2 reads a configured verify.shared_paths as given", () => {
    const { config } = parseConfig(
      'project:\n  name: Demo\nverify:\n  shared_paths: ["crates/*/Cargo.toml", Cargo.lock]\n',
    );
    expect(config.verify.shared_paths).toEqual(["crates/*/Cargo.toml", "Cargo.lock"]);
  });

  it("S-006.6.3 rejects a verify.shared_paths that isn't a list", () => {
    const { config, problems } = parseConfig(
      "project:\n  name: Demo\nverify:\n  shared_paths: package.json\n",
    );
    expect(problems.map((p) => [p.code, p.message])).toEqual([
      ["E-SCHEMA", "verify.shared_paths must be a list of text values."],
    ]);
    expect(config.verify.shared_paths).toEqual(DEFAULT_SHARED);
  });
});
