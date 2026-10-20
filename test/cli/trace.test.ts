import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { commitAll, git, initRepo } from "../helpers/git";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const MENTIONS = [
  "// Follows S-001.1.1 and the refund flow.",
  'it("S-001.1.1 charges the card", () => {});',
  "// S-001.1.2 waits for the bank stub.",
  "",
].join("\n");

/** F-001 with scenarios S-001.1.1 and S-001.1.2 (both titled "Scenario") and one test file. */
function project(testFile = MENTIONS): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    "test/pay.test.ts": testFile,
    ...featureFiles({ id: "F-001", status: "draft" }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("trace hides mention-only references", () => {
  it("S-013.2.1 hides mention-only references and counts them", async () => {
    const r = await runCli(project(), ["trace", "F-001"]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "S-001.1.2 not-run Scenario",
        "2 mention-only references hidden (--all shows them)",
        "",
      ].join("\n"),
    );
    expect(r.code).toBe(0);
  });

  it("S-013.2.2 shows them marked (mention) with --all", async () => {
    const r = await runCli(project(), ["trace", "F-001", "--all"]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "    test/pay.test.ts: // Follows S-001.1.1 and the refund flow. (mention)",
        "S-001.1.2 not-run Scenario",
        "    test/pay.test.ts: // S-001.1.2 waits for the bank stub. (mention)",
        "",
      ].join("\n"),
    );
  });

  it("S-013.2.3 prints no hint without mentions", async () => {
    const r = await runCli(project('it("S-001.1.1 charges the card", () => {});\n'), [
      "trace",
      "F-001",
    ]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "S-001.1.2 untested Scenario",
        "",
      ].join("\n"),
    );
  });

  it("S-013.2.4 keeps mention-only references in --json", async () => {
    const r = await runCli(project(), ["trace", "F-001", "--json"]);
    const rows = JSON.parse(r.out) as { scenario: string; tests: unknown[] }[];
    expect(rows.find((row) => row.scenario === "S-001.1.2")?.tests).toEqual([
      {
        file: "test/pay.test.ts",
        name: "// S-001.1.2 waits for the bank stub.",
        status: "not-run",
        confidence: "fallback",
        committed: true,
      },
    ]);
  });
});

const OPENS = 'it("S-001.1.1 opens the palette", () => {});\n';
const LISTS = 'it("S-001.1.2 lists keys in every preset", () => {});\n';

/** R-0001: T-001.1 passed at `commit` with S-001.1.1 and S-001.1.2 passing. */
const runFile = (commit: string | null) =>
  JSON.stringify({
    id: "R-0001",
    target: "T-001.1",
    command: "pnpm test",
    ok: true,
    exit_code: 0,
    duration_ms: 1,
    at: "2026-10-02T10:05:00Z",
    commit,
    output_tail: "",
    scenarios: [
      { id: "S-001.1.1", status: "passing" },
      { id: "S-001.1.2", status: "passing" },
    ],
    junit: null,
  });

/**
 * The stories' repository: F-001 in progress and HEAD's `test/keymap.test.ts` OPENS, then
 * `keymap` written to the working tree and R-0001 recorded at HEAD. `repo` false writes the same
 * files in a folder outside any git repository (R-0001's commit null).
 */
function keymapProject(keymap: string, repo = true): string {
  const tree = writeTree({
    ".gitignore": ".azimuth/cache/\n",
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    "src/app.ts": "export const a = 0;\n",
    "test/keymap.test.ts": OPENS,
  });
  cleanup = tree.cleanup;
  let head: string | null = null;
  if (repo) {
    initRepo(tree.root);
    head = commitAll(tree.root, "chore: start");
  }
  tree.write("test/keymap.test.ts", keymap);
  tree.write(".azimuth/cache/runs/R-0001.json", runFile(head));
  return tree.root;
}

interface TraceRow {
  scenario: string;
  tests: { committed: boolean }[];
}

const testsOf = (out: string, scenario: string) =>
  (JSON.parse(out) as TraceRow[]).find((row) => row.scenario === scenario)?.tests;

const committedFlags = (out: string) =>
  (JSON.parse(out) as TraceRow[]).flatMap((row) => row.tests.map((t) => t.committed));

describe("trace marks tests only in the working tree", () => {
  it("S-020.3.1 prints (uncommitted) after the test the #2 change added", async () => {
    const r = await runCli(keymapProject(OPENS + LISTS), ["trace", "F-001"]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      [
        "S-001.1.1 passing Scenario",
        "    test/keymap.test.ts: S-001.1.1 opens the palette",
        "S-001.1.2 passing Scenario",
        "    test/keymap.test.ts: S-001.1.2 lists keys in every preset (uncommitted)",
        "",
      ].join("\n"),
    );
  });

  it("S-020.3.2 gives every test its committed field in --json", async () => {
    const r = await runCli(keymapProject(OPENS + LISTS), ["trace", "F-001", "--json"]);
    expect(testsOf(r.out, "S-001.1.2")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.2 lists keys in every preset",
        status: "passing",
        confidence: "marker",
        committed: false,
      },
    ]);
    expect(testsOf(r.out, "S-001.1.1")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.1 opens the palette",
        status: "passing",
        confidence: "marker",
        committed: true,
      },
    ]);
  });

  it("S-020.3.3 drops the mark once git commit -am records the test", async () => {
    const root = keymapProject(OPENS + LISTS);
    git(root, ["commit", "-q", "-am", "test(F-001): add the keymap test"], "2026-10-02T11:30:00Z");
    const text = await runCli(root, ["trace", "F-001"]);
    expect(text.out).toBe(
      [
        "S-001.1.1 passing Scenario",
        "    test/keymap.test.ts: S-001.1.1 opens the palette",
        "S-001.1.2 passing Scenario",
        "    test/keymap.test.ts: S-001.1.2 lists keys in every preset",
        "",
      ].join("\n"),
    );
    const json = await runCli(root, ["trace", "F-001", "--json"]);
    expect(committedFlags(json.out)).toEqual([true, true]);
  });

  it("S-020.3.4 marks an uncommitted mention with both (mention) and (uncommitted)", async () => {
    const root = keymapProject(OPENS + "// S-001.1.2 waits for the bank stub.\n");
    const lines = (await runCli(root, ["trace", "F-001", "--all"])).out.split("\n");
    expect(lines[lines.indexOf("S-001.1.2 passing Scenario") + 1]).toBe(
      "    test/keymap.test.ts: // S-001.1.2 waits for the bank stub. (mention) (uncommitted)",
    );
  });

  it("S-020.3.5 counts every test as committed in a folder without git", async () => {
    const root = keymapProject(OPENS + LISTS, false);
    const text = await runCli(root, ["trace", "F-001"]);
    expect(text.code).toBe(0);
    expect(text.out).toContain("S-001.1.2 lists keys in every preset");
    expect(text.out).not.toContain("(uncommitted)");
    const json = await runCli(root, ["trace", "F-001", "--json"]);
    expect(committedFlags(json.out)).toEqual([true, true]);
  });
});
