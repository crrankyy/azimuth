import { request } from "node:http";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { splitFrontmatter } from "../../src/core/frontmatter";
import { appendLive } from "../../src/core/live";
import { sharedCacheDir } from "../../src/core/lock";
import type { Index } from "../../src/core/types";
import { exportHtml } from "../../src/server/export";
import { startServer, type RunningServer } from "../../src/server/server";
import { createDemoRepo, type DemoRepo } from "../helpers/demo-repo";

const VIEWER = fileURLToPath(new URL("../../plugin/dist/viewer", import.meta.url));

let repo: DemoRepo;
let server: RunningServer;

interface SseEvent {
  event: string;
  data: unknown;
}

/** Collects server-sent events until `close()`. */
async function subscribe(url: string) {
  const controller = new AbortController();
  const res = await fetch(`${url}api/events`, { signal: controller.signal });
  const events: SseEvent[] = [];
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let split;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const event = /^event: (.*)$/m.exec(raw)?.[1];
          const data = /^data: (.*)$/m.exec(raw)?.[1];
          if (event && data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      // Aborted.
    }
  })();
  const waitFor = async (name: string, from = 0, timeoutMs = 6_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = events.slice(from).find((e) => e.event === name);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `No ${name} event within ${timeoutMs} ms; got ${events.map((e) => e.event).join(", ")}`,
    );
  };
  return { events, waitFor, close: () => controller.abort() };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${server.url}api/actions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-azimuth-token": server.token, ...headers },
    body: JSON.stringify(body),
  });
}

function rawGet(path: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port: server.port, path, headers: { host } },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  repo = createDemoRepo();
  server = await startServer({
    root: repo.root,
    viewerDir: VIEWER,
    port: 0,
    useFsWatch: false,
    pollMs: 200,
  });
});

afterAll(async () => {
  await server?.close();
  repo?.cleanup();
});

