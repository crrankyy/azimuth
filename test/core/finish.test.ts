import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  finishTask,
  selectPaths,
  withRefsTrailer,
  type FinishOptions,
  type FinishResult,
} from "../../src/core/finish";
import { loadProject } from "../../src/core/model";
import { parseLog } from "../../src/core/parse/log";
import { commitAll, git, gitEnv, initRepo } from "../helpers/git";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const DIR = ".azimuth/features/F-001-thing/";

describe("ST-009.1 withRefsTrailer", () => {
  it("S-009.1.1 adds a Refs paragraph to a subject-only message", () => {
    expect(withRefsTrailer("feat(F-001): add a", "T-001.1")).toBe(
      "feat(F-001): add a\n\nRefs: T-001.1",
    );
  });

  it("S-009.1.2 puts Refs first in an existing trailer block", () => {
    const message =
      "feat(F-001): add a\n\nWhy it matters.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n";
    expect(withRefsTrailer(message, "T-001.1")).toBe(
      "feat(F-001): add a\n\nWhy it matters.\n\nRefs: T-001.1\nCo-Authored-By: Claude <noreply@anthropic.com>",
    );
  });

  it("S-009.1.3 keeps a message that has a Refs line in any case", () => {
    const message = "fix(F-001): handle empty input\n\nrefs: T-001.1, T-001.2\n";
    expect(withRefsTrailer(message, "T-001.1")).toBe(
      "fix(F-001): handle empty input\n\nrefs: T-001.1, T-001.2",
    );
  });

  it("S-009.1.4 adds a new paragraph after a last paragraph of prose", () => {
    const message = "feat(F-001): add a\n\nNote: the parser counts the BOM.\nIt starts at byte 3.";
    expect(withRefsTrailer(message, "T-001.1")).toBe(
      "feat(F-001): add a\n\nNote: the parser counts the BOM.\nIt starts at byte 3.\n\nRefs: T-001.1",
    );
  });
});

describe("ST-009.2 selectPaths", () => {
  it("S-009.2.1 stages the task's files and the feature's records and lists the rest", () => {
    const changed = [
      "src/a.ts",
      "src/other.ts",
      "test/a.test.ts",
      `${DIR}plan.md`,
      ".azimuth/features/F-002-more/log.md",
    ];
    expect(selectPaths(changed, { files: ["src/a.ts", "test/a.test.ts"] }, DIR)).toEqual({
      staged: [`${DIR}plan.md`, "src/a.ts", "test/a.test.ts"],
      not_staged: [".azimuth/features/F-002-more/log.md", "src/other.ts"],
    });
  });

  it("S-009.2.2 matches a directory entry only to the files under it", () => {
    const changed = ["src/parser/inline.ts", "src/parser.ts", "src/parserx/a.ts"];
    expect(selectPaths(changed, { files: ["./src/parser/"] }, DIR)).toEqual({
      staged: ["src/parser/inline.ts"],
      not_staged: ["src/parser.ts", "src/parserx/a.ts"],
    });
  });

  it("S-009.2.3 stages only the records for a task without files", () => {
    const changed = ["src/a.ts", `${DIR}notes.md`];
    expect(selectPaths(changed, { files: [] }, DIR)).toEqual({
      staged: [`${DIR}notes.md`],
      not_staged: ["src/a.ts"],
    });
  });
});

// A sleep whose argument no other process has, so stray children can be found and killed.
const LONG_SLEEP = `sleep 60.${process.pid}${Date.now() % 100_000}`;
const MESSAGE = "feat(F-001): add a";

let root = "";
let cleanup: (() => void) | null = null;

/** Stories of F-001; `then2` null leaves S-001.1.2 without a THEN line. */
function stories(then1 = "c = 1", then2: string | null = "c = 1"): string {
  return [
    "## ST-001.1 · Story",
    "**Intent:** As a user, I want it so that it works.",
    "",
    "### S-001.1.1 · Scenario {happy}",
    "- **GIVEN** a",
    "- **WHEN** b",
    `- **THEN** ${then1}`,
    "",
    "### S-001.1.2 · Scenario {negative}",
    "- **GIVEN** a",
    "- **WHEN** b",
    ...(then2 === null ? [] : [`- **THEN** ${then2}`]),
    "",
  ].join("\n");
}

const T1: TaskSpec = {
  id: "T-001.1",
  status: "in-progress",
  covers: ["S-001.1.1", "S-001.1.2"],
  files: ["src/a.ts", "test/a.test.ts"],
  verify: "echo S-001.1.1 ok",
};

interface RepoOptions {
  tasks?: TaskSpec[];
  stories?: string;
  /** config.yaml's verify section. */
  verify?: string;
  files?: Record<string, string>;
}

