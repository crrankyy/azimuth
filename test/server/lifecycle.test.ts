import { writeFileSync } from "node:fs";
import { request } from "node:http";
import { createServer, type Server } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendLive } from "../../src/core/live";
import { readViewerRecord, viewerRecordPath } from "../../src/server/registry";
import { startServer, type RunningServer } from "../../src/server/server";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const VIEWER = fileURLToPath(new URL("../../plugin/dist/viewer", import.meta.url));
const SESSION_PID = 4242;
const NEWER_PID = 4343;

let project: ReturnType<typeof writeTree>;
const running: RunningServer[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function within(promise: Promise<void>, ms: number, message: string): Promise<void> {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );
  return Promise.race([promise, timeout]);
}

/** A registered viewer that an open Claude Code session would keep up on its own. */
async function startKeptViewer(alive: (pid: number) => boolean): Promise<RunningServer> {
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  appendLive(project.root, "claude-open", { kind: "start", at, pid: SESSION_PID });
  const server = await startServer({
    root: project.root,
    viewerDir: VIEWER,
    port: 0,
    register: true,
    useFsWatch: false,
    pollMs: 200,
    idleMs: 300,
    alive,
  });
  running.push(server);
  return server;
}

/**
 * An open viewer page: an SSE subscription on its own connection until `close()`. Not fetch:
 * after an abort, its pool opens a spare connection that holds the server's close.
 */
function openPage(port: number): Promise<{ close: () => void }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/api/events", agent: false }, (res) => {
      res.resume();
      resolve({ close: () => req.destroy() });
    });
    req.on("error", reject);
    req.end();
  });
}

function listenOn(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const closeAll = (servers: Server[]) =>
  Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));

/** Holds `count` consecutive free ports, starting from one the OS picks. */
async function occupyPorts(
  count: number,
): Promise<{ first: number; release: () => Promise<void> }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const servers: Server[] = [];
    try {
      servers.push(await listenOn(0));
      const first = (servers[0]!.address() as { port: number }).port;
      for (let i = 1; i < count; i++) servers.push(await listenOn(first + i));
      return { first, release: () => closeAll(servers).then(() => undefined) };
    } catch {
      // A port in the run was taken; try another run.
      await closeAll(servers);
    }
  }
  throw new Error(`No ${count} consecutive free ports found`);
}

beforeEach(() => {
  project = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "draft" }),
  });
});

afterEach(async () => {
  await Promise.all(running.splice(0).map((s) => s.close()));
  project.cleanup();
});

describe("viewer lifecycle", () => {
  it("BUG-0068 exits once another live viewer replaced it and its last page closed", async () => {
    const old = await startKeptViewer((pid) => pid === SESSION_PID || pid === NEWER_PID);
    let closed = false;
    void old.closed.then(() => (closed = true));
    const page = await openPage(old.port);
    const newer = { ...readViewerRecord(project.root)!, pid: NEWER_PID, instance: "newer" };
    writeFileSync(viewerRecordPath(project.root), JSON.stringify(newer));

    // Four idle checks with a page still open on the old viewer: it keeps serving that page.
    await sleep(1_200);
    expect(closed).toBe(false);
    page.close();
    await within(old.closed, 3_000, "still running after its last page closed");
    expect(readViewerRecord(project.root)).toEqual(newer);
  });

  it("BUG-0068 keeps serving when viewer.json names a viewer that is gone", async () => {
    const server = await startKeptViewer((pid) => pid === SESSION_PID);
    let closed = false;
    void server.closed.then(() => (closed = true));
    const gone = { ...readViewerRecord(project.root)!, pid: NEWER_PID, instance: "gone" };
    writeFileSync(viewerRecordPath(project.root), JSON.stringify(gone));

    await sleep(1_200);
    expect(closed).toBe(false);
    expect((await fetch(`${server.url}api/health`)).status).toBe(200);
    await server.close();
    expect(readViewerRecord(project.root)).toEqual(gone);
  });

  it("BUG-0068 fails with a clear message when every port is taken", async () => {
    const taken = await occupyPorts(2);
    try {
      const error = await startServer({
        root: project.root,
        viewerDir: VIEWER,
        port: taken.first,
        portAttempts: 2,
        useFsWatch: false,
      }).catch((e: unknown) => e);
      expect(error).toMatchObject({ name: "AzimuthError", code: "busy" });
      expect((error as Error).message).toContain(
        `Ports ${taken.first}–${taken.first + 1} on 127.0.0.1 are all in use`,
      );
    } finally {
      await taken.release();
    }
  });
});
