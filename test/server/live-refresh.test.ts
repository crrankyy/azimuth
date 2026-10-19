import { utimesSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendLive, liveFile } from "../../src/core/live";
import type { LiveSession } from "../../src/core/types";
import { startServer, type RunningServer } from "../../src/server/server";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const VIEWER = fileURLToPath(new URL("../../plugin/dist/viewer", import.meta.url));

let project: ReturnType<typeof writeTree>;
let server: RunningServer;
let clock: Date;
let stopReading: () => void = () => undefined;

interface SseEvent {
  event: string;
  data: unknown;
}

/** Collects the server-sent events of one page until the test ends. */
async function subscribe(url: string): Promise<SseEvent[]> {
  const controller = new AbortController();
  stopReading = () => controller.abort();
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
      // Aborted when the test ends.
    }
  })();
  return events;
}

async function until<T>(find: () => T | undefined, timeoutMs: number): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = find();
    if (hit !== undefined) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return find();
}

const liveEvents = (events: SseEvent[]) =>
  events.filter((e) => e.event === "live").map((e) => (e.data as { live: LiveSession[] }).live);

beforeEach(async () => {
  project = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
  const at = (hms: string) => `2026-10-20T${hms}Z`;
  appendLive(project.root, "c1", { kind: "start", at: at("10:00:00"), source: "startup" });
  appendLive(project.root, "c1", { kind: "prompt", at: at("10:00:05") });
  appendLive(project.root, "c1", { kind: "stop", at: at("10:02:00") });
  utimesSync(liveFile(project.root, "c1"), new Date(at("10:02:00")), new Date(at("10:02:00")));
  clock = new Date(at("10:20:00"));
  server = await startServer({
    root: project.root,
    viewerDir: VIEWER,
    port: 0,
    useFsWatch: false,
    pollMs: 200,
    statusRefreshMs: 100,
    now: () => clock,
  });
});

afterEach(async () => {
  stopReading();
  await server?.close();
  project?.cleanup();
});

describe("F-014 statuses stay current while nothing happens", () => {
  it("S-014.11.1 turns an idle session done without new activity", async () => {
    const events = await subscribe(server.url);
    expect(await until(() => events.find((e) => e.event === "hello"), 2_000)).toBeDefined();
    clock = new Date("2026-10-20T10:32:01Z");
    const done = await until(
      () =>
        liveEvents(events).find(
          (live) => live.find((s) => s.claude_session === "c1")?.status === "done",
        ),
      2_000,
    );
    expect(done).toBeDefined();
  });

  it("S-014.11.2 pushes nothing when nothing changes", async () => {
    const events = await subscribe(server.url);
    expect(await until(() => events.find((e) => e.event === "hello"), 2_000)).toBeDefined();
    await new Promise((r) => setTimeout(r, 1_000));
    expect(liveEvents(events)).toEqual([]);
  });
});
