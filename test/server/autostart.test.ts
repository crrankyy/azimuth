import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sharedCacheDir } from "../../src/core/lock";
import { VERSION } from "../../src/core/version";
import { buildId, ensureViewer, healthy, waitForExit } from "../../src/server/autostart";
import { readViewerRecord, viewerRecordPath, type ViewerRecord } from "../../src/server/registry";
import { startServer, type RunningServer } from "../../src/server/server";
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

function recordFor(
  root: string,
  fields: Pick<ViewerRecord, "pid" | "port" | "config_port">,
): ViewerRecord {
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

const VIEWER = fileURLToPath(new URL("../../plugin/dist/viewer", import.meta.url));
const DEAD_PID = 999_999;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A free port other than `taken`, so a test can tell the ports apart. */
async function otherFreePort(...taken: number[]): Promise<number> {
  for (;;) {
    const candidate = await freePort();
    if (!taken.includes(candidate)) return candidate;
  }
}

function bind(port: number): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(null));
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const unbind = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

/** A free port P whose neighbour P+1 is free too, for a port scan that moves on from P. */
async function freePair(): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = await bind(0);
    if (!first) continue;
    const port = (first.address() as AddressInfo).port;
    const next = await bind(port + 1);
    await unbind(first);
    if (!next) continue;
    await unbind(next);
    return port;
  }
  throw new Error("No two consecutive free ports found");
}

/** A git project whose config.yaml asks for `configPort`. */
function gitProject(configPort: number): ReturnType<typeof writeTree> {
  const project = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}viewer:\n  port: ${configPort}\n`,
  });
  initRepo(project.root);
  commitAll(project.root, "chore: start");
  return project;
}

function writeRecord(root: string, record: ViewerRecord): void {
  mkdirSync(dirname(viewerRecordPath(root)), { recursive: true });
  writeFileSync(viewerRecordPath(root), JSON.stringify(record));
}

/** Answers every request as this project's viewer of an older build: argv is port, root, mode. */
const STAND_IN = `
const [port, root, mode] = process.argv.slice(1);
if (mode === "ignore-sigterm") process.on("SIGTERM", () => {});
require("node:http")
  .createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ build: "0.0.0+0", root }));
  })
  .listen(Number(port), "127.0.0.1");
`;

interface StandIn {
  child: ChildProcess;
  pid: number;
  /** The signal it exited with, null for an exit without one. */
  exited: Promise<NodeJS.Signals | null>;
}

/** A stale viewer in a separate process, answering on `port` once this resolves. */
async function standIn(port: number, root: string, mode = "exit-on-sigterm"): Promise<StandIn> {
  const child = spawn(process.execPath, ["-e", STAND_IN, String(port), realpathSync(root), mode], {
    stdio: "ignore",
  });
  const exited = new Promise<NodeJS.Signals | null>((resolve) =>
    child.once("exit", (_code, signal) => resolve(signal)),
  );
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await (await fetch(`http://127.0.0.1:${port}/api/health`)).text();
      return { child, pid: child.pid!, exited };
    } catch {
      // Not listening yet.
      await sleep(50);
    }
  }
  child.kill("SIGKILL");
  throw new Error(`The stand-in viewer never answered on port ${port}`);
}

/** Stops what a test started: the viewer ensureViewer spawned, and the stand-in. */
function stopStarted(root: string, stand?: StandIn): void {
  const record = readViewerRecord(root);
  // A record the test wrote (recordFor) names a process the test didn't start.
  if (record && record.instance !== "recorded" && record.pid !== stand?.pid && alive(record.pid))
    process.kill(record.pid, "SIGTERM");
  if (stand && stand.child.exitCode === null && stand.child.signalCode === null)
    stand.child.kill("SIGKILL");
}

