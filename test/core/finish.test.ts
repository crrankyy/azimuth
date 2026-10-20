import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  finishTask,
  selectPaths,
  sharedStaged,
  splitNotStaged,
  unlistedFiles,
  withRefsTrailer,
  type FinishOptions,
  type FinishResult,
  type UnlistedContext,
} from "../../src/core/finish";
import { acquireVerifyLock } from "../../src/core/lock";
import { loadProject } from "../../src/core/model";
import { parsePlan } from "../../src/core/parse/feature";
import { parseLog } from "../../src/core/parse/log";
import { moveTask } from "../../src/core/transitions";
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

const KEYMAP_HEAD = 'it("S-001.1.1 maps keys", () => {});\n';

/** S-019.1.1's context: T-001.1 of F-001, whose impact.md modifies src/c.ts and reads src/d.ts. */
function unlistedContext(
  others: UnlistedContext["others"],
  texts: Record<string, { working: string | null; head: string | null }>,
): UnlistedContext {
  return {
    task: { id: "T-001.1", files: ["src/a.ts"], covers: ["S-001.1.1", "S-001.1.2"] },
    feature: {
      id: "F-001",
      dir: DIR,
      impact: [
        { path: "src/c.ts", change: "modify", note: "", symbols: [] },
        { path: "src/d.ts", change: "read", note: "", symbols: [] },
      ],
    },
    others,
    testGlobs: ["test/**/*.test.ts"],
    texts: (path) => texts[path] ?? { working: null, head: null },
  };
}

describe("ST-019.1 unlistedFiles", () => {
  it("S-019.1.1 refuses a test adding a covered marker and an impact path no task lists", () => {
    const changed = [`${DIR}plan.md`, "src/a.ts", "src/c.ts", "src/d.ts", "test/keymap.test.ts"];
    const ctx = unlistedContext([], {
      "test/keymap.test.ts": {
        working: `${KEYMAP_HEAD}it("S-001.1.2 maps the palette", () => {});\n`,
        head: KEYMAP_HEAD,
      },
    });
    expect(unlistedFiles(changed, ctx)).toEqual([
      { path: "src/c.ts", reason: { kind: "impact", change: "modify" } },
      { path: "test/keymap.test.ts", reason: { kind: "marker", scenarios: ["S-001.1.2"] } },
    ]);
  });

  it("S-019.1.2 passes changes that add no covered marker or that another lane lists", () => {
    const changed = ["src/c.ts", "test/keymap.test.ts", "test/other.test.ts"];
    const ctx = unlistedContext([{ id: "T-002.1", files: ["src/c.ts"] }], {
      "test/keymap.test.ts": {
        working: `${KEYMAP_HEAD}it("S-001.1.1 maps more keys", () => {});\n`,
        head: KEYMAP_HEAD,
      },
      "test/other.test.ts": {
        working: '// S-001.1.2 is proved in keymap\nit("S-001.2.1 opens", () => {});\n',
        head: null,
      },
    });
    expect(unlistedFiles(changed, ctx)).toEqual([]);
  });
});

