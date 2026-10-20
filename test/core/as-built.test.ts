import { describe, expect, it } from "vitest";
import { deviationsFor, filesChanged, type FileChange } from "../../src/core/as-built";
import type { ImpactChange } from "../../src/core/types";

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
