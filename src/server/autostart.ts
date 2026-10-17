import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sharedCacheDir } from "../core/lock";
import { VERSION } from "../core/version";
import { readViewerRecord, type ViewerRecord } from "./registry";

/** The bundled CLI: dist/cli.mjs when running from the bundle, else the built copy. */
function cliPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return here.endsWith(join("plugin", "dist"))
    ? join(here, "cli.mjs")
    : resolve(here, "../../plugin/dist/cli.mjs");
}

export function viewerUrlFor(record: ViewerRecord): string {
  return `http://127.0.0.1:${record.port}/`;
}

/** Whether the recorded server answers as this project's viewer of this version. */
export async function healthy(
  record: ViewerRecord,
  root: string,
): Promise<"ok" | "stale" | "down"> {
  try {
    const res = await fetch(`http://127.0.0.1:${record.port}/api/health`, {
      signal: AbortSignal.timeout(500),
    });
    const body = (await res.json()) as { instance?: string; version?: string; root?: string };
    if (body.root !== realpathSync(root)) return "down";
    return body.version === VERSION ? "ok" : "stale";
  } catch {
    return "down";
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
 * Makes sure one viewer serves this project and returns its URL. Reuses a healthy server,
 * restarts one from an older build, otherwise starts a detached server. Waits at most
 * `waitMs` for it to come up; returns null if it isn't up yet.
 */
export async function ensureViewer(root: string, waitMs = 1_500): Promise<string | null> {
  const existing = readViewerRecord(root);
  if (existing) {
    const state = await healthy(existing, root);
    if (state === "ok") return viewerUrlFor(existing);
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
    if (record && record.pid !== existing?.pid && (await healthy(record, root)) === "ok") {
      releaseStart(root);
      return viewerUrlFor(record);
    }
  }
  return null;
}