describe("ST-019.2 splitNotStaged and sharedStaged", () => {
  it("S-019.2.1 splits the paths left out into outside, other tasks' and records", () => {
    const notStaged = [
      ".azimuth/features/F-002-more/log.md",
      ".azimuth/sessions/SES-20261020-0900.md",
      "src/b.ts",
      "src/other.ts",
      "src/parser/x.ts",
    ];
    expect(
      splitNotStaged(notStaged, [{ files: ["src/b.ts"] }, { files: ["src/parser/"] }]),
    ).toEqual({
      outside: ["src/other.ts"],
      other_tasks: ["src/b.ts", "src/parser/x.ts"],
      records: [".azimuth/features/F-002-more/log.md", ".azimuth/sessions/SES-20261020-0900.md"],
    });
  });

  it("S-019.2.2 lets another task's directory entry claim only the files under it", () => {
    expect(
      splitNotStaged(["src/parser.ts", "src/parserx/a.ts"], [{ files: ["./src/parser/"] }]),
    ).toEqual({
      outside: ["src/parser.ts", "src/parserx/a.ts"],
      other_tasks: [],
      records: [],
    });
  });

  it("S-019.2.3 warns about a staged shared file that other lanes list", () => {
    const others = [
      { id: "T-001.2", files: ["src/registry.ts", "src/b.ts"] },
      { id: "T-002.1", files: ["src/registry.ts"] },
    ];
    expect(sharedStaged(["src/a.ts", "src/registry.ts"], ["src/registry.ts"], others)).toEqual([
      { path: "src/registry.ts", tasks: ["T-001.2", "T-002.1"] },
    ]);
  });

  it("S-019.2.4 gives no warning when no other lane lists the shared file", () => {
    const others = [{ id: "T-001.2", files: ["src/a.ts"] }];
    expect(sharedStaged(["src/a.ts", "src/registry.ts"], ["src/registry.ts"], others)).toEqual([]);
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
  /** F-001's impact.md entries; featureFiles' default (src/app.ts, modify) when absent. */
  impact?: { path: string; change: string }[];
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
    ...featureFiles({
      id: "F-001",
      status: "in-progress",
      tasks: options.tasks ?? [T1],
      impact: options.impact,
    }),
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
/** A file's bytes at HEAD, read raw, to compare with the working copy. */
const atHead = (path: string) => gitRaw(["show", `HEAD:${path}`]);
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

const KEYMAP = 'it("S-001.1.1 maps the default keys", () => {});\n';

/**
 * The project of F-019's stories: HEAD also holds src/c.ts and test/keymap.test.ts, and F-001's
 * impact.md modifies src/c.ts.
 */
function repo019(options: RepoOptions = {}): string {
  return repo({
    impact: [{ path: "src/c.ts", change: "modify" }],
    ...options,
    files: { "src/c.ts": "export const c = 0;\n", "test/keymap.test.ts": KEYMAP, ...options.files },
  });
}

/** The stray test (#2's repro): a marker for S-001.1.2, which T-001.1 covers, outside its files. */
const addStrayTest = () =>
  write("test/keymap.test.ts", `${KEYMAP}it("S-001.1.2 maps the palette keys", () => {});\n`);

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

  describe("BUG-0074 a rerun after a verify that failed outside the task", () => {
    it("BUG-0074 skips the commit, verifies and moves the task to done", async () => {
      repo({ tasks: [{ ...T1, verify: "grep -q fixed src/other.ts && echo S-001.1.1 ok" }] });
      changeTaskFiles();
      const first = await finish();
      const sha = head();
      expect([first.ok, step(first, "verify")?.status]).toEqual([false, "failed"]);
      // Another lane's fix, committed with the pending records (the failed run's log note).
      write("src/other.ts", "export const other = 'fixed';\n");
      const fixed = commitAll(root, "fix: repair the other lane");
      const result = await finish("T-001.1", { message: "feat(F-001): add a again" });
      expect(result.ok).toBe(true);
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify done, done done, log done",
      );
      expect(step(result, "stage")?.detail).toBe(
        "nothing left to stage: none of T-001.1's files and none of F-001's records changed",
      );
      expect(step(result, "commit")).toEqual({
        step: "commit",
        status: "done",
        detail: `skipped: ${sha} feat(F-001): add a already commits T-001.1`,
        output: "--commit message ignored: feat(F-001): add a again",
      });
      expect([result.commit, result.staged, result.run]).toEqual([sha, [], "R-0002"]);
      expect(head()).toBe(fixed);
      expect(runJson("R-0002").ok).toBe(true);
      expect(taskStatus("T-001.1")).toBe("done");
      expect(lastLogBody()).toBe(`T-001.1: in-progress → done. Committed ${sha}; R-0002 passed.`);
    });

    it("BUG-0074 has nothing to commit when the task's commit predates its move to in-progress", async () => {
      repo({ tasks: [{ ...T1, status: "todo" }] });
      changeTaskFiles();
      commitAll(root, "feat(F-001): add a\n\nRefs: T-001.1");
      moveTask(root, "T-001.1", "in-progress", { actor: "agent" });
      const before = commitAll(root, "chore(azimuth): start T-001.1");
      const result = await finish();
      expect(steps(result)).toBe(
        "check done, stage failed, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "stage")?.detail).toBe(
        "Nothing to commit: none of T-001.1's files and none of F-001's records changed.",
      );
      expect([head(), result.commit, taskStatus("T-001.1")]).toEqual([before, null, "in-progress"]);
    });
  });

  it("BUG-0075 says in the verify step's output that it waited for another verify", async () => {
    repo();
    changeTaskFiles();
    const held = await acquireVerifyLock(root);
    // finishTask runs synchronously up to its first wait for the lock, so it is waiting now.
    const running = finish();
    held?.release();
    const result = await running;
    expect(result.ok).toBe(true);
    expect(step(result, "verify")?.detail).toMatch(/^R-0001 passed in \d+\.\ds$/);
    expect(step(result, "verify")?.output).toMatch(/^waited \d+s for another verify$/);
  });

  describe("ST-019.3 finish refuses an unlisted file before it writes anything", () => {
    const CHECK_FAILED =
      "check failed, stage not-run, commit not-run, verify not-run, done not-run, log not-run";

    it("S-019.3.1 passes changes that need no decision and splits not staged by owner", async () => {
      const f002 = featureFiles({
        id: "F-002",
        slug: "more",
        status: "in-progress",
        tasks: [
          {
            id: "T-002.1",
            status: "in-progress",
            covers: ["S-002.1.1", "S-002.1.2"],
            files: ["src/c.ts"],
          },
        ],
      });
      repo019({ files: f002 });
      changeTaskFiles();
      write("test/keymap.test.ts", `${KEYMAP}it("S-001.1.1 maps more keys", () => {});\n`);
      write("src/c.ts", "export const c = 1;\n");
      write("src/other.ts", "export const other = 1;\n");
      const log = ".azimuth/features/F-002-more/log.md";
      write(log, `${read(log)}\n## 2026-10-20T09:00:00Z · agent · note\nLane note.\n`);
      const result = await finish();
      expect(result.ok).toBe(true);
      expect(steps(result)).toBe(
        "check done, stage done, commit done, verify done, done done, log done",
      );
      expect(headFiles()).toEqual(["src/a.ts", "test/a.test.ts"]);
      expect(result).toMatchObject({
        not_staged: [log, "src/c.ts", "src/other.ts", "test/keymap.test.ts"],
        not_staged_outside: ["src/other.ts", "test/keymap.test.ts"],
        not_staged_other_tasks: ["src/c.ts"],
        not_staged_records: [log],
        shared: [],
      });
    });

    it("S-019.3.2 refuses the stray test with a note given and writes nothing", async () => {
      repo019();
      changeTaskFiles();
      addStrayTest();
      const before = head();
      const result = await finish("T-001.1", { note: "Counts the BOM." });
      expect(result.ok).toBe(false);
      expect(steps(result)).toBe(
        "check failed, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "check")).toMatchObject({
        detail:
          "Changed outside T-001.1's files: test/keymap.test.ts. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.",
        output: "test/keymap.test.ts: adds a marker for S-001.1.2, which T-001.1 covers",
      });
      expect([head(), cached()]).toEqual([before, ""]);
      expect(existsSync(join(root, `${DIR}notes.md`))).toBe(false);
      expect(read(`${DIR}plan.md`)).toBe(atHead(`${DIR}plan.md`));
      expect(runFiles()).toEqual([]);
    });

    it("S-019.3.3 refuses an untracked test file that adds covered markers", async () => {
      repo019();
      changeTaskFiles();
      write(
        "test/palette.test.ts",
        'it("S-001.1.1 opens the palette", () => {});\nit("S-001.1.2 closes it", () => {});\n',
      );
      const result = await finish();
      expect(steps(result)).toBe(CHECK_FAILED);
      expect(step(result, "check")?.output).toBe(
        "test/palette.test.ts: adds markers for S-001.1.1, S-001.1.2, which T-001.1 covers",
      );
      expect(gitRaw(["status", "--porcelain"]).split("\n")).toContain("?? test/palette.test.ts");
    });

    it("S-019.3.4 refuses an impact path that only a todo task lists", async () => {
      repo019({
        tasks: [
          T1,
          { id: "T-001.2", status: "todo", covers: [], files: ["src/c.ts"], verify: "echo ok" },
        ],
      });
      changeTaskFiles();
      write("src/c.ts", "export const c = 1;\n");
      const result = await finish();
      expect(steps(result)).toBe(CHECK_FAILED);
      expect(step(result, "check")?.detail).toMatch(
        /^Changed outside T-001\.1's files: src\/c\.ts\./,
      );
      expect(step(result, "check")?.output).toBe(
        "src/c.ts: a modify path in F-001's impact.md that no in-progress task lists",
      );
    });
  });

  describe("ST-019.4 --adopt adds changed files to the task and commits them", () => {
    const PLAN = `${DIR}plan.md`;
    const ADOPT_REFUSED =
      "check failed, adopt not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run";
    const headTaskFiles = (id: string) =>
      parsePlan(atHead(PLAN), PLAN, "F-001").tasks.find((t) => t.id === id)?.files;

    it("S-019.4.1 commits the adopted stray test with the task and lists it in plan.md", async () => {
      repo019();
      changeTaskFiles();
      addStrayTest();
      const result = await finish("T-001.1", {
        adopt: ["test/keymap.test.ts"],
        note: "Counts the BOM.",
      });
      expect(result.ok).toBe(true);
      expect(steps(result)).toBe(
        "check done, adopt done, note done, stage done, commit done, verify done, done done, log done",
      );
      expect(step(result, "adopt")?.detail).toBe("added to T-001.1's files: test/keymap.test.ts");
      expect(headFiles()).toEqual([
        `${DIR}notes.md`,
        PLAN,
        "src/a.ts",
        "test/a.test.ts",
        "test/keymap.test.ts",
      ]);
      expect(headTaskFiles("T-001.1")).toEqual([
        "src/a.ts",
        "test/a.test.ts",
        "test/keymap.test.ts",
      ]);
    });

    it("S-019.4.2 refuses a test moved with mv under its new path, then adopts it", async () => {
      repo019();
      write("src/a.ts", "export const a = 1;\n");
      renameSync(join(root, "test/a.test.ts"), join(root, "test/parse.test.ts"));
      expect(gitRaw(["status", "--porcelain"]).split("\n")).toEqual(
        expect.arrayContaining([" D test/a.test.ts", "?? test/parse.test.ts"]),
      );
      const refused = await finish();
      expect(step(refused, "check")).toMatchObject({
        status: "failed",
        output: "test/parse.test.ts: adds a marker for S-001.1.1, which T-001.1 covers",
      });
      const result = await finish("T-001.1", { adopt: ["test/parse.test.ts"] });
      expect(result.ok).toBe(true);
      const nameStatus = gitRaw(["show", "--name-status", "--no-renames", "--format=", "HEAD"]);
      expect(nameStatus.split("\n").filter(Boolean)).toEqual([
        `M\t${PLAN}`,
        "M\tsrc/a.ts",
        "D\ttest/a.test.ts",
        "A\ttest/parse.test.ts",
      ]);
    });

    it("S-019.4.3 refuses to adopt a path git status shows unchanged", async () => {
      repo019();
      changeTaskFiles();
      const result = await finish("T-001.1", { adopt: ["src/other.ts"] });
      expect(steps(result)).toBe(ADOPT_REFUSED);
      expect(step(result, "check")?.detail).toBe(
        "Can't adopt src/other.ts: git status shows no change to it.",
      );
      expect(read(PLAN)).toBe(atHead(PLAN));
    });

    it("S-019.4.4 refuses to adopt a path another in-progress task lists", async () => {
      repo019({
        tasks: [
          T1,
          {
            id: "T-001.2",
            status: "in-progress",
            covers: [],
            files: ["test/keymap.test.ts"],
            verify: "echo ok",
          },
        ],
      });
      changeTaskFiles();
      addStrayTest();
      const result = await finish("T-001.1", { adopt: ["test/keymap.test.ts"] });
      expect(steps(result)).toBe(ADOPT_REFUSED);
      expect(step(result, "check")?.detail).toBe(
        "Can't adopt test/keymap.test.ts: T-001.2 lists it and is in progress, so it goes in T-001.2's commit.",
      );
      expect(read(PLAN)).toBe(atHead(PLAN));
    });

    it("S-019.4.5 writes neither notes.md nor plan.md when the check refuses another file", async () => {
      repo019();
      changeTaskFiles();
      addStrayTest();
      write("src/c.ts", "export const c = 1;\n");
      const before = head();
      const result = await finish("T-001.1", {
        adopt: ["test/keymap.test.ts"],
        note: "Counts the BOM.",
      });
      expect(steps(result)).toBe(
        "check failed, adopt not-run, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run",
      );
      expect(step(result, "check")?.output).toBe(
        "src/c.ts: a modify path in F-001's impact.md that no in-progress task lists",
      );
      expect(existsSync(join(root, `${DIR}notes.md`))).toBe(false);
      expect(read(PLAN)).toBe(atHead(PLAN));
      expect([head(), cached()]).toEqual([before, ""]);
    });

    it("S-019.4.6 accepts the same --adopt on the rerun after a failed verify", async () => {
      repo019({ tasks: [{ ...T1, verify: "grep -q fixed src/a.ts && echo S-001.1.1 ok" }] });
      write("src/a.ts", "export const a = 'broken';\n");
      addStrayTest();
      const broken = await finish("T-001.1", { adopt: ["test/keymap.test.ts"] });
      expect([broken.ok, broken.run, runJson("R-0001").ok]).toEqual([false, "R-0001", false]);
      expect(headFiles()).toEqual([PLAN, "src/a.ts", "test/keymap.test.ts"]);
      write("src/a.ts", "export const a = 'fixed';\n");
      const result = await finish("T-001.1", {
        adopt: ["test/keymap.test.ts"],
        message: "fix(F-001): fix a",
      });
      expect(result.ok).toBe(true);
      expect(step(result, "adopt")).toEqual({
        step: "adopt",
        status: "done",
        detail: "already T-001.1's files: test/keymap.test.ts",
        output: "",
      });
      expect(headFiles()).toEqual([`${DIR}log.md`, "src/a.ts"]);
    });
  });
});
