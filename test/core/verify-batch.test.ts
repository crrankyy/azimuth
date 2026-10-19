import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { sharedCacheDir } from "../../src/core/lock";
import {
  verifyBatch,
  verifyTargets,
  type VerifyBatchOptions,
  type VerifyProgress,
} from "../../src/core/verify";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

// A sleep whose argument no other process has, so stray children can be found and killed.
const LONG_SLEEP = `sleep 60.${process.pid}${Date.now() % 100_000}`;

let root = "";
let sleeper: ChildProcess | null = null;
let cleanup: (() => void) | null = null;
afterEach(() => {
  spawnSync("pkill", ["-KILL", "-f", LONG_SLEEP]);
  sleeper?.kill("SIGKILL");
  cleanup?.();
  sleeper = cleanup = null;
});

const F001_TASKS: TaskSpec[] = [
  { id: "T-001.1", covers: ["S-001.1.1"], verify: "echo S-001.1.1 ok" },
  { id: "T-001.2", covers: ["S-001.1.2"], verify: "echo S-001.1.2 ok" },
  { id: "T-001.3", covers: [], verify: "echo T-001.3 ok" },
];

/** A project whose F-001 is in progress with `tasks`; `verify` is config.yaml's verify section. */
function project(
  tasks: TaskSpec[] = F001_TASKS,
  options: { verify?: string; files?: Record<string, string> } = {},
): string {
  const config = options.verify ? `${MINIMAL_CONFIG}verify:\n${options.verify}` : MINIMAL_CONFIG;
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    ...featureFiles({ id: "F-001", status: "in-progress", tasks }),
    ...options.files,
  });
  cleanup = tree.cleanup;
  root = tree.root;
  return root;
}

const tasksOf = (ids: string[]) => verifyTargets(root, ids).map((t) => t.task);

describe("verifyTargets", () => {
  it("S-007.2.1 returns tasks in the order named, without repeats", () => {
    project();
    expect(tasksOf(["T-001.3", "F-001", "T-001.1"])).toEqual(["T-001.3", "T-001.1", "T-001.2"]);
  });

  it("S-007.2.2 takes every in-flight feature's tasks when no ID is given", () => {
    project(F001_TASKS, {
      files: featureFiles({
        id: "F-002",
        status: "approved",
        tasks: [{ id: "T-002.1", verify: "echo T-002.1 ok" }],
      }),
    });
    expect(tasksOf([])).toEqual(["T-001.1", "T-001.2", "T-001.3"]);
  });

  it("S-007.2.3 fails the whole call on an unknown ID", () => {
    project();
    let error: unknown;
    try {
      verifyTargets(root, ["T-001.1", "F-099"]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AzimuthError);
    expect(error).toMatchObject({
      code: "not-found",
      message: "F-099 is not a feature or task in this project.",
    });
  });
});

const exists = (path: string) => existsSync(join(root, path));
const runFiles = () => {
  const dir = join(root, ".azimuth/cache/runs");
  return existsSync(dir) ? readdirSync(dir) : [];
};
const runJson = (id: string) =>
  JSON.parse(readFileSync(join(root, ".azimuth/cache/runs", `${id}.json`), "utf8")) as Record<
    string,
    unknown
  >;
const lockPath = () => join(sharedCacheDir(root), "verify.lock");

function batch(ids: string[], options: VerifyBatchOptions = {}) {
  return verifyBatch(root, verifyTargets(root, ids), options);
}

async function until<T>(read: () => T | null, what: string, deadlineMs = 5_000): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const value = read();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function childPid(): number | null {
  if (!exists("child.pid")) return null;
  const pid = Number(readFileSync(join(root, "child.pid"), "utf8").trim());
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

const yaml = (value: string) => JSON.stringify(value);

describe("verifyBatch prebuild", () => {
  it("S-007.5.1 runs the prebuild once before the targets", async () => {
    project(F001_TASKS, { verify: `  prebuild: ${yaml("echo built >> prebuild.log")}\n` });
    const result = await batch(["T-001.1", "T-001.2"]);
    expect(readFileSync(join(root, "prebuild.log"), "utf8")).toBe("built\n");
    expect(result.prebuild).toMatchObject({ ok: true, exit_code: 0 });
    expect(result.runs.map((r) => [r.id, r.target, r.ok])).toEqual([
      ["R-0001", "T-001.1", true],
      ["R-0002", "T-001.2", true],
    ]);
  });

  it("S-007.5.2 records no runs when the prebuild fails", async () => {
    project([{ id: "T-001.1", verify: "touch ran" }], {
      verify: `  prebuild: ${yaml("echo no compiler; exit 2")}\n`,
    });
    const result = await batch(["T-001.1"]);
    expect(result.prebuild).toMatchObject({ ok: false, exit_code: 2, output_tail: "no compiler" });
    expect(result.runs).toEqual([]);
    expect(runFiles()).toEqual([]);
    expect(exists("ran")).toBe(false);
  });

  it("S-007.5.3 stops a prebuild at its own timeout", async () => {
    project(F001_TASKS, {
      verify: "  prebuild: sleep 30\n  build_timeout_seconds: 1\n  timeout_seconds: 600\n",
    });
    const result = await batch(["T-001.1"]);
    expect(result.prebuild).toMatchObject({ ok: false, exit_code: 124 });
    expect(result.prebuild?.output_tail.endsWith("[azimuth] prebuild timed out after 1s")).toBe(
      true,
    );
    expect(result.runs).toEqual([]);
  });

  it("S-007.5.4 doesn't count the prebuild's time against a target's timeout", async () => {
    project(F001_TASKS, {
      verify: "  timeout_seconds: 1\n  build_timeout_seconds: 1800\n  prebuild: sleep 2\n",
    });
    const result = await batch(["T-001.1"]);
    expect(result.prebuild?.ok).toBe(true);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ id: "R-0001", ok: true, exit_code: 0 });
    expect(result.runs[0]?.duration_ms).toBeLessThan(1000);
  });

  it("S-007.5.5 skips the prebuild when asked", async () => {
    project(F001_TASKS, { verify: `  prebuild: ${yaml("touch prebuilt")}\n` });
    const result = await batch(["T-001.1"], { prebuild: false });
    expect(exists("prebuilt")).toBe(false);
    expect(result.prebuild).toBeNull();
    expect(result.runs.map((r) => [r.id, r.ok])).toEqual([["R-0001", true]]);
  });
});

