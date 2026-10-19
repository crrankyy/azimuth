import { spawn } from "node:child_process";
import type { Readable } from "node:stream";

export interface ShellOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  /** Between SIGTERM and SIGKILL to the process group; default KILL_GRACE_MS. */
  graceMs?: number;
  /** Aborting kills the process group like a timeout does. */
  signal?: AbortSignal;
}

export interface ShellResult {
  /** The command's exit code; 124 after a timeout; 1 when a signal ended it otherwise. */
  exit_code: number;
  /** stdout followed by stderr, the last 64 MB of each. */
  output: string;
  timed_out: boolean;
  aborted: boolean;
  duration_ms: number;
}

export const KILL_GRACE_MS = 2_000;

const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const GROUP_POLL_MS = 25;
const MAX_TIMER_MS = 2 ** 31 - 1;

/** Collects a stream, keeping only its last `limit` bytes so a chatty command can't fail the run. */
function keepTail(stream: Readable, limit: number): () => string {
  const chunks: Buffer[] = [];
  let size = 0;
  stream.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    size += chunk.length;
    let first = chunks[0];
    while (first && size - first.length >= limit) {
      chunks.shift();
      size -= first.length;
      first = chunks[0];
    }
  });
  return () => {
    const all = Buffer.concat(chunks);
    return all.subarray(Math.max(0, all.length - limit)).toString("utf8");
  };
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Every process of the group has already exited.
  }
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Runs `/bin/sh -c command` detached; on timeout or abort sends SIGTERM to -pid, then SIGKILL
 * after graceMs. A stopped command's result waits until its group is gone or has been SIGKILLed.
 */
export function runShell(command: string, options: ShellOptions): Promise<ShellResult> {
  const { cwd, env, timeoutMs, graceMs = KILL_GRACE_MS, signal } = options;
  const started = Date.now();
  if (signal?.aborted) {
    return Promise.resolve({
      exit_code: 1,
      output: "",
      timed_out: false,
      aborted: true,
      duration_ms: 0,
    });
  }
  return new Promise((resolve) => {
    // A detached shell leads its own process group, so one signal reaches everything it started.
    const child = spawn("/bin/sh", ["-c", command], {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = keepTail(child.stdout, MAX_STREAM_BYTES);
    const stderr = keepTail(child.stderr, MAX_STREAM_BYTES);
    let timedOut = false;
    let aborted = false;
    let stopping = false;
    let killed = false;
    let done = false;
    let killTimer: NodeJS.Timeout | undefined;

    const stop = () => {
      if (stopping || child.pid === undefined) return;
      stopping = true;
      const pid = child.pid;
      signalGroup(pid, "SIGTERM");
      killTimer = setTimeout(() => {
        killed = true;
        signalGroup(pid, "SIGKILL");
      }, graceMs);
    };
    // Node fires a timer longer than 2^31 - 1 ms after 1 ms instead, so cap it there (~24 days).
    const timer = setTimeout(
      () => {
        timedOut = true;
        stop();
      },
      Math.min(timeoutMs, MAX_TIMER_MS),
    );
    const onAbort = () => {
      aborted = true;
      clearTimeout(timer);
      stop();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const finish = (exitCode: number, output: string) => {
      if (done) return;
      // A stopped command's children can outlive the shell (or ignore SIGTERM); wait for them.
      if (stopping && !killed && child.pid !== undefined && groupAlive(child.pid)) {
        setTimeout(() => finish(exitCode, output), GROUP_POLL_MS);
        return;
      }
      done = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        exit_code: timedOut ? 124 : exitCode,
        output,
        timed_out: timedOut,
        aborted,
        duration_ms: Date.now() - started,
      });
    };
    child.on("error", (error) => {
      if (child.pid === undefined) finish(1, error.message);
    });
    child.on("close", (code) => finish(typeof code === "number" ? code : 1, stdout() + stderr()));
  });
}
