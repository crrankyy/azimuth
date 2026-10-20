import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { derive } from "../../src/core/derive";
import { AzimuthError } from "../../src/core/errors";
import { evaluateGate } from "../../src/core/gates";
import { markCommitted, traceTests } from "../../src/core/trace";
import { moveFeature } from "../../src/core/transitions";
import { sortProblems, validate } from "../../src/core/validate";
import { commitAll, git, initRepo } from "../helpers/git";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const GLOBS = ["test/**/*.test.ts"];
const OPENS = 'it("S-001.1.1 opens the palette", () => {});\n';
const LISTS = 'it("S-001.1.2 lists keys in every preset", () => {});\n';

/**
 * The stories' project, F-001 in progress, with `keymap` as `test/keymap.test.ts`; committed as
 * HEAD unless `repo` is false, which leaves a folder outside any git repository.
 */
function project(keymap = OPENS, repo = true) {
  const tree = writeTree({
    ".gitignore": ".azimuth/cache/\n",
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    "src/app.ts": "export const a = 0;\n",
    "test/keymap.test.ts": keymap,
  });
  cleanup = tree.cleanup;
  if (repo) {
    initRepo(tree.root);
    commitAll(tree.root, "chore: start");
  }
  return tree;
}

/** R-0001: T-001.1 passed at `commit` with each of `scenarios` passing. */
const runFile = (commit: string | null, scenarios: string[]) =>
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
    scenarios: scenarios.map((id) => ({ id, status: "passing" })),
    junit: null,
  });

interface CloseOut {
  /** Files HEAD also holds; `test/keymap.test.ts` is OPENS unless given here. */
  head?: Record<string, string>;
  /** Files written to the working tree after the close-out commit. */
  work?: Record<string, string>;
  /** False writes the same files in a folder outside any git repository (R-0001's commit null). */
  repo?: boolean;
}

/**
 * The close-out repository: F-001 verifying with T-001.1 done, R-0001 at the build commit and a
 * close-out commit (as-built, reconciliation) as HEAD, so every done check but the scenarios
 * check passes. `work` is what the working tree adds after it.
 */
function closeOut({ head = {}, work = {}, repo = true }: CloseOut = {}) {
  const tree = writeTree({
    ".gitignore": ".azimuth/cache/\n",
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({
      id: "F-001",
      status: "verifying",
      tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
    }),
    ".azimuth/project/architecture.md": "---\nreconciled_at: null\n---\n",
    "src/app.ts": "export const a = 0;\n",
    "test/keymap.test.ts": OPENS,
    ...head,
  });
  cleanup = tree.cleanup;
  const commit = (message: string, date: string) =>
    repo ? commitAll(tree.root, message, date) : null;
  if (repo) initRepo(tree.root);
  commit("chore: start", "2026-10-01T10:00:00Z");
  tree.write("src/app.ts", "export const a = 1;\n");
  const built = commit("feat(F-001): build it\n\nRefs: T-001.1", "2026-10-02T10:00:00Z");
  tree.write(".azimuth/cache/runs/R-0001.json", runFile(built, ["S-001.1.1", "S-001.1.2"]));
  tree.write(".azimuth/features/F-001-thing/as-built.md", "---\ncompleted_at: 2026-10-02\n---\n");
  tree.write(".azimuth/project/architecture.md", `---\nreconciled_at: ${built}\n---\n`);
  commit("docs(F-001): close out\n\nRefs: F-001", "2026-10-02T11:00:00Z");
  for (const [path, text] of Object.entries(work)) tree.write(path, text);
  return tree;
}

const NOW = new Date("2026-10-02T12:00:00Z");

/** The done.scenarios-passing entry of F-001's next gate in the built index. */
const scenariosCheck = (root: string) =>
  buildIndex(root, { now: NOW })
    .index.features.find((f) => f.id === "F-001")
    ?.derived.next_gate?.checks.find((c) => c.id === "done.scenarios-passing");

const RULE = "Every scenario has a passing test";

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

