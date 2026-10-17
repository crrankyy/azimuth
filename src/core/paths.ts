import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const AZ_DIR = ".azimuth";
export const CONFIG_FILE = "config.yaml";

/** Walks up from `start` to the nearest directory containing `.azimuth/config.yaml`. */
export function findProjectRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, AZ_DIR, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function azPath(root: string, ...parts: string[]): string {
  return join(root, AZ_DIR, ...parts);
}

/** Repo-relative path with forward slashes, as stored in files and the index. */
export function relPath(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

export function cacheDir(root: string): string {
  return azPath(root, "cache");
}