describe("viewer server", () => {
  it("serves the page with its token, and the index", async () => {
    const html = await (await fetch(server.url)).text();
    expect(html).toContain(`<meta name="azimuth-token" content="${server.token}">`);
    expect(html).toContain('id="azimuth-boot"');
    expect(html).not.toContain('src="./app.js"');
    const index = (await (await fetch(`${server.url}api/index`)).json()) as Index;
    expect(index.project.name).toBe("Hookline");
    expect(index.server?.instance).toBe(server.instance);
  });

  it("rejects foreign hosts, origins and missing tokens", async () => {
    expect(await rawGet("/api/index", "evil.example:80")).toBe(403);
    expect(await rawGet("/", `localhost:${server.port}`)).toBe(200);
    expect(
      (await post({ action: "approve", ref: "F-009" }, { "x-azimuth-token": "wrong" })).status,
    ).toBe(403);
    expect(
      (await post({ action: "approve", ref: "F-009" }, { origin: "http://evil.example" })).status,
    ).toBe(403);
  });

  it("pushes index updates found by polling, and live updates separately", async () => {
    const sse = await subscribe(server.url);
    await sse.waitFor("hello");
    const mark = sse.events.length;
    appendLive(repo.root, "claude-1", {
      kind: "tool",
      at: "2026-10-18T12:00:00Z",
      tool: "Read",
      file: "src/x.ts",
      summary: "Read src/x.ts",
    });
    const live = (await sse.waitFor("live", mark)).data as Pick<Index, "live">;
    expect(live.live[0]?.current?.summary).toBe("Read src/x.ts");
    expect(sse.events.slice(mark).some((e) => e.event === "index")).toBe(false);
    const log = join(repo.root, ".azimuth/features/F-005-retry-backoff/log.md");
    writeFileSync(
      log,
      `${readFileSync(log, "utf8")}\n## 2026-10-18T12:01:00Z · agent · note\nPolled.\n`,
    );
    const updated = (await sse.waitFor("index", mark)).data as Index;
    expect(updated.features.find((f) => f.id === "F-005")?.detail?.log.at(-1)?.body).toBe(
      "Polled.",
    );
    sse.close();
  });

  it("BUG-0010 delivers a live step that follows another within a second", async () => {
    const sse = await subscribe(server.url);
    await sse.waitFor("hello");
    const step = (file: string) =>
      appendLive(repo.root, "claude-2", {
        kind: "tool",
        at: "2026-10-18T12:00:00Z",
        tool: "Edit",
        file,
        summary: `Edit ${file}`,
      });
    const mark = sse.events.length;
    step("src/first.ts");
    await sse.waitFor("live", mark);
    const second = sse.events.length;
    step("src/second.ts");
    const live = (await sse.waitFor("live", second, 2_500)).data as Pick<Index, "live">;
    expect(live.live.find((s) => s.claude_session === "claude-2")?.current?.summary).toBe(
      "Edit src/second.ts",
    );
  });

  it("S-001.1.1 stays up past its idle limit while a Claude Code session is open", async () => {
    const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    appendLive(repo.root, "claude-keepalive", { kind: "start", at, pid: 4242 });
    const keeper = await startServer({
      root: repo.root,
      viewerDir: VIEWER,
      port: 0,
      useFsWatch: false,
      pollMs: 200,
      idleMs: 300,
      alive: (pid) => pid === 4242,
    });
    let closed = false;
    void keeper.closed.then(() => (closed = true));
    // No page and no requests for four idle limits: only the open session keeps it up.
    await new Promise((r) => setTimeout(r, 1_200));
    expect(closed).toBe(false);
    expect((await fetch(`${keeper.url}api/health`)).status).toBe(200);
    appendLive(repo.root, "claude-keepalive", { kind: "end", at });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("still running after the session ended")), 3_000),
    );
    await Promise.race([keeper.closed, timeout]);
  });

  it("approves as you even when the environment says agent, editing only frontmatter", async () => {
    process.env.AZIMUTH_ACTOR = "agent";
    const file = join(repo.root, ".azimuth/features/F-009-endpoint-rate-limits/feature.md");
    const before = readFileSync(file, "utf8");
    const res = await post({ action: "approve", ref: "F-009", expect: "draft" });
    delete process.env.AZIMUTH_ACTOR;
    const body = (await res.json()) as { ok: boolean; changed: string[]; index: Index };
    expect(res.status).toBe(200);
    expect(body.changed).toEqual([
      ".azimuth/features/F-009-endpoint-rate-limits/feature.md",
      ".azimuth/features/F-009-endpoint-rate-limits/log.md",
    ]);
    const after = readFileSync(file, "utf8");
    expect(splitFrontmatter(after).body).toBe(splitFrontmatter(before).body);
    expect(body.index.features.find((f) => f.id === "F-009")).toMatchObject({
      status: "approved",
      approved_by: "you",
    });
  });

  it("records your note when you decide an ADR", async () => {
    const res = await post({
      action: "decide",
      ref: "ADR-0004",
      payload: { decision: "accepted", note: "30 s is fine for now." },
      expect: "proposed",
    });
    const body = (await res.json()) as { index: Index };
    expect(res.status).toBe(200);
    expect(body.index.decisions.find((d) => d.id === "ADR-0004")).toMatchObject({
      status: "accepted",
      decided_by: "you",
      decision_note: "30 s is fine for now.",
    });
  });

  it("explains refusals: gate, stale status and a busy lock", async () => {
    const gate = await post({ action: "approve", ref: "F-008" });
    const gateBody = (await gate.json()) as {
      error: string;
      gate: { checks: { id: string; ok: boolean }[] };
    };
    expect(gate.status).toBe(409);
    expect(gateBody.error).toBe("gate");
    expect(gateBody.gate.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual([
      "approve.no-blocking-questions",
    ]);

    const stale = await post({
      action: "answer",
      ref: "Q-0002",
      payload: { option: "window" },
      expect: "draft",
    });
    expect(stale.status).toBe(200);
    const conflict = await post({ action: "approve", ref: "F-009", expect: "draft" });
    expect(conflict.status).toBe(409);
    expect(((await conflict.json()) as { error: string }).error).toBe("conflict");

    const lock = join(sharedCacheDir(repo.root), "write.lock");
    mkdirSync(sharedCacheDir(repo.root), { recursive: true });
    writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
    process.env.AZIMUTH_LOCK_TIMEOUT_MS = "300";
    const busy = await post({
      action: "request-changes",
      ref: "F-006",
      payload: { comment: "Name the error" },
    });
    delete process.env.AZIMUTH_LOCK_TIMEOUT_MS;
    unlinkSync(lock);
    expect(busy.status).toBe(409);
    expect(((await busy.json()) as { error: string }).error).toBe("busy");
  });

  it("shows what changed in a spec since its approval", async () => {
    const res = await fetch(`${server.url}api/features/F-006/approval-diff`);
    const body = (await res.json()) as { files: { path: string; diff: string }[] };
    expect(body.files.map((f) => f.path)).toEqual([
      ".azimuth/features/F-006-dead-letter-queue/contract.md",
    ]);
    expect(body.files[0]?.diff).toMatch(/^\+.*attempts/m);
  });
});

describe("export", () => {
  it("writes a self-contained snapshot without token or local paths", () => {
    const { index } = buildIndex(repo.root, { mode: "live" });
    const html = exportHtml(VIEWER, index);
    expect(html).toContain('id="azimuth-index"');
    expect(html).not.toContain('<meta name="azimuth-token"');
    expect(html).not.toContain(repo.root);
    const json =
      /<script type="application\/json" id="azimuth-index">(.*?)<\/script>/s.exec(html)?.[1] ?? "";
    const snapshot = JSON.parse(json) as Index;
    expect(snapshot).toMatchObject({ mode: "export", server: null });
    expect(snapshot.project.root).toBeNull();
  });
});