describe("verifyBatch runs", () => {
  it("S-007.6.1 records the call's wait and session in every run", async () => {
    project();
    sleeper = spawn("sleep", ["60"], { stdio: "ignore" });
    mkdirSync(sharedCacheDir(root), { recursive: true });
    writeFileSync(lockPath(), JSON.stringify({ pid: sleeper.pid, at: Date.now() }));
    let time = Date.now();
    let sleeps = 0;
    const events: VerifyProgress[] = [];
    await batch(["T-001.1", "T-001.2"], {
      ses: "SES-20261020-0900",
      onProgress: (event) => events.push(event),
      lock: {
        now: () => time,
        sleep: async () => {
          time += 20_000;
          if (++sleeps === 2) unlinkSync(lockPath());
        },
      },
    });
    expect(events[0]).toEqual({ kind: "waited", waited_ms: 40000 });
    for (const id of ["R-0001", "R-0002"]) {
      expect(runJson(id)).toMatchObject({ waited_ms: 40000, ses: "SES-20261020-0900" });
    }
  });

  it("S-007.6.2 records a run outside a session that didn't wait", async () => {
    project();
    await batch(["T-001.1"], { ses: null });
    expect(runJson("R-0001")).toMatchObject({ waited_ms: 0, ses: null });
  });

  it("S-007.6.3 records a target that times out", async () => {
    project([{ id: "T-001.1", verify: "sleep 30" }], { verify: "  timeout_seconds: 1\n" });
    const result = await batch(["T-001.1"]);
    expect(result.runs[0]).toMatchObject({ id: "R-0001", ok: false, exit_code: 124 });
    expect(result.runs[0]?.output_tail.endsWith("[azimuth] timed out after 1s")).toBe(true);
  });

  it("S-007.6.4 stops the batch on an interruption and records nothing half-done", async () => {
    project([
      { id: "T-001.1", verify: `${LONG_SLEEP} & echo $! > child.pid; wait` },
      { id: "T-001.2", verify: "touch second" },
    ]);
    const controller = new AbortController();
    const running = batch(["T-001.1", "T-001.2"], { signal: controller.signal });
    const pid = await until(childPid, "child.pid");
    controller.abort();
    const result = await running;
    expect(result.interrupted).toBe(true);
    expect(result.runs).toEqual([]);
    expect(runFiles()).toEqual([]);
    expect(exists("second")).toBe(false);
    expect((await killError(pid)).code).toBe("ESRCH");
    expect(existsSync(lockPath())).toBe(false);
  });
});
