import { statfsSync } from "node:fs";
import { loadConfig } from "./config";

/**
 * Bytes an unprivileged user can still write on the filesystem holding `path`; throws when it
 * can't be read.
 */
export type FreeBytes = (path: string) => number;

/** What diskSpace found. */
export type DiskSpace =
  /** verify.min_free_gb is 0: the free space wasn't read. */
  | { state: "off" }
  /** The free-space source threw; `error` is its message. */
  | { state: "unknown"; error: string }
  /** low: free_bytes < min_free_gb × 10^9. */
  | { state: "ok" | "low"; free_bytes: number; min_free_gb: number };

/** fs.statfsSync(path): bavail × bsize. */
export function statfsFreeBytes(path: string): number {
  // bavail, not bfree: the filesystem's reserve for root is space a build can't use.
  const { bavail, bsize } = statfsSync(path);
  return bavail * bsize;
}

/**
 * Reads verify.min_free_gb from config.yaml (loadConfig) and, unless it is 0, the free space at
 * `root` from `free`. Never throws for an unreadable disk ("unknown").
 */
export function diskSpace(root: string, free: FreeBytes = statfsFreeBytes): DiskSpace {
  const min_free_gb = loadConfig(root).config.verify.min_free_gb;
  if (min_free_gb === 0) return { state: "off" };
  let free_bytes: number;
  try {
    free_bytes = free(root);
  } catch (error) {
    return { state: "unknown", error: error instanceof Error ? error.message : String(error) };
  }
  return { state: free_bytes < min_free_gb * 1e9 ? "low" : "ok", free_bytes, min_free_gb };
}

/** "4.2 GB": bytes / 10^9 rounded down to one decimal. */
export function formatGb(bytes: number): string {
  // Rounded down, so a disk below the threshold never prints at or above it.
  return `${(Math.floor(bytes / 1e8) / 10).toFixed(1)} GB`;
}

/** The stderr line verify and task finish print before running; null unless state is "low". */
export function diskWarning(space: DiskSpace): string | null {
  if (space.state !== "low") return null;
  return `Low disk space: ${formatGb(space.free_bytes)} free on the project's disk, below verify.min_free_gb (${space.min_free_gb}). Builds fail when the disk fills up.`;
}
