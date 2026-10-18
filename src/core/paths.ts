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

/** This machine's folders that shouldn't show up in displayed or shared text. */
export interface Places {
  root: string;
  home: string;
  /** The Azimuth plugin folder, when known. */
  plugin?: string | null;
}

/**
 * Rewrites this machine's folders in text: paths in the project become relative, the plugin
 * folder becomes `<plugin>` and the home folder `~`.
 */
export function tidyPaths(text: string, places: Places): string {
  const swap = (s: string, from: string | null | undefined, to: string) =>
    from
      ? s
          .split(`${from}/`)
          .join(to ? `${to}/` : "")
          .split(from)
          .join(to || ".")
      : s;
  return swap(swap(swap(text, places.plugin, "<plugin>"), places.root, ""), places.home, "~");
}