describe("markCommitted", () => {
  it("S-020.2.1 marks a test added to a tracked file uncommitted and leaves traceTests' refs alone", () => {
    const { root, write } = project();
    write("test/keymap.test.ts", OPENS + LISTS);
    const tests = traceTests(root, GLOBS);
    const marked = markCommitted(root, tests, ["test/keymap.test.ts"]);
    expect(marked.get("S-001.1.1")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.1 opens the palette",
        confidence: "marker",
        committed: true,
      },
    ]);
    expect(marked.get("S-001.1.2")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.2 lists keys in every preset",
        confidence: "marker",
        committed: false,
      },
    ]);
    expect([...tests.values()].flat().filter((ref) => "committed" in ref)).toEqual([]);
  });

  it("S-020.2.2 marks a test in a new untracked file uncommitted", () => {
    const { root, write } = project();
    write("test/palette.test.ts", LISTS);
    const marked = markCommitted(root, traceTests(root, GLOBS), ["test/palette.test.ts"]);
    expect(marked.get("S-001.1.2")).toEqual([
      expect.objectContaining({ file: "test/palette.test.ts", committed: false }),
    ]);
    expect(marked.get("S-001.1.1")).toEqual([
      expect.objectContaining({ file: "test/keymap.test.ts", committed: true }),
    ]);
  });

  it("S-020.2.3 keeps a marker committed when only the test's body changed", () => {
    const { root, write } = project(
      'it("S-001.1.1 opens the palette", () => { expect(1).toBe(1); });\n',
    );
    write(
      "test/keymap.test.ts",
      'it("S-001.1.1 opens the palette", () => { expect(2).toBe(2); });\n',
    );
    const marked = markCommitted(root, traceTests(root, GLOBS), ["test/keymap.test.ts"]);
    expect(marked.get("S-001.1.1")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.1 opens the palette",
        confidence: "marker",
        committed: true,
      },
    ]);
  });

  it("S-020.2.4 marks a test renamed in the working tree uncommitted", () => {
    const { root, write } = project('it("S-001.1.1 opens", () => {});\n');
    write("test/keymap.test.ts", OPENS);
    const marked = markCommitted(root, traceTests(root, GLOBS), ["test/keymap.test.ts"]);
    expect(marked.get("S-001.1.1")).toEqual([
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.1 opens the palette",
        confidence: "marker",
        committed: false,
      },
    ]);
  });

  it("S-020.2.5 reads nothing from git when no traced file is changed or git is absent", () => {
    // Outside a repository a read of HEAD gives null blobs, which would mark the ref uncommitted.
    const { root } = project(OPENS, false);
    const tests = traceTests(root, GLOBS);
    const expected = [
      {
        file: "test/keymap.test.ts",
        name: "S-001.1.1 opens the palette",
        confidence: "marker",
        committed: true,
      },
    ];
    expect(markCommitted(root, tests, []).get("S-001.1.1")).toEqual(expected);
    expect(markCommitted(root, tests, null).get("S-001.1.1")).toEqual(expected);
  });
});

