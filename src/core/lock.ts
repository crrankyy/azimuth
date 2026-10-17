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