/** A git repository whose HEAD holds the project of ST-009.3 to ST-009.5. */
function repo(options: RepoOptions = {}): string {
  const config = options.verify ? `${MINIMAL_CONFIG}verify:\n${options.verify}` : MINIMAL_CONFIG;
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    ".gitignore": ".azimuth/cache/\n",
    "src/a.ts": "export const a = 0;\n",
    "test/a.test.ts": 'it("S-001.1.1 works", () => {});\n',
    "src/other.ts": "export const other = 0;\n",
    ...featureFiles({ id: "F-001", status: "in-progress", tasks: options.tasks ?? [T1] }),
    [`${DIR}stories.md`]: options.stories ?? stories(),
    ...options.files,
  });
  cleanup = tree.cleanup;
  root = tree.root;
  initRepo(root);
  commitAll(root, "chore: start");
  return root;
}

const write = (path: string, content: string) => writeFileSync(join(root, path), content);
const read = (path: string) => readFileSync(join(root, path), "utf8");

function changeTaskFiles(): void {
  write("src/a.ts", "export const a = 1;\n");
  write("test/a.test.ts", 'it("S-001.1.1 works", () => { expect(a).toBe(1); });\n');
}

/** git's stdout as printed, without trimming (porcelain lines start with a space). */
const gitRaw = (args: string[]) =>
  execFileSync("git", args, { cwd: root, env: gitEnv(), encoding: "utf8" });
const head = () => git(root, ["rev-parse", "--short=7", "HEAD"]);
const headSubject = () => git(root, ["log", "-1", "--format=%s"]);
const headFiles = (rev = "HEAD") =>
  git(root, ["show", "--name-only", "--format=", rev]).split("\n").filter(Boolean);
const cached = () => git(root, ["diff", "--cached", "--name-only"]);
const runFiles = () => {
  const dir = join(root, ".azimuth/cache/runs");
  return existsSync(dir) ? readdirSync(dir) : [];
};
const runJson = (id: string) =>
  JSON.parse(read(`.azimuth/cache/runs/${id}.json`)) as Record<string, unknown>;
const taskStatus = (id: string) =>
  loadProject(root)
    .features.find((f) => f.id === "F-001")
    ?.tasks.find((t) => t.id === id)?.status;
const lastLogBody = () => parseLog(read(`${DIR}log.md`), `${DIR}log.md`).entries.at(-1)?.body;
const steps = (result: FinishResult) => result.steps.map((s) => `${s.step} ${s.status}`).join(", ");
const step = (result: FinishResult, name: string) => result.steps.find((s) => s.step === name);

const finish = (taskId = "T-001.1", opts: Partial<FinishOptions> = {}) =>
  finishTask(root, taskId, { message: MESSAGE, actor: "agent", ...opts });

