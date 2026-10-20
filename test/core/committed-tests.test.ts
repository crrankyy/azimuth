import { afterEach, describe, expect, it } from "vitest";
import { markCommitted, traceTests } from "../../src/core/trace";
import { commitAll, initRepo } from "../helpers/git";
import { featureFiles } from "../helpers/project";
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
