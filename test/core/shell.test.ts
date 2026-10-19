import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runShell } from "../../src/core/shell";
import { writeTree } from "../helpers/tree";

// A sleep whose argument no other process has, so stray children can be found and killed.
const MARKER = `60.${process.pid}${Date.now() % 100_000}`;
const LONG_SLEEP = `sleep ${MARKER}`;

let root = "";
let cleanup: (() => void) | null = null;
afterEach(() => {
  spawnSync("pkill", ["-KILL", "-f", LONG_SLEEP]);
  cleanup?.();
  cleanup = null;
});

function project(): string {
  const tree = writeTree({});
  cleanup = tree.cleanup;
  root = tree.root;
  return root;
}

const options = (timeoutMs: number) => ({ cwd: root, env: process.env, timeoutMs });

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
  const path = join(root, "child.pid");
  if (!existsSync(path)) return null;
  const pid = Number(readFileSync(path, "utf8").trim());
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

describe("runShell", () => {
  it("S-007.3.1 returns the exit code and stdout followed by stderr", async () => {
    project();
    const result = await runShell("printf out; printf err >&2; exit 3", options(5_000));
    expect(result).toMatchObject({
      exit_code: 3,
      output: "outerr",
      timed_out: false,
      aborted: false,
    });
  });

  it("S-007.3.2 kills the command's children on a timeout", async () => {
    project();
    const result = await runShell(`${LONG_SLEEP} & echo $! > child.pid; wait`, options(1_000));
    expect(result).toMatchObject({ exit_code: 124, timed_out: true, aborted: false });
    const pid = await until(childPid, "child.pid");
    expect((await killError(pid)).code).toBe("ESRCH");
  });

  it("S-007.3.3 kills a child that ignores SIGTERM after the grace period", async () => {
    project();
    const result = await runShell(`trap '' TERM; ${LONG_SLEEP} & echo $! > child.pid; wait`, {
      ...options(1_000),
      graceMs: 200,
    });
    expect(result).toMatchObject({ exit_code: 124, timed_out: true, aborted: false });
    expect(result.duration_ms).toBeGreaterThanOrEqual(1_200);
    const pid = await until(childPid, "child.pid");
    expect((await killError(pid)).code).toBe("ESRCH");
  });

  it("S-007.3.4 kills the command's children on an abort", async () => {
    project();
    const controller = new AbortController();
    const running = runShell(`${LONG_SLEEP} & echo $! > child.pid; wait`, {
      ...options(60_000),
      signal: controller.signal,
    });
    const pid = await until(childPid, "child.pid");
    controller.abort();
    const result = await running;
    expect(result).toMatchObject({ aborted: true, timed_out: false });
    expect((await killError(pid)).code).toBe("ESRCH");
  });

  it("keeps the last 64 MB of a stream instead of failing", async () => {
    project();
    const limit = 64 * 1024 * 1024;
    const result = await runShell(
      `head -c ${limit + 1_000_000} /dev/zero; printf END`,
      options(20_000),
    );
    expect(result.exit_code).toBe(0);
    expect(result.output).toHaveLength(limit);
    expect(result.output.endsWith("\0\0\0END")).toBe(true);
  });
});
