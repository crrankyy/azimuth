import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { runCli } from "../helpers/cli";
import { commitAll, initRepo } from "../helpers/git";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const SES = "SES-20261020-0900";
const DIR = ".azimuth/features/F-001-thing";
const AS_BUILT = `${DIR}/as-built.md`;
const USAGE = "Usage: azimuth as-built <F-ID> [--json]\n";

const EXAMPLE_IMPACT = [
  { path: "src/a.ts", change: "create" },
  { path: "src/b.ts", change: "modify" },
  { path: "src/c.ts", change: "modify" },
  { path: "test/a.test.ts", change: "test" },
  { path: "src/types.ts", change: "read" },
];

/** contract.md's example project before its commits: F-001 (verifying unless `status` says otherwise). */
function exampleTree(opts: { status?: string } = {}) {
  const tree = writeTree({
    ".gitignore": ".azimuth/cache/\n",
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: opts.status ?? "verifying", impact: EXAMPLE_IMPACT }),
    "src/b.ts": "export const b = 1;\n",
    "src/c.ts": "export const c = 1;\n",
    "src/types.ts": "export type T = number;\n",
  });
  cleanup = tree.cleanup;
  return tree;
}

/**
 * contract.md's example project: committed as `chore: start`, then `feat(F-001): add a` with
 * `Refs: T-001.1`.
 */
function example(opts: { status?: string } = {}) {
  const tree = exampleTree(opts);
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
  tree.write("src/a.ts", "export const a = 1;\n");
  tree.write("src/extra.ts", "export const extra = 1;\n");
  tree.write("test/a.test.ts", 'it("S-001.1.1 works", () => {});\n');
  tree.write("src/b.ts", "export const b = 2;\n");
  appendFileSync(join(tree.root, DIR, "plan.md"), "Planned.\n");
  commitAll(tree.root, "feat(F-001): add a\n\nRefs: T-001.1");
  return tree;
}

/** contract.md's example as-built.md, completed on `date`. */
const exampleText = (date: string) =>
  [
    "---",
    `completed_at: ${date}`,
    "files_changed:",
    "  - { path: src/a.ts, change: create }",
    "  - { path: src/b.ts, change: modify }",
    "  - { path: src/extra.ts, change: create }",
    "  - { path: test/a.test.ts, change: create }",
    "deviations:",
    '  - { path: src/c.ts, kind: planned-unchanged, reason: "" }',
    '  - { path: src/extra.ts, kind: unplanned-create, reason: "" }',
    "follow_ups: []",
    "---",
    "# F-001: As built",
    "",
    "## Summary",
    "",
    "## Deviations",
    "",
    "## Follow-ups",
    "",
  ].join("\n");

describe("ST-021.5 azimuth as-built on the command line", () => {
  it("S-021.5.1 writes the draft, lists its gaps and records the session", async () => {
    const { root, write } = example();
    write(
      `.azimuth/sessions/${SES}.md`,
      `---\nid: ${SES}\nstarted_at: 2026-10-20T09:00:00Z\ntouched: []\n---\n## Summary\n`,
    );
    const r = await runCli(root, ["as-built", "F-001"], { AZIMUTH_SESSION: SES });
    expect([r.code, r.out]).toEqual([
      0,
      "Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 2 without a reason.\n" +
        "Needs a reason: src/c.ts (planned-unchanged), src/extra.ts (unplanned-create)\n",
    ]);
    const today = new Date().toISOString().slice(0, 10);
    expect(readFileSync(join(root, AS_BUILT), "utf8")).toBe(exampleText(today));
    expect(loadProject(root).sessions.find((s) => s.id === SES)?.touched).toEqual(["F-001"]);
  });

  it("S-021.5.2 prints the result as JSON with --json", async () => {
    const { root, write } = example();
    write(
      AS_BUILT,
      [
        "---",
        "completed_at: 2026-10-19",
        "files_changed: []",
        "deviations:",
        "  - { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }",
        "  - { path: src/extra.ts, kind: unplanned-create, reason: Split out }",
        "follow_ups: []",
        "---",
        "",
      ].join("\n"),
    );
    const r = await runCli(root, ["as-built", "F-001", "--json"]);
    expect(r.code).toBe(0);
    const result = JSON.parse(r.out) as Record<string, unknown>;
    expect({
      feature: result.feature,
      file: result.file,
      created: result.created,
      unexplained: result.unexplained,
      message: result.message,
    }).toEqual({
      feature: "F-001",
      file: ".azimuth/features/F-001-thing/as-built.md",
      created: false,
      unexplained: [],
      message:
        "Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 0 without a reason.",
    });
  });

  it("S-021.5.3 exits 1 for a feature that doesn't exist", async () => {
    const { root } = example();
    const r = await runCli(root, ["as-built", "F-009"]);
    expect(r).toEqual({ code: 1, out: "", err: "✗ F-009 does not exist.\n" });
  });

  it("S-021.5.4 exits 1 for a feature that isn't verifying or done", async () => {
    const { root } = example({ status: "in-progress" });
    const r = await runCli(root, ["as-built", "F-001"]);
    expect(r).toEqual({
      code: 1,
      out: "",
      err: "✗ F-001 is in-progress: azimuth as-built takes a feature in verifying or done.\n",
    });
    expect(existsSync(join(root, AS_BUILT))).toBe(false);
  });

  it("S-021.5.5 exits 1 outside a git repository", async () => {
    const { root } = exampleTree();
    const r = await runCli(root, ["as-built", "F-001"]);
    expect(r).toEqual({
      code: 1,
      out: "",
      err: "✗ Not a git repository: azimuth as-built reads the feature's commits.\n",
    });
    expect(existsSync(join(root, AS_BUILT))).toBe(false);
  });

  it("S-021.5.6 exits 2 for a task ID and for a missing ID", async () => {
    const { root } = example();
    expect(await runCli(root, ["as-built", "T-001.1"])).toEqual({
      code: 2,
      out: "",
      err: `T-001.1 is not a feature ID.\n${USAGE}`,
    });
    expect(await runCli(root, ["as-built"])).toEqual({
      code: 2,
      out: "",
      err: `Missing <F-ID>.\n${USAGE}`,
    });
  });
});
