import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/core/build-index";
import { evaluateGate } from "../../src/core/gates";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** The done.as-built check of F-001, in verifying, with this as-built.md text (null: none). */
function asBuiltCheck(asBuilt: string | null) {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "verifying" }),
    ...(asBuilt === null ? {} : { ".azimuth/features/F-001-thing/as-built.md": asBuilt }),
  });
  cleanup = tree.cleanup;
  const { ctx, model } = analyzeProject(tree.root, new Date("2026-10-20T12:00:00Z"));
  const f = model.features.find((x) => x.id === "F-001");
  if (!f) throw new Error("F-001 is missing");
  return evaluateGate(ctx, f, "done")?.checks.find((c) => c.id === "done.as-built");
}

const asBuiltWith = (...deviations: string[]) =>
  [
    "---",
    "completed_at: 2026-10-20",
    "files_changed: []",
    "deviations:",
    ...deviations.map((d) => `  ${d}`),
    "follow_ups: []",
    "---",
    "# F-001: As built",
    "",
  ].join("\n");

describe("ST-021.6 the done gate needs a reason for every deviation", () => {
  it("S-021.6.1 fails and names each deviation whose reason is blank", () => {
    const text = asBuiltWith(
      '- { path: src/c.ts, kind: planned-unchanged, reason: "" }',
      '- { path: src/a.ts, kind: clarification, reason: "  " }',
      "- { path: src/extra.ts, kind: unplanned-create, reason: Split out }",
    );
    expect(asBuiltCheck(text)).toEqual({
      id: "done.as-built",
      rule: "as-built.md written",
      ok: false,
      detail: "No reason for src/c.ts (planned-unchanged), src/a.ts (clarification)",
    });
  });

  it("S-021.6.2 passes when every deviation has a reason", () => {
    const text = asBuiltWith(
      "- { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }",
      "- { path: src/a.ts, kind: clarification, reason: Parses lazily }",
      "- { path: src/extra.ts, kind: unplanned-create, reason: Split out }",
    );
    expect(asBuiltCheck(text)).toEqual({
      id: "done.as-built",
      rule: "as-built.md written",
      ok: true,
    });
  });

  it("S-021.6.3 fails without a detail when as-built.md is missing", () => {
    const check = asBuiltCheck(null);
    expect(check).toEqual({ id: "done.as-built", rule: "as-built.md written", ok: false });
    expect(check).not.toHaveProperty("detail");
  });

  it("S-021.6.4 fails and points to azimuth check when as-built.md doesn't parse", () => {
    expect(asBuiltCheck("---\ndeviations: []\n---\n")).toEqual({
      id: "done.as-built",
      rule: "as-built.md written",
      ok: false,
      detail: "as-built.md has errors (see azimuth check F-001)",
    });
  });
});