async function until<T>(get: () => T | null, what: string, deadlineMs = 5_000): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const value = get();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function childPid(): number | null {
  if (!existsSync(join(root, "child.pid"))) return null;
  const pid = Number(read("child.pid").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** The error `process.kill(pid, 0)` throws once the process is gone; polled, since reaping lags. */
function killError(pid: number): Promise<NodeJS.ErrnoException> {
  return until(() => {
    try {
      process.kill(pid, 0);
      return null;
    } catch (error) {
      return error as NodeJS.ErrnoException;
    }
  }, `process ${pid} to exit`);
}

describe("finishTask against real git", () => {
  beforeEach(() => {
    // finishTask runs git with the process environment: keep the developer's hooks and signing out.
    for (const [key, value] of Object.entries(gitEnv())) {
      if (key.startsWith("GIT_") && value !== undefined) vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    spawnSync("pkill", ["-KILL", "-f", LONG_SLEEP]);
    vi.unstubAllEnvs();
    cleanup?.();
    cleanup = null;
  });

  describe("ST-009.3 one call commits, verifies and finishes a task", () => {
    it("S-009.3.1 commits the task's files, verifies and moves the task to done", async () => {
      repo();
      changeTaskFiles();
      write("src/other.ts", "export const other = 1;\n");
      const result = await finish();
      const sha = head();
      expect(result.ok).toBe(true);
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify done, done done, log done",
      );
      expect(git(root, ["log", "-1", "--format=%B"])).toBe("feat(F-001): add a\n\nRefs: T-001.1");
      expect(headFiles()).toEqual(["src/a.ts", "test/a.test.ts"]);
      expect(result.run).toBe("R-0001");
      expect(runJson("R-0001")).toMatchObject({ target: "T-001.1", ok: true, commit: sha });
      expect(taskStatus("T-001.1")).toBe("done");
      expect(lastLogBody()).toBe(`T-001.1: in-progress → done. Committed ${sha}; R-0001 passed.`);
      expect(result.not_staged).toEqual(["src/other.ts"]);
      expect(gitRaw(["status", "--porcelain"]).split("\n")).toContain(" M src/other.ts");
    });

    it("S-009.3.2 commits the note and the feature's changed records with the task", async () => {
      repo({ stories: stories("c = {?}") });
      changeTaskFiles();
      write(`${DIR}stories.md`, stories("c = {=1}"));
      const result = await finish("T-001.1", {
        note: "Counts the BOM.",
        now: new Date("2026-10-20T09:00:00Z"),
      });
      expect(steps(result)).toBe(
        "check done, note done, stage done, commit done, verify done, done done, log done",
      );
      expect(headFiles()).toEqual([
        `${DIR}notes.md`,
        `${DIR}stories.md`,
        "src/a.ts",
        "test/a.test.ts",
      ]);
      expect(
        gitRaw(["show", `HEAD:${DIR}notes.md`]).endsWith(
          "### T-001.1 · 2026-10-20\n\nCounts the BOM.\n",
        ),
      ).toBe(true);
    });

    it("S-009.3.3 commits a shared file whole with the first task that lists it", async () => {
      repo({
        tasks: [
          { ...T1, covers: ["S-001.1.1"], files: ["src/registry.ts", "src/a.ts"] },
          {
            id: "T-001.2",
            status: "in-progress",
            covers: ["S-001.1.2"],
            files: ["src/registry.ts", "src/b.ts"],
            verify: "echo S-001.1.2 ok",
          },
        ],
        files: {
          "src/registry.ts": "export const all = [\n];\n",
          "src/b.ts": "export const b = 0;\n",
        },
      });
      write("src/registry.ts", "export const all = [\n  a,\n  b,\n];\n");
      write("src/a.ts", "export const a = 1;\n");
      write("src/b.ts", "export const b = 1;\n");
      const first = await finish("T-001.1", { message: "feat(F-001): add a" });
      const firstSha = head();
      const second = await finish("T-001.2", { message: "feat(F-001): add b" });
      expect([first.ok, second.ok]).toEqual([true, true]);
      expect(headFiles(firstSha)).toEqual(["src/a.ts", "src/registry.ts"]);
      const registry = git(root, ["show", `${firstSha}:src/registry.ts`]);
      expect([registry.includes("a,"), registry.includes("b,")]).toEqual([true, true]);
      expect(headFiles()).toEqual([
        `${DIR}feature.md`,
        `${DIR}log.md`,
        `${DIR}plan.md`,
        "src/b.ts",
      ]);
      expect([taskStatus("T-001.1"), taskStatus("T-001.2")]).toEqual(["done", "done"]);
    });
  });

  describe("ST-009.4 finish stops at the first failure", () => {
    it("S-009.4.1 passes the check with warnings", async () => {
      repo({ stories: stories("c = 1", "it works correctly") });
      changeTaskFiles();
      const result = await finish();
      expect(result.ok).toBe(true);
      expect(step(result, "check")).toEqual({
        step: "check",
        status: "done",
        detail: "F-001 has no errors",
        output: "",
      });
    });

    it("S-009.4.2 stops at an error in the feature before anything changes", async () => {
      repo({ stories: stories("c = 1", null) });
      changeTaskFiles();
      const before = head();
      const result = await finish("T-001.1", { note: "Counts the BOM." });
      expect(result.ok).toBe(false);
      expect(steps(result)).toBe(
        "check failed, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "check")?.detail).toBe("F-001 has 1 error");
      expect(step(result, "check")?.output).toContain("S-001.1.2 is missing THEN.");
      expect([head(), cached()]).toEqual([before, ""]);
      expect(existsSync(join(root, `${DIR}notes.md`))).toBe(false);
      expect(runFiles()).toEqual([]);
    });

    it("S-009.4.3 refuses a task that isn't in progress", async () => {
      repo({ tasks: [{ ...T1, status: "todo" }] });
      changeTaskFiles();
      const result = await finish();
      expect(step(result, "check")).toMatchObject({
        status: "failed",
        detail:
          "T-001.1 is todo. Move it to in-progress first (`azimuth move T-001.1 in-progress`).",
      });
      expect(steps(result)).toBe(
        "check failed, stage not-run, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(cached()).toBe("");
    });

    it("S-009.4.4 refuses when something else is already staged", async () => {
      repo();
      changeTaskFiles();
      write("src/other.ts", "export const other = 1;\n");
      git(root, ["add", "src/other.ts"]);
      const result = await finish();
      expect(step(result, "check")).toMatchObject({
        status: "failed",
        detail:
          "Already staged, but not T-001.1's files or F-001's records: src/other.ts. Unstage them (git restore --staged <path>) or commit them first.",
      });
      expect(cached()).toBe("src/other.ts");
    });

    it("S-009.4.5 fails the stage step when nothing of the task changed", async () => {
      repo();
      write("src/other.ts", "export const other = 1;\n");
      const before = head();
      const result = await finish();
      expect(steps(result)).toBe(
        "check done, stage failed, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "stage")?.detail).toBe(
        "Nothing to commit: none of T-001.1's files and none of F-001's records changed.",
      );
      expect(result.not_staged).toEqual(["src/other.ts"]);
      expect(head()).toBe(before);
      expect(taskStatus("T-001.1")).toBe("in-progress");
    });

    it("S-009.4.6 stops at a failing pre-commit hook", async () => {
      repo();
      changeTaskFiles();
      const hook = join(root, ".git/hooks/pre-commit");
      writeFileSync(hook, "#!/bin/sh\necho lint failed\nexit 1\n");
      chmodSync(hook, 0o755);
      const before = head();
      const result = await finish();
      expect(steps(result)).toBe(
        "check done, stage done, commit failed, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "commit")?.detail).toBe("git commit failed (exit 1)");
      expect(step(result, "commit")?.output).toContain("lint failed");
      expect(head()).toBe(before);
      expect(cached()).toBe("src/a.ts\ntest/a.test.ts");
      expect(runFiles()).toEqual([]);
    });
  });

  describe("ST-009.5 the verify run decides done", () => {
    it("S-009.5.1 finishes a fixed task on the second call", async () => {
      repo({ tasks: [{ ...T1, verify: "grep -q fixed src/a.ts && echo S-001.1.1 ok" }] });
      write("src/a.ts", "export const a = 'broken';\n");
      const broken = await finish();
      expect([broken.ok, broken.run, runJson("R-0001").ok]).toEqual([false, "R-0001", false]);
      write("src/a.ts", "export const a = 'fixed';\n");
      const result = await finish("T-001.1", { message: "fix(F-001): fix a" });
      expect(result.ok).toBe(true);
      expect(headSubject()).toBe("fix(F-001): fix a");
      expect(headFiles()).toEqual([`${DIR}log.md`, "src/a.ts"]);
      expect(runJson("R-0002").ok).toBe(true);
      expect(taskStatus("T-001.1")).toBe("done");
    });

    it("S-009.5.2 keeps the commit after a failing verify", async () => {
      repo({ tasks: [{ ...T1, verify: "echo S-001.1.1 boom; exit 1" }] });
      changeTaskFiles();
      const result = await finish();
      const sha = head();
      expect(result.ok).toBe(false);
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify failed, done not-run, log done",
      );
      expect(step(result, "verify")?.detail).toMatch(/^R-0001 failed \(exit 1\) in \d+\.\ds$/);
      expect(step(result, "verify")?.output).toBe("S-001.1.1 boom");
      expect(headSubject()).toBe(MESSAGE);
      expect(taskStatus("T-001.1")).toBe("in-progress");
      expect(lastLogBody()).toBe(`T-001.1: Committed ${sha}; R-0001 failed (exit 1).`);
    });

    it("S-009.5.3 records no run after a failed prebuild", async () => {
      repo({ verify: '  prebuild: "echo no compiler; exit 2"\n' });
      changeTaskFiles();
      const result = await finish();
      const sha = head();
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify failed, done not-run, log done",
      );
      expect(step(result, "verify")?.detail).toMatch(/^prebuild failed \(exit 2\) in \d+\.\ds$/);
      expect(step(result, "verify")?.output).toBe("no compiler");
      expect(result.run).toBeNull();
      expect(runFiles()).toEqual([]);
      expect(taskStatus("T-001.1")).toBe("in-progress");
      expect(lastLogBody()).toBe(`T-001.1: Committed ${sha}; prebuild failed (exit 2).`);
    });

    it("S-009.5.4 stops after an interrupted verify and logs nothing", async () => {
      repo({ tasks: [{ ...T1, verify: `${LONG_SLEEP} & echo $! > child.pid; wait` }] });
      changeTaskFiles();
      const logBefore = read(`${DIR}log.md`);
      const controller = new AbortController();
      const running = finish("T-001.1", { signal: controller.signal });
      const pid = await until(childPid, "child.pid");
      controller.abort();
      const result = await running;
      expect([result.interrupted, result.ok]).toEqual([true, false]);
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify failed, done not-run, log not-run",
      );
      expect(step(result, "verify")?.detail).toBe("interrupted");
      expect(headSubject()).toBe(MESSAGE);
      expect(runFiles()).toEqual([]);
      expect(taskStatus("T-001.1")).toBe("in-progress");
      expect(read(`${DIR}log.md`)).toBe(logBefore);
      expect((await killError(pid)).code).toBe("ESRCH");
    });
  });
});
