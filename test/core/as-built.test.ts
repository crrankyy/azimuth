import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deviationsFor,
  filesChanged,
  writeAsBuilt,
  type FileChange,
} from "../../src/core/as-built";
import { AzimuthError } from "../../src/core/errors";
import { readFeatureCommits } from "../../src/core/git";
import type { ImpactChange } from "../../src/core/types";
import { commitAll, git, initRepo } from "../helpers/git";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** One commit from git's name-status lines, `<one-letter status> <path>`. */
const commit = (...lines: string[]) => ({
  changes: lines.map((line) => ({ status: line.slice(0, 1), path: line.slice(2) })),
});

const files = (entries: [string, FileChange["change"]][]): FileChange[] =>
  entries.map(([path, change]) => ({ path, change }));

const impact = (entries: [string, ImpactChange][]) =>
  entries.map(([path, change]) => ({ path, change }));

describe("files_changed", () => {
  it("S-021.1.1 lets a path's first change decide create", () => {
    const commits = [commit("A src/a.ts", "M src/b.ts"), commit("M src/a.ts", "T src/link.ts")];
    expect(filesChanged(commits)).toEqual([
      { path: "src/a.ts", change: "create" },
      { path: "src/b.ts", change: "modify" },
      { path: "src/link.ts", change: "modify" },
    ]);
  });

  it("S-021.1.2 makes a path created then deleted a delete", () => {
    const commits = [
      commit("A src/tmp.ts", "D src/old.ts", "M src/b.ts"),
      commit("D src/tmp.ts", "A src/old.ts", "D src/b.ts"),
    ];
    const changed = filesChanged(commits);
    expect(changed).toEqual([
      { path: "src/b.ts", change: "delete" },
      { path: "src/old.ts", change: "modify" },
      { path: "src/tmp.ts", change: "delete" },
    ]);
    expect(deviationsFor(changed, impact([["src/b.ts", "modify"]]), [])).toEqual([
      { path: "src/old.ts", kind: "unplanned-modify", reason: "" },
      { path: "src/tmp.ts", kind: "unplanned-delete", reason: "" },
    ]);
  });

  it("S-021.1.3 leaves paths under .azimuth/ out of the files and the deviations", () => {
    const commits = [
      commit("A .azimuth/features/F-001-thing/as-built.md", "M src/a.ts"),
      commit("M .azimuth/features/F-001-thing/plan.md"),
    ];
    const changed = filesChanged(commits);
    expect(changed).toEqual([{ path: "src/a.ts", change: "modify" }]);
    const rows = impact([
      ["src/a.ts", "modify"],
      [".azimuth/templates/feature/as-built.md", "modify"],
    ]);
    expect(deviationsFor(changed, rows, [])).toEqual([]);
  });
});

describe("deviations from impact.md", () => {
  it("S-021.3.1 reports unplanned paths and planned rows no commit changed", () => {
    const changed = files([
      ["src/a.ts", "create"],
      ["src/b.ts", "modify"],
      ["src/extra.ts", "create"],
      ["src/gone.ts", "delete"],
      ["src/patch.ts", "modify"],
    ]);
    const rows = impact([
      ["src/a.ts", "create"],
      ["src/b.ts", "modify"],
      ["src/c.ts", "modify"],
      ["test/a.test.ts", "test"],
      ["src/types.ts", "read"],
    ]);
    expect(deviationsFor(changed, rows, [])).toEqual([
      { path: "src/c.ts", kind: "planned-unchanged", reason: "" },
      { path: "src/extra.ts", kind: "unplanned-create", reason: "" },
      { path: "src/gone.ts", kind: "unplanned-delete", reason: "" },
      { path: "src/patch.ts", kind: "unplanned-modify", reason: "" },
      { path: "test/a.test.ts", kind: "planned-unchanged", reason: "" },
    ]);
  });

  it("S-021.3.2 treats a read row as neither a deviation nor a plan to change", () => {
    const rows = impact([
      ["src/types.ts", "read"],
      ["src/util.ts", "read"],
    ]);
    expect(deviationsFor(files([["src/util.ts", "modify"]]), rows, [])).toEqual([
      { path: "src/util.ts", kind: "unplanned-modify", reason: "" },
    ]);
  });

  it("S-021.3.3 lets a row naming a directory cover the files under it", () => {
    const changed = files([
      ["src/parser.ts", "modify"],
      ["src/parser/inline.ts", "create"],
      ["src/parserx/a.ts", "create"],
    ]);
    const rows = impact([
      ["./src/parser/", "modify"],
      ["docs/guide/", "modify"],
    ]);
    expect(deviationsFor(changed, rows, [])).toEqual([
      { path: "docs/guide", kind: "planned-unchanged", reason: "" },
      { path: "src/parser.ts", kind: "unplanned-modify", reason: "" },
      { path: "src/parserx/a.ts", kind: "unplanned-create", reason: "" },
    ]);
  });
});

