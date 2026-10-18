import { randomBytes } from "node:crypto";
import { existsSync, realpathSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { buildIndex } from "../core/build-index";
import { sharedCacheDir } from "../core/lock";
import { liveDir, readLiveSessions } from "../core/live";
import { azPath } from "../core/paths";
import type { Index } from "../core/types";
import { VERSION } from "../core/version";
import { runAction, type ActionRequest } from "./actions";
import { buildId } from "./autostart";
import { approvalDiff } from "./diff";
import { embeddedJson, inlineViewer } from "./export";
import { hostAllowed, originAllowed, readBody, sendJson } from "./http";
import { readViewerRecord, viewerRecordPath, type ViewerRecord } from "./registry";
import { watchProject, type ChangeKind } from "./watch";
import { spawnSync } from "node:child_process";

export interface ServerOptions {
  root: string;
  viewerDir: string;
  port?: number;
  /** Try this many ports above `port` when it is taken. */
  portAttempts?: number;
  useFsWatch?: boolean;
  pollMs?: number;
  /** Exit after this long with no clients, requests or active agent sessions. */
  idleMs?: number;
  /** Whether a process is running, for open Claude Code sessions (tests inject one). */
  alive?: (pid: number) => boolean;
  /** Record the server in the shared cache so CLIs and hooks can find it. */
  register?: boolean;
  now?: () => Date;
}

export interface RunningServer {
  port: number;
  url: string;
  instance: string;
  token: string;
  close: () => Promise<void>;
  /** Resolves when the server stops (closed or idle). */
  closed: Promise<void>;
}

const LIVE_ACTIVE_MS = 2 * 60_000;

function gitDir(root: string): string | null {
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-dir"], {
    cwd: root,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function listen(server: ReturnType<typeof createServer>, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (e: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      reject(e);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

/** Serves the viewer for one project on 127.0.0.1, pushing index changes over SSE. */
export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const root = realpathSync(opts.root);
  const now = opts.now ?? (() => new Date());
  const instance = randomBytes(8).toString("hex");
  const build = buildId();
  const token = randomBytes(24).toString("hex");
  const server = { instance, version: VERSION };
  let index: Index = buildIndex(root, { now: now(), server }).index;
  let lastRequestAt = Date.now();
  const clients = new Set<ServerResponse>();

  const send = (res: ServerResponse, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const broadcast = (event: string, data: unknown) => {
    for (const res of clients) send(res, event, data);
  };

  const rebuild = () => {
    const previous = index.rev;
    index = buildIndex(root, { now: now(), server }).index;
    if (index.rev !== previous) broadcast("index", index);
    else broadcast("live", { live: index.live, generated_at: index.generated_at });
  };
  let lastLivePush = 0;
  let deferredLive: NodeJS.Timeout | null = null;
  const pushLive = () => {
    const wait = lastLivePush + 1_000 - Date.now();
    if (wait > 0) {
      // At most one push a second, but the latest step still goes out when the second is up:
      // the watcher has already moved past this change and won't report it again.
      deferredLive ??= setTimeout(() => {
        deferredLive = null;
        onChange("live");
      }, wait);
      return;
    }
    lastLivePush = Date.now();
    index = { ...index, live: readLiveSessions(root, now()) };
    broadcast("live", { live: index.live, generated_at: index.generated_at });
  };
  const onChange = (kind: ChangeKind) => {
    try {
      if (kind === "live") pushLive();
      else rebuild();
    } catch {
      // A file caught mid-write; the next change or poll rebuilds again.
    }
  };

  const html = () =>
    inlineViewer(
      opts.viewerDir,
      `<meta name="azimuth-token" content="${token}"><script type="application/json" id="azimuth-boot">${embeddedJson({ mode: "live", instance })}</script>`,
    );

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    lastRequestAt = Date.now();
    const port = (http.address() as { port: number }).port;
    if (!hostAllowed(req, port)) return sendJson(res, 403, { ok: false, error: "host" });
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/") {
      const body = html();
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
        "x-content-type-options": "nosniff",
      });
      return res.end(body);
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, instance, version: VERSION, build, root });
    }
    if (req.method === "GET" && url.pathname === "/api/index") {
      if (req.headers["if-none-match"] === index.rev) {
        res.writeHead(304);
        return res.end();
      }
      return sendJson(res, 200, index, { etag: index.rev });
    }
    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      });
      clients.add(res);
      send(res, "hello", { instance, version: VERSION, rev: index.rev });
      req.on("close", () => clients.delete(res));
      return;
    }
    const diffMatch = /^\/api\/features\/(F-\d{3})\/approval-diff$/.exec(url.pathname);
    if (req.method === "GET" && diffMatch) {
      const feature = index.features.find((f) => f.id === diffMatch[1]);
      if (!feature) return sendJson(res, 404, { ok: false, error: "not-found" });
      return sendJson(res, 200, { ok: true, files: approvalDiff(root, feature) });
    }
    if (req.method === "POST" && url.pathname === "/api/actions") {
      if (!originAllowed(req, port)) return sendJson(res, 403, { ok: false, error: "origin" });
      if (req.headers["x-azimuth-token"] !== token)
        return sendJson(res, 403, { ok: false, error: "token" });
      let body: ActionRequest;
      try {
        body = (await readBody(req)) as ActionRequest;
      } catch {
        return sendJson(res, 400, { ok: false, error: "invalid", message: "Body must be JSON." });
      }
      const outcome = runAction(root, body);
      if ("status" in outcome) return sendJson(res, outcome.status, outcome.body);
      rebuild();
      return sendJson(res, 200, {
        ok: true,
        index,
        changed: outcome.result.changed,
        message: outcome.result.message,
      });
    }
    return sendJson(res, 404, { ok: false, error: "not-found" });
  };

  const http = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      if (!res.headersSent)
        sendJson(res, 500, { ok: false, error: "internal", message: (e as Error).message });
      else res.end();
    });
  });

  const attempts = opts.portAttempts ?? 20;
  let port = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      port = await listen(http, (opts.port ?? 0) === 0 ? 0 : (opts.port ?? 0) + i);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE" || i === attempts - 1) throw e;
    }
  }

  const git = gitDir(root);
  const watcher = watchProject({
    dirs: [azPath(root), ...(sharedCacheDir(root).startsWith(azPath(root)) ? [] : [liveDir(root)])],
    liveDir: liveDir(root),
    files: git ? [join(git, "HEAD"), join(git, "packed-refs"), join(git, "logs", "HEAD")] : [],
    onChange,
    useFsWatch: opts.useFsWatch,
    pollMs: opts.pollMs,
  });

  // Agents also change source files the index looks at (impact paths, dirty state); rebuild
  // periodically while an agent is active, and keep connections alive.
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(": ping\n\n");
    const active = index.live.some(
      (s) => !s.ended_at && Date.now() - Date.parse(s.last_seen_at) < LIVE_ACTIVE_MS,
    );
    if (active) onChange("content");
  }, 10_000);
  heartbeat.unref();

  const record: ViewerRecord = {
    pid: process.pid,
    port,
    instance,
    version: VERSION,
    root,
    started_at: now().toISOString(),
  };
  if (opts.register) {
    mkdirSync(dirname(viewerRecordPath(root)), { recursive: true });
    writeFileSync(viewerRecordPath(root), JSON.stringify(record, null, 2) + "\n");
  }

  let resolveClosed: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => (resolveClosed = resolve));
  let closing = false;
  const close = async () => {
    if (closing) return closed;
    closing = true;
    clearInterval(heartbeat);
    clearInterval(idleCheck);
    if (deferredLive) clearTimeout(deferredLive);
    watcher.close();
    for (const res of clients) res.end();
    clients.clear();
    if (opts.register && readViewerRecord(root)?.instance === instance) {
      try {
        unlinkSync(viewerRecordPath(root));
      } catch {
        // Already removed.
      }
    }
    await new Promise<void>((resolve) => http.close(() => resolve()));
    resolveClosed();
  };

  const idleMs = opts.idleMs ?? 2 * 3_600_000;
  const idleCheck = setInterval(
    () => {
      if (!existsSync(azPath(root))) return void close();
      const agentActive = index.live.some(
        (s) => !s.ended_at && Date.now() - Date.parse(s.last_seen_at) < idleMs,
      );
      if (clients.size === 0 && !agentActive && Date.now() - lastRequestAt > idleMs) void close();
    },
    Math.min(60_000, idleMs),
  );
  idleCheck.unref();

  return { port, url: `http://127.0.0.1:${port}/`, instance, token, close, closed };
}
