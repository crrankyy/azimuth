import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { AzimuthError } from "./errors";
import { gitCommonDir, gitTopLevel } from "./git";
import { AZ_DIR } from "./paths";

/**
 * The cache shared by every worktree of a repository: `.azimuth/cache` in the main worktree.
 * Locks and ID high-water marks live here so parallel agents in worktrees don't collide.
 */
export function sharedCacheDir(root: string): string {
  const common = gitCommonDir(root);
  const top = gitTopLevel(root);
  if (common && top && basename(common) === ".git") {
    // git reports real paths (e.g. /private/var on macOS), so compare against the real root.
    return join(dirname(common), relative(top, realpathSync(root)), AZ_DIR, "cache");
  }
  return join(root, AZ_DIR, "cache");
}

const STALE_LOCK_MS = 30_000;
const sleeper = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms: number) => Atomics.wait(sleeper, 0, 0, ms);

function lockIsStale(path: string): boolean {
  try {
    const { pid, at } = JSON.parse(readFileSync(path, "utf8")) as { pid?: number; at?: number };
    if (typeof at === "number" && Date.now() - at > STALE_LOCK_MS) return true;
    if (typeof pid === "number") {
      try {
        process.kill(pid, 0);
      } catch (e) {
        return (e as NodeJS.ErrnoException).code === "ESRCH";
      }
    }
    return false;
  } catch {
    // An unreadable or half-written lock older than the stale window is abandoned.
    try {
      return Date.now() - statSync(path).mtimeMs > STALE_LOCK_MS;
    } catch {
      return true;
    }
  }
}

/** Runs `fn` while holding the project write lock (re-entrant within one process). */
let held = 0;
export function withLock<T>(
  root: string,
  fn: () => T,
  timeoutMs = Number(process.env.AZIMUTH_LOCK_TIMEOUT_MS) || 5_000,
): T {
  if (held > 0) {
    held++;
    try {
      return fn();
    } finally {
      held--;
    }
  }
  const dir = sharedCacheDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "write.lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      closeSync(fd);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (lockIsStale(path)) {
        try {
          unlinkSync(path);
        } catch {
          // Someone else removed it first; retry.
        }
        continue;
      }
      if (Date.now() > deadline) {
        throw new AzimuthError(
          "busy",
          "Another Azimuth command is writing; try again in a moment.",
        );
      }
      sleep(25);
    }
  }
  held = 1;
  try {
    return fn();
  } finally {
    held = 0;
    try {
      unlinkSync(path);
    } catch {
      // Already removed (e.g. stolen as stale); nothing to release.
    }
  }
}

export interface VerifyLockOptions {
  /** Injected for tests; default Date.now. */
  now?: () => number;
  /** Injected for tests; default a 250 ms timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Aborting while waiting gives up (the lock is left to its holder). */
  signal?: AbortSignal;
}

export interface VerifyLock {
  waited_ms: number;
  /** Removes verify.lock; safe to call twice. */
  release(): void;
}

const VERIFY_POLL_MS = 250;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Creates a lock file holding `text`; false when it already exists. */
function createLock(path: string, text: string): boolean {
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw e;
  }
  try {
    writeSync(fd, text);
  } finally {
    closeSync(fd);
  }
  return true;
}

/** A lock file's text, or null when there is none. */
function readLock(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Removes a lock only while it still holds `text`, so one taken meanwhile by another process stays. */
function removeLockIf(path: string, text: string): void {
  if (readLock(path) !== text) return;
  try {
    unlinkSync(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

/**
 * Whether a verify lock's holder is gone. A live pid keeps it however old it is; a lock that
 * can't be parsed (its writer died before filling it) is abandoned after the stale window.
 */
function verifyLockAbandoned(path: string, text: string, now: number): boolean {
  try {
    const { pid } = JSON.parse(text) as { pid?: unknown };
    if (typeof pid === "number" && Number.isInteger(pid) && pid > 0) return !pidAlive(pid);
  } catch {
    // Half-written: judged by its age below.
  }
  try {
    return now - statSync(path).mtimeMs > STALE_LOCK_MS;
  } catch {
    // Released meanwhile: removeLockIf leaves any newer lock alone, so trying again is safe.
    return true;
  }
}

/**
 * Takes verify.lock, waiting (never failing busy) while a live process holds it. A lock whose pid
 * is dead, or an unparseable one older than 30 s, is taken over; age alone never is.
 * Resolves null when options.signal aborts while waiting.
 */
export async function acquireVerifyLock(
  root: string,
  options: VerifyLockOptions = {},
): Promise<VerifyLock | null> {
  const { now = Date.now, sleep = pause, signal } = options;
  const dir = sharedCacheDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "verify.lock");
  const started = now();
  let waited = false;
  for (;;) {
    if (signal?.aborted) return null;
    const mine = JSON.stringify({ pid: process.pid, at: now() });
    if (createLock(path, mine)) {
      let held = true;
      return {
        waited_ms: waited ? now() - started : 0,
        release: () => {
          if (!held) return;
          held = false;
          removeLockIf(path, mine);
        },
      };
    }
    const holder = readLock(path);
    if (holder === null) continue;
    if (verifyLockAbandoned(path, holder, now())) {
      removeLockIf(path, holder);
      continue;
    }
    await sleep(VERIFY_POLL_MS);
    waited = true;
  }
}

/** Writes via a temp file and rename, so readers never see a half-written file. */
export function writeFileAtomic(abs: string, text: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, text);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, abs);
}