const DIR = ".azimuth/features/F-001-thing";
const AS_BUILT = `${DIR}/as-built.md`;
const NOW = new Date("2026-10-20T09:00:00Z");

const EXAMPLE_IMPACT = [
  { path: "src/a.ts", change: "create" },
  { path: "src/b.ts", change: "modify" },
  { path: "src/c.ts", change: "modify" },
  { path: "test/a.test.ts", change: "test" },
  { path: "src/types.ts", change: "read" },
];

/**
 * contract.md's example project: F-001 (verifying unless `status` says otherwise) with its impact
 * rows, committed as `chore: start`, then `feat(F-001): add a` with `Refs: T-001.1`.
 */
function example(opts: { status?: string; config?: string } = {}) {
  const tree = writeTree({
    ".gitignore": ".azimuth/cache/\n",
    ".azimuth/config.yaml": opts.config ?? MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: opts.status ?? "verifying", impact: EXAMPLE_IMPACT }),
    "src/b.ts": "export const b = 1;\n",
    "src/c.ts": "export const c = 1;\n",
    "src/types.ts": "export type T = number;\n",
  });
  cleanup = tree.cleanup;
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
  tree.write("src/a.ts", "export const a = 1;\n");
  tree.write("src/extra.ts", "export const extra = 1;\n");
  tree.write("test/a.test.ts", 'it("S-001.1.1 works", () => {});\n');
  tree.write("src/b.ts", "export const b = 2;\n");
  appendFileSync(join(tree.root, DIR, "plan.md"), "Planned.\n");
  const sha = commitAll(tree.root, "feat(F-001): add a\n\nRefs: T-001.1");
  return { ...tree, sha };
}

const EXAMPLE_FILES: FileChange[] = [
  { path: "src/a.ts", change: "create" },
  { path: "src/b.ts", change: "modify" },
  { path: "src/extra.ts", change: "create" },
  { path: "test/a.test.ts", change: "create" },
];

const EXAMPLE_FILE_LINES = [
  "  - { path: src/a.ts, change: create }",
  "  - { path: src/b.ts, change: modify }",
  "  - { path: src/extra.ts, change: create }",
  "  - { path: test/a.test.ts, change: create }",
];

const EXAMPLE_DEVIATION_LINES = [
  '  - { path: src/c.ts, kind: planned-unchanged, reason: "" }',
  '  - { path: src/extra.ts, kind: unplanned-create, reason: "" }',
];

const EXAMPLE = [
  "---",
  "completed_at: 2026-10-20",
  "files_changed:",
  ...EXAMPLE_FILE_LINES,
  "deviations:",
  ...EXAMPLE_DEVIATION_LINES,
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

const EXAMPLE_MESSAGE =
  "Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 2 without a reason.\n" +
  "Needs a reason: src/c.ts (planned-unchanged), src/extra.ts (unplanned-create)";

const readAsBuilt = (root: string) => readFileSync(join(root, AS_BUILT), "utf8");

/** The lines of a frontmatter list written in block style, from `<key>:` to the next key. */
function listLines(text: string, key: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`${key}:`);
  if (start === -1) return [];
  const end = lines.findIndex((line, i) => i > start && !line.startsWith("  - "));
  return lines.slice(start + 1, end);
}

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

