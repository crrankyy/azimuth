import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireVerifyLock, sharedCacheDir, type VerifyLock } from "../../src/core/lock";
import { writeTree } from "../helpers/tree";

let root = "";
let sleeper: ChildProcess | null = null;
let held: VerifyLock | null = null;
let cleanup: (() => void) | null = null;
afterEach(() => {
  held?.release();
  sleeper?.kill("SIGKILL");
  cleanup?.();
  held = sleeper = cleanup = null;
});

function project(): string {
  const tree = writeTree({});
  cleanup = tree.cleanup;
  root = tree.root;
  return root;
}

const lockPath = () => join(sharedCacheDir(root), "verify.lock");
const holderPid = () => (JSON.parse(readFileSync(lockPath(), "utf8")) as { pid: number }).pid;

function writeLock(text: string): void {
  mkdirSync(sharedCacheDir(root), { recursive: true });
  writeFileSync(lockPath(), text);
}

function runningPid(): number {
  sleeper = spawn("sleep", ["60"], { stdio: "ignore" });
  if (sleeper.pid === undefined) throw new Error("sleep didn't start");
  return sleeper.pid;
}

/** A clock that only moves when `sleep` is called, 20 s per call. */
function lockClock(start: number, onSleep: (call: number) => void = () => {}) {
  let time = start;
  let calls = 0;
  return {
    now: () => time,
    sleep: async () => {
      time += 20_000;
      onSleep(++calls);
    },
  };
}

describe("acquireVerifyLock", () => {
  it("S-007.4.1 takes a free lock at once and removes it on release", async () => {
    project();
    held = await acquireVerifyLock(root);
    expect(held?.waited_ms).toBe(0);
    expect(holderPid()).toBe(process.pid);
    held?.release();
    expect(existsSync(lockPath())).toBe(false);
    held?.release();
    expect(existsSync(lockPath())).toBe(false);
  });

  it("S-007.4.2 waits for a live holder, however old its lock", async () => {
    project();
    writeLock(JSON.stringify({ pid: runningPid(), at: 0 }));
    const clock = lockClock(Date.now(), (call) => {
      if (call === 2) unlinkSync(lockPath());
    });
    held = await acquireVerifyLock(root, clock);
    expect(held?.waited_ms).toBe(40_000);
    expect(holderPid()).toBe(process.pid);
  });

  it("S-007.4.3 takes over a lock left by a dead process", async () => {
    project();
    const dead = spawnSync("true").pid;
    writeLock(JSON.stringify({ pid: dead, at: Date.now() }));
    const sleep = vi.fn(async () => {});
    held = await acquireVerifyLock(root, { sleep });
    expect(held?.waited_ms).toBe(0);
    expect(sleep).not.toHaveBeenCalled();
    expect(holderPid()).toBe(process.pid);
  });

  it("S-007.4.4 gives up when aborted while waiting", async () => {
    project();
    const pid = runningPid();
    writeLock(JSON.stringify({ pid, at: Date.now() }));
    const controller = new AbortController();
    const sleep = async () => controller.abort();
    held = await acquireVerifyLock(root, { sleep, signal: controller.signal });
    expect(held).toBeNull();
    expect(holderPid()).toBe(pid);
  });

  it("takes over an unparseable lock only once it is older than 30 s", async () => {
    project();
    writeLock('{"pid":');
    const start = Date.now();
    utimesSync(lockPath(), start / 1000, start / 1000);
    held = await acquireVerifyLock(root, lockClock(start));
    expect(held?.waited_ms).toBe(40_000);
    expect(holderPid()).toBe(process.pid);
  });

  it("leaves a lock taken by another process in place on release", async () => {
    project();
    const lock = await acquireVerifyLock(root);
    const other = JSON.stringify({ pid: runningPid(), at: Date.now() });
    writeLock(other);
    lock?.release();
    expect(readFileSync(lockPath(), "utf8")).toBe(other);
  });
});