describe("the done gate counts committed tests", () => {
  const TWO_OF_TWO = { id: "done.scenarios-passing", rule: RULE, ok: true, detail: "2 of 2" };

  it("S-020.4.1 refuses done when a passing scenario's only test is uncommitted", () => {
    const { root } = closeOut({ work: { "test/keymap.test.ts": OPENS + LISTS } });
    const error = errorOf(() => moveFeature(root, "F-001", "done", { actor: "agent" }));
    expect(error.code).toBe("gate");
    expect(error.message).toBe(
      "F-001 cannot move to done: Every scenario has a passing test (1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts).",
    );
    const featureMd = readFileSync(join(root, ".azimuth/features/F-001-thing/feature.md"), "utf8");
    expect(featureMd).toMatch(/^status: verifying$/m);
  });

  it("S-020.4.2 counts the keymap test once git commit -am records it", () => {
    const { root } = closeOut({ work: { "test/keymap.test.ts": OPENS + LISTS } });
    git(root, ["commit", "-q", "-am", "test(F-001): add the keymap test"], "2026-10-02T11:30:00Z");
    expect(scenariosCheck(root)).toEqual(TWO_OF_TWO);
  });

  it("S-020.4.3 leaves out a scenario whose only test is in a new untracked file", () => {
    const { root } = closeOut({ work: { "test/palette.test.ts": LISTS } });
    expect(scenariosCheck(root)).toEqual({
      id: "done.scenarios-passing",
      rule: RULE,
      ok: false,
      detail: "1 of 2; S-001.1.2 only in uncommitted test/palette.test.ts",
    });
  });

  it("S-020.4.4 counts a scenario with one committed test beside an untracked one", () => {
    const { root } = closeOut({
      head: { "test/keymap.test.ts": OPENS + 'it("S-001.1.2 lists keys", () => {});\n' },
      work: { "test/palette.test.ts": LISTS },
    });
    expect(scenariosCheck(root)).toEqual(TWO_OF_TWO);
  });

  it("S-020.4.5 counts a modified test file whose marker HEAD already holds", () => {
    const body = (n: number) =>
      `it("S-001.1.2 lists keys in every preset", () => { expect(${n}).toBe(${n}); });\n`;
    const { root } = closeOut({
      head: { "test/keymap.test.ts": OPENS + body(1) },
      work: { "test/keymap.test.ts": OPENS + body(2) },
    });
    expect(scenariosCheck(root)).toEqual(TWO_OF_TWO);
  });

  it("S-020.4.6 names each passing scenario left out with its sorted uncommitted files", () => {
    const tree = loadTree({
      ...featureFiles({
        id: "F-001",
        status: "verifying",
        stories: { "ST-001.1": ["happy", "negative", "edge"] },
        tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2", "S-001.1.3"] }],
      }),
      ".azimuth/cache/runs/R-0001.json": runFile("aaaaaaa", [
        "S-001.1.1",
        "S-001.1.2",
        "S-001.1.3",
      ]),
    });
    cleanup = tree.cleanup;
    const marker = (file: string, name: string, committed?: boolean) => ({
      file,
      name,
      confidence: "marker" as const,
      ...(committed === undefined ? {} : { committed }),
    });
    const facts = makeFacts({
      tests: new Map([
        ["S-001.1.1", [marker("test/a.test.ts", "S-001.1.1 works")]],
        [
          "S-001.1.2",
          [
            marker("test/c.test.ts", "S-001.1.2 fails", false),
            marker("test/b.test.ts", "S-001.1.2 fails too", false),
          ],
        ],
        ["S-001.1.3", [marker("test/d.test.ts", "S-001.1.3 edges", false)]],
      ]),
    });
    const { model } = tree;
    const derived = derive(model, facts);
    const problems = sortProblems([...model.problems, ...validate(model, facts, derived)]);
    const f = model.features.find((x) => x.id === "F-001")!;
    const check = evaluateGate({ model, facts, derived, problems }, f, "done")?.checks.find(
      (c) => c.id === "done.scenarios-passing",
    );
    expect(check?.ok).toBe(false);
    expect(check?.detail).toBe(
      "1 of 3; S-001.1.2 only in uncommitted test/b.test.ts, test/c.test.ts; S-001.1.3 only in uncommitted test/d.test.ts",
    );
  });

  it("S-020.4.7 counts scenarios as before in a folder without git", () => {
    const { root } = closeOut({ repo: false, work: { "test/keymap.test.ts": OPENS + LISTS } });
    expect(scenariosCheck(root)).toEqual(TWO_OF_TWO);
  });

  it("S-020.4.8 doesn't let a committed mention stand in for an uncommitted marked test", () => {
    const { root } = closeOut({
      head: { "test/notes.test.ts": "// Covers S-001.1.2 once the keymap lands.\n" },
      work: { "test/keymap.test.ts": OPENS + LISTS },
    });
    expect(scenariosCheck(root)).toEqual({
      id: "done.scenarios-passing",
      rule: RULE,
      ok: false,
      detail: "1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts",
    });
  });
});