describe("the feature's commits", () => {
  it("S-021.2.1 counts a commit by its Refs trailer, else by its scope", () => {
    const tree = writeTree({ "src/b.ts": "export const b = 1;\n" });
    cleanup = tree.cleanup;
    const { root, write } = tree;
    initRepo(root);
    commitAll(root, "chore: start");
    write("src/a.ts", "export const a = 1;\n");
    const one = commitAll(root, "feat(F-001): add a\n\nRefs: T-001.1");
    write("test/a.test.ts", 'it("S-001.1.2 handles the empty case", () => {});\n');
    const two = commitAll(root, "test: cover the empty case\n\nRefs: S-001.1.2");
    write("src/b.ts", "export const b = 2;\n");
    const three = commitAll(root, "fix(F-001): tidy");
    write("src/c.ts", "export const c = 1;\n");
    commitAll(root, "feat(F-001): borrow\n\nRefs: T-002.1");
    write("src/d.ts", "export const d = 1;\n");
    commitAll(root, "chore: other\n\nRefs: F-002");
    write("docs/slow.md", "Because.\n");
    commitAll(root, "docs: say why F-001 is slow");

    expect(readFeatureCommits(root, "F-001")).toEqual([
      {
        sha: one,
        subject: "feat(F-001): add a",
        refs: ["T-001.1"],
        changes: [{ status: "A", path: "src/a.ts" }],
      },
      {
        sha: two,
        subject: "test: cover the empty case",
        refs: ["S-001.1.2"],
        changes: [{ status: "A", path: "test/a.test.ts" }],
      },
      {
        sha: three,
        subject: "fix(F-001): tidy",
        refs: ["F-001"],
        changes: [{ status: "M", path: "src/b.ts" }],
      },
    ]);
    expect([one, two, three].map((sha) => sha.length)).toEqual([7, 7, 7]);
  });

  it("S-021.2.2 reads commits older than git.log_depth", () => {
    const { root, write, sha } = example({ config: MINIMAL_CONFIG + "git:\n  log_depth: 1\n" });
    for (const n of [1, 2, 3]) {
      write("src/other.ts", `export const other = ${n};\n`);
      commitAll(root, `chore: ${n}`);
    }
    const result = writeAsBuilt(root, "F-001", { now: NOW });
    expect(result.commits).toEqual([sha]);
    expect(result.files_changed).toEqual(EXAMPLE_FILES);
  });

  it("S-021.2.3 turns a rename into a delete and a create", () => {
    const tree = writeTree({
      ".gitignore": ".azimuth/cache/\n",
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({
        id: "F-001",
        status: "verifying",
        impact: [{ path: "src/new.ts", change: "create" }],
      }),
      "src/old.ts": "export const parse = () => 1;\n",
    });
    cleanup = tree.cleanup;
    const { root } = tree;
    initRepo(root);
    commitAll(root, "chore: start");
    git(root, ["mv", "src/old.ts", "src/new.ts"]);
    commitAll(root, "refactor(F-001): rename the parser\n\nRefs: T-001.2");

    const result = writeAsBuilt(root, "F-001", { now: NOW });
    expect(result.files_changed).toEqual([
      { path: "src/new.ts", change: "create" },
      { path: "src/old.ts", change: "delete" },
    ]);
    expect(result.deviations).toEqual([
      { path: "src/old.ts", kind: "unplanned-delete", reason: "" },
    ]);
  });
});

