import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { processAlive } from "../core/live";
import { sharedCacheDir } from "../core/lock";
import { VERSION } from "../core/version";
import { readViewerRecord, type ViewerRecord } from "./registry";

/**
 * The bundled CLI: this file when running from the bundle, else the built copy. The bundle is
 * known by its name, not its folder: an installed plugin lives in `…/<version>/dist/`.
 */
function cliPath(): string {
  const self = fileURLToPath(import.meta.url);
  return basename(self) === "cli.mjs" ? self : resolve(dirname(self), "../../plugin/dist/cli.mjs");
}

/**
 * The version plus the bundle's modification time. A local clone rebuilt after `git pull` keeps
 * its version, so the version alone would leave a viewer running the old server code.
 */
export function buildId(): string {
  try {
    return `${VERSION}+${Math.round(statSync(cliPath()).mtimeMs)}`;
  } catch {
    return VERSION;
  }
}

export function viewerUrlFor(record: ViewerRecord): string {
  return `http://127.0.0.1:${record.port}/`;
}

/**
 * Whether the recorded server answers as this project's viewer of this build. A server that
 * misses the timeout while its process runs is `busy` (a large index rebuild blocks it for a
 * while), not `down`: starting another would leave both running.
 */
export async function healthy(
  record: ViewerRecord,
  root: string,
  expected = buildId(),
): Promise<"ok" | "stale" | "busy" | "down"> {
  try {
    const res = await fetch(`http://127.0.0.1:${record.port}/api/health`, {
      signal: AbortSignal.timeout(500),
    });
    const body = (await res.json()) as { build?: string; root?: string };
    if (body.root !== realpathSync(root)) return "down";
    return body.build === expected ? "ok" : "stale";
  } catch (e) {
    return (e as Error).name === "TimeoutError" && processAlive(record.pid) ? "busy" : "down";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exclusive "someone is starting the viewer" marker, abandoned after 10 seconds. */
function claimStart(root: string): boolean {
  const dir = sharedCacheDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "viewer.lock");
  try {
    if (Date.now() - statSync(path).mtimeMs > 10_000) unlinkSync(path);
  } catch {
    // No marker yet.
  }
  try {
    closeSync(openSync(path, "wx"));
    return true;
  } catch {
    return false;
  }
}

function releaseStart(root: string): void {
  try {
    unlinkSync(join(sharedCacheDir(root), "viewer.lock"));
  } catch {
    // Already released.
  }
}

/**
 * Makes sure one viewer serves this project and returns its URL. Reuses a healthy or busy
 * server, restarts one from an older build, otherwise starts a detached server. Waits at most
 * `waitMs` for it to come up; returns null if it isn't up yet.
 */
export async function ensureViewer(root: string, waitMs = 1_500): Promise<string | null> {
  const build = buildId();
  const existing = readViewerRecord(root);
  if (existing) {
    const state = await healthy(existing, root, build);
    if (state === "ok" || state === "busy") return viewerUrlFor(existing);
    if (state === "stale") {
      try {
        process.kill(existing.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
  if (claimStart(root)) {
    const child = spawn(process.execPath, [cliPath(), "view", "--serve", "--root", root], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, AZIMUTH_ACTOR: "you" },
    });
    child.unref();
  }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(100);
    const record = readViewerRecord(root);
    if (record && record.pid !== existing?.pid && (await healthy(record, root, build)) === "ok") {
      releaseStart(root);
      return viewerUrlFor(record);
    }
  }
  return null;
}