describe("S-024.5 a replaced viewer keeps its port", () => {
  it("S-024.5.1 replaces a stale viewer on the port it held", async () => {
    const configPort = await freePort();
    const port = await otherFreePort(configPort);
    const project = gitProject(configPort);
    let stand: StandIn | undefined;
    try {
      stand = await standIn(port, project.root);
      writeRecord(
        project.root,
        recordFor(project.root, { pid: stand.pid, port, config_port: configPort }),
      );

      expect(await ensureViewer(project.root, 8_000)).toBe(`http://127.0.0.1:${port}/`);
      expect(await stand.exited).toBe("SIGTERM");
      const record = readViewerRecord(project.root);
      expect(record?.port).toBe(port);
      expect(record?.pid).not.toBe(stand.pid);
    } finally {
      stopStarted(project.root, stand);
      project.cleanup();
    }
  });

  it("S-024.5.2 restarts a dead viewer on its recorded port, not viewer.port", async () => {
    const configPort = await freePort();
    const port = await otherFreePort(configPort);
    const project = gitProject(configPort);
    try {
      writeRecord(
        project.root,
        recordFor(project.root, { pid: DEAD_PID, port, config_port: configPort }),
      );

      expect(await ensureViewer(project.root, 8_000)).toBe(`http://127.0.0.1:${port}/`);
      expect(readViewerRecord(project.root)?.port).toBe(port);
    } finally {
      stopStarted(project.root);
      project.cleanup();
    }
  });

  it("S-024.5.3 moves to the next port when the stale viewer keeps its own", async () => {
    const port = await freePair();
    const configPort = await otherFreePort(port, port + 1);
    const project = gitProject(configPort);
    let stand: StandIn | undefined;
    try {
      stand = await standIn(port, project.root, "ignore-sigterm");
      writeRecord(
        project.root,
        recordFor(project.root, { pid: stand.pid, port, config_port: configPort }),
      );

      const started = Date.now();
      const url = await ensureViewer(project.root, 8_000);
      const elapsed = Date.now() - started;
      expect(url).toBe(`http://127.0.0.1:${port + 1}/`);
      expect(elapsed).toBeGreaterThanOrEqual(1_000);
      expect(alive(stand.pid)).toBe(true);
    } finally {
      stopStarted(project.root, stand);
      project.cleanup();
    }
  });

  it("S-024.5.4 ends the wait as soon as the process is gone", async () => {
    const answers = [true, true, false];
    const calls: number[] = [];
    const check = (pid: number) => {
      calls.push(pid);
      return answers[calls.length - 1] ?? false;
    };

    expect(await waitForExit(4242, 1_000, check)).toBe(true);
    expect(calls).toEqual([4242, 4242, 4242]);
  });

  it("S-024.5.5 gives up the wait at its timeout", async () => {
    const started = Date.now();

    expect(await waitForExit(4242, 200, () => true)).toBe(false);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
  });

  it("S-024.5.6 records config.yaml's viewer.port next to the port it bound", async () => {
    const configPort = await freePort();
    const port = await otherFreePort(configPort);
    const project = writeTree({
      ".azimuth/config.yaml": `${MINIMAL_CONFIG}viewer:\n  port: ${configPort}\n`,
    });
    let server: RunningServer | undefined;
    try {
      server = await startServer({
        root: project.root,
        viewerDir: VIEWER,
        port,
        register: true,
        useFsWatch: false,
      });

      expect(readViewerRecord(project.root)).toMatchObject({ port, config_port: configPort });
    } finally {
      await server?.close();
      project.cleanup();
    }
  });

  it("S-024.5.7 starts on a changed viewer.port instead of the old port", async () => {
    const configPort = await freePort();
    const port = await otherFreePort(configPort);
    const project = gitProject(configPort);
    try {
      writeRecord(
        project.root,
        recordFor(project.root, { pid: DEAD_PID, port, config_port: port }),
      );

      expect(await ensureViewer(project.root, 8_000)).toBe(`http://127.0.0.1:${configPort}/`);
    } finally {
      stopStarted(project.root);
      project.cleanup();
    }
  });

  it("S-024.5.8 follows config.yaml for a record without config_port", async () => {
    const configPort = await freePort();
    const port = await otherFreePort(configPort);
    const project = gitProject(configPort);
    try {
      writeRecord(project.root, recordFor(project.root, { pid: DEAD_PID, port }));

      expect(await ensureViewer(project.root, 8_000)).toBe(`http://127.0.0.1:${configPort}/`);
    } finally {
      stopStarted(project.root);
      project.cleanup();
    }
  });
});