describe("as-built.md", () => {
  it("S-021.4.1 writes the first draft, then leaves it as it is", () => {
    const { root, sha } = example();
    const result = writeAsBuilt(root, "F-001", { now: NOW });
    expect(readAsBuilt(root)).toBe(EXAMPLE);
    expect(result).toEqual({
      feature: "F-001",
      file: AS_BUILT,
      created: true,
      commits: [sha],
      files_changed: EXAMPLE_FILES,
      deviations: [
        { path: "src/c.ts", kind: "planned-unchanged", reason: "" },
        { path: "src/extra.ts", kind: "unplanned-create", reason: "" },
      ],
      unexplained: [
        { path: "src/c.ts", kind: "planned-unchanged" },
        { path: "src/extra.ts", kind: "unplanned-create" },
      ],
      message: EXAMPLE_MESSAGE,
    });

    const again = writeAsBuilt(root, "F-001", { now: NOW });
    expect(readAsBuilt(root)).toBe(EXAMPLE);
    expect(again.created).toBe(false);
  });

  it("S-021.4.2 keeps reasons, hand-written deviations, follow-ups and the body on a rerun", () => {
    const { root, write } = example();
    const body = "# F-001: As built\n\n## Summary\nBuilt it.\n";
    write(
      AS_BUILT,
      [
        "---",
        "completed_at: 2026-10-19",
        "files_changed: []",
        "deviations:",
        "  - { path: src/extra.ts, kind: unplanned-create, reason: Split out for testability }",
        "  - { path: src/gone.ts, kind: unplanned-create, reason: Removed later }",
        "  - { path: src/a.ts, kind: clarification, reason: Parses lazily }",
        "follow_ups: [DEBT-0002]",
        "---",
        body,
      ].join("\n"),
    );

    const result = writeAsBuilt(root, "F-001", { now: NOW });
    const text = readAsBuilt(root);
    expect(listLines(text, "deviations")).toEqual([
      '  - { path: src/c.ts, kind: planned-unchanged, reason: "" }',
      "  - { path: src/extra.ts, kind: unplanned-create, reason: Split out for testability }",
      "  - { path: src/a.ts, kind: clarification, reason: Parses lazily }",
    ]);
    expect(text.split("\n")).toContain("completed_at: 2026-10-20");
    expect(listLines(text, "files_changed")).toEqual(EXAMPLE_FILE_LINES);
    expect(text.split("\n")).toContain("follow_ups: [DEBT-0002]");
    expect(text.slice(text.indexOf("\n---\n") + "\n---\n".length)).toBe(body);
    expect(result.created).toBe(false);
    expect(result.unexplained).toEqual([{ path: "src/c.ts", kind: "planned-unchanged" }]);
  });

  it("S-021.4.3 keeps a reason only for the same path and kind", () => {
    const { root, write } = example();
    write(
      AS_BUILT,
      [
        "---",
        "completed_at: 2026-10-19",
        "files_changed: []",
        "deviations:",
        "  - { path: src/extra.ts, kind: unplanned-modify, reason: Was there before }",
        "  - { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }",
        "follow_ups: []",
        "---",
        "",
      ].join("\n"),
    );

    writeAsBuilt(root, "F-001", { now: NOW });
    expect(listLines(readAsBuilt(root), "deviations")).toEqual([
      "  - { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }",
      '  - { path: src/extra.ts, kind: unplanned-create, reason: "" }',
    ]);
  });

  it("S-021.4.4 keeps a done feature's completed_at", () => {
    const { root, write } = example({ status: "done" });
    write(
      AS_BUILT,
      "---\ncompleted_at: 2026-10-02\nfiles_changed: []\ndeviations: []\nfollow_ups: []\n---\n",
    );

    writeAsBuilt(root, "F-001", { now: NOW });
    const text = readAsBuilt(root);
    expect(text.split("\n")).toContain("completed_at: 2026-10-02");
    expect(text.split("\n")).not.toContain("completed_at: 2026-10-20");
    expect(listLines(text, "files_changed")).toEqual(EXAMPLE_FILE_LINES);
    expect(listLines(text, "deviations")).toEqual(EXAMPLE_DEVIATION_LINES);
  });

  it("S-021.4.5 refuses an as-built.md whose frontmatter doesn't parse", () => {
    const { root, write } = example();
    const broken = "---\ndeviations: [\n---\nKeep me.\n";
    write(AS_BUILT, broken);

    const error = errorOf(() => writeAsBuilt(root, "F-001", { now: NOW }));
    expect(error.code).toBe("invalid");
    expect(error.message).toBe(
      ".azimuth/features/F-001-thing/as-built.md has invalid frontmatter. Fix it (azimuth check F-001 shows where), then run azimuth as-built F-001 again.",
    );
    expect(readAsBuilt(root)).toBe(broken);
  });
});
