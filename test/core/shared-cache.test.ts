import { realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gitCommonDir, gitTopLevel } from "../../src/core/git";
import { appendLive } from "../../src/core/live";
import { sharedCacheDir } from "../../src/core/lock";
import { commitAll, git, initRepo } from "../helpers/git";
import { writeTree } from "../helpers/tree";

// Each helper call starts one git process, so counting calls counts processes.
vi.mock("../../src/core/git", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/git")>();
  return {
    ...actual,
    gitCommonDir: vi.fn(actual.gitCommonDir),
    gitTopLevel: vi.fn(actual.gitTopLevel),
  };
});

const cleanups: (() => void)[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function dir(): string {
  const tree = writeTree({});
  cleanups.push(tree.cleanup);
  return tree.root;
}

function repo(): string {
  const root = dir();
  initRepo(root);
  commitAll(root, "init");
  return root;
}

const gitCalls = () => ({
  commonDir: vi.mocked(gitCommonDir).mock.calls.length,
  topLevel: vi.mocked(gitTopLevel).mock.calls.length,
});

describe("BUG-0073 shared cache directory lookups", () => {
  it("BUG-0073 works out the shared cache directory once per root", () => {
    const main = repo();
    const worktree = join(dir(), "wt");
    git(main, ["worktree", "add", "-q", worktree]);
    const expected = join(realpathSync(main), ".azimuth", "cache");

    const answers = [
      sharedCacheDir(worktree),
      sharedCacheDir(`${worktree}/`),
      sharedCacheDir(worktree),
    ];

    expect(answers).toEqual([expected, expected, expected]);
    expect(gitCalls()).toEqual({ commonDir: 1, topLevel: 1 });
  });

  it("BUG-0073 looks a second root up on its own", () => {
    const first = repo();
    const second = repo();

    sharedCacheDir(first);
    sharedCacheDir(second);
    sharedCacheDir(first);

    expect(sharedCacheDir(second)).toBe(join(realpathSync(second), ".azimuth", "cache"));
    expect(gitCalls()).toEqual({ commonDir: 2, topLevel: 2 });
  });

  it("BUG-0073 remembers a directory outside git as well", () => {
    const root = dir();

    sharedCacheDir(root);

    expect(sharedCacheDir(root)).toBe(join(root, ".azimuth", "cache"));
    expect(gitCalls()).toEqual({ commonDir: 1, topLevel: 1 });
  });

  it("BUG-0073 appends 100 live events with one git lookup", () => {
    const root = repo();

    for (let i = 0; i < 100; i++)
      appendLive(root, "claude-1", { kind: "stop", at: "2026-10-20T09:00:00Z" });

    expect(gitCalls()).toEqual({ commonDir: 1, topLevel: 1 });
  });
});
