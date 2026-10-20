import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sharedCacheDir } from "../core/lock";

/** What a running viewer server records about itself in the shared cache. */
export interface ViewerRecord {
  pid: number;
  port: number;
  instance: string;
  version: string;
  root: string;
  started_at: string;
  /**
   * config.yaml's viewer.port when this server started (loadConfig, defaults when the file is
   * missing), whatever port it was given with --port. Absent in records written before 0.3.
   */
  config_port?: number;
}

export function viewerRecordPath(root: string): string {
  return join(sharedCacheDir(root), "viewer.json");
}

export function readViewerRecord(root: string): ViewerRecord | null {
  try {
    return JSON.parse(readFileSync(viewerRecordPath(root), "utf8")) as ViewerRecord;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** URL of this project's running viewer, or null (a cheap pid check; see autostart for health). */
export function viewerUrl(root: string): string | null {
  const record = readViewerRecord(root);
  return record && alive(record.pid) ? `http://127.0.0.1:${record.port}/` : null;
}
