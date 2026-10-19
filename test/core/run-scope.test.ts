import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/core/config";
import type { ImpactRaw } from "../../src/core/parse/feature";
import { inScope, runScope, type RunScope } from "../../src/core/run-scope";
import type { ImpactChange, Module } from "../../src/core/types";

const impact = (entries: [string, ImpactChange][]): { impact: ImpactRaw[] } => ({
  impact: entries.map(([path, change]) => ({ path, change, note: "", symbols: [] })),
});
const mod = (name: string, path: string, depends_on: string[] = []): Module => ({
  name,
  path,
  responsibility: "",
  depends_on,
});
const DEFAULT_SHARED = DEFAULT_CONFIG.verify.shared_paths;

/** The paths of `candidates` that fall in `scope`. */
const covered = (scope: RunScope | null, candidates: string[]) =>
  candidates.filter((p) => scope !== null && inScope(p, scope));

describe("a run's own paths", () => {
  it("S-006.1.1 counts the task's files and the feature's changed impact paths", () => {
    const scope = runScope(
      { files: ["src/a.ts"] },
      impact([
        ["src/b.ts", "create"],
        ["test/a.test.ts", "test"],
        ["src/c.ts", "read"],
      ]),
      [],
      [],
    );
    expect(
      covered(scope, ["src/a.ts", "src/b.ts", "test/a.test.ts", "src/c.ts", "src/d.ts"]),
    ).toEqual(["src/a.ts", "src/b.ts", "test/a.test.ts"]);
  });

  it("S-006.1.2 lets a path naming a directory cover everything under it", () => {
    const scope = runScope({ files: ["src/parser/", "./docs/guide.md"] }, impact([]), [], []);
    expect(
      covered(scope, [
        "src/parser",
        "src/parser/inline/emph.ts",
        "docs/guide.md",
        "src/parserx/a.ts",
        "src/parser.ts",
      ]),
    ).toEqual(["src/parser", "src/parser/inline/emph.ts", "docs/guide.md"]);
  });

  it("S-006.1.3 has no scope without paths of its own", () => {
    const scope = runScope(
      { files: [] },
      impact([["src/c.ts", "read"]]),
      [mod("core", "src/core")],
      DEFAULT_SHARED,
    );
    expect(scope).toBeNull();
  });
});

describe("module dependencies and shared files", () => {
  it("S-006.2.1 adds the paths of the modules the feature's modules depend on", () => {
    const scope = runScope(
      { files: ["src/editor/view.rs"] },
      impact([["src/editor/view.rs", "modify"]]),
      [
        mod("editor", "src/editor", ["buffer"]),
        mod("buffer", "src/buffer"),
        mod("search", "src/search"),
      ],
      [],
    );
    expect(
      covered(scope, [
        "src/buffer/gap.rs",
        "src/buffer.rs",
        "src/editor/cursor.rs",
        "src/search/index.rs",
      ]),
    ).toEqual(["src/buffer/gap.rs", "src/buffer.rs"]);
  });

  it("S-006.2.2 brings in no dependencies through test and read entries", () => {
    const scope = runScope(
      { files: [] },
      impact([
        ["src/editor/view.rs", "modify"],
        ["tests/view.rs", "test"],
        ["src/search/index.rs", "read"],
      ]),
      [
        mod("editor", "src/editor"),
        mod("buffer", "src/buffer"),
        mod("tests", "tests", ["buffer"]),
        mod("search", "src/search", ["buffer"]),
      ],
      [],
    );
    expect(scope).not.toBeNull();
    expect(inScope("src/buffer/gap.rs", scope as RunScope)).toBe(false);
  });

  it("S-006.2.3 matches the default shared paths at the root only", () => {
    const scope = runScope({ files: ["src/a.ts"] }, impact([]), [], DEFAULT_SHARED);
    expect(
      covered(scope, [
        "Cargo.lock",
        "package.json",
        "crates/core/Cargo.toml",
        "viewer/package.json",
      ]),
    ).toEqual(["Cargo.lock", "package.json"]);
  });
});
