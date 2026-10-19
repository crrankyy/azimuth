import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sharedCacheDir } from "../../src/core/lock";
import { VERSION } from "../../src/core/version";
import { buildId, ensureViewer, healthy } from "../../src/server/autostart";
import { readViewerRecord, viewerRecordPath, type ViewerRecord } from "../../src/server/registry";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let tree: ReturnType<typeof writeTree>;
let port: number;

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * A port nothing listens on, picked by the OS. The config rejects port 0, and the default
 * (4319 and up) belongs to the viewers running on the developer's machine.
 */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** A server that accepts connections and never answers, like a viewer rebuilding a large index. */
async function hangingServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

function recordFor(root: string, fields: Pick<ViewerRecord, "pid" | "port">): ViewerRecord {
  return {
    ...fields,
    instance: "recorded",
    version: VERSION,
    root,
    started_at: new Date().toISOString(),
  };
}

beforeAll(async () => {
  port = await freePort();
  tree = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}viewer:\n  port: ${port}\n`,
    ...featureFiles({ id: "F-001", status: "draft" }),
  });
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
});

afterAll(() => {
  const record = readViewerRecord(tree.root);
  if (record && alive(record.pid)) process.kill(record.pid, "SIGTERM");
  tree.cleanup();
});

describe("viewer autostart", () => {
  it("starts one detached viewer, reuses it, and replaces a dead one", async () => {
    const url = await ensureViewer(tree.root, 8_000);
    expect(url).toBe(`http://127.0.0.1:${port}/`);
    const first = readViewerRecord(tree.root);
    expect(first && alive(first.pid)).toBe(true);
    const health = (await (await fetch(`${url}api/health`)).json()) as { root: string };
    expect(health.root).toContain("azimuth-test-");

    expect(await ensureViewer(tree.root, 8_000)).toBe(url);
    expect(readViewerRecord(tree.root)?.pid).toBe(first?.pid);
    // A rebuilt bundle with the same version must count as a different build.
    expect(await healthy(first!, tree.root)).toBe("ok");
    expect(await healthy(first!, tree.root, `${buildId()}0`)).toBe("stale");

    process.kill(first!.pid, "SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    writeFileSync(viewerRecordPath(tree.root), JSON.stringify({ ...first, pid: 999_999 }));
    const restarted = await ensureViewer(tree.root, 8_000);
    expect(restarted).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(readViewerRecord(tree.root)?.pid).not.toBe(first?.pid);
  });

  it("BUG-0068 reuses a live viewer that is slow to answer", async () => {
    const busy = await hangingServer();
    const project = writeTree({
      ".azimuth/config.yaml": `${MINIMAL_CONFIG}viewer:\n  port: ${await freePort()}\n`,
    });
    try {
      const record = recordFor(project.root, { pid: process.pid, port: busy.port });
      mkdirSync(dirname(viewerRecordPath(project.root)), { recursive: true });
      writeFileSync(viewerRecordPath(project.root), JSON.stringify(record));

      expect(await healthy(record, project.root)).toBe("busy");
      expect(await ensureViewer(project.root, 0)).toBe(`http://127.0.0.1:${busy.port}/`);
      // Nothing claimed a start, and the record still names the busy viewer.
      expect(existsSync(join(sharedCacheDir(project.root), "viewer.lock"))).toBe(false);
      expect(readViewerRecord(project.root)).toEqual(record);
    } finally {
      await busy.close();
      project.cleanup();
    }
  });

  it("BUG-0068 counts a viewer as down when its port refuses or its process is gone", async () => {
    const busy = await hangingServer();
    try {
      const refused = recordFor(tree.root, { pid: process.pid, port: await freePort() });
      expect(await healthy(refused, tree.root)).toBe("down");
      const gone = recordFor(tree.root, { pid: 999_999, port: busy.port });
      expect(await healthy(gone, tree.root)).toBe("down");
    } finally {
      await busy.close();
    }
  });
});
