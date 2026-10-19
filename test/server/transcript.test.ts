import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { appendLive, updateLiveMeta } from "../../src/core/live";
import type { Index, TranscriptEntry, TranscriptPage } from "../../src/core/types";
import { exportHtml } from "../../src/server/export";
import { startServer, type RunningServer } from "../../src/server/server";
import { defaultTranscriptRoots } from "../../src/server/transcript";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const VIEWER = fileURLToPath(new URL("../../plugin/dist/viewer", import.meta.url));
const fixture = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/transcripts/${path}`, import.meta.url)), "utf8");

let project: ReturnType<typeof writeTree>;
let root: string;
/** Stands for the machine's temp folder: Claude Code's projects and a folder outside them. */
let tmp: string;
let main: string;
let server: RunningServer;

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** A live session whose sidecar names `transcript`. */
function liveSession(claude: string, transcript: string): void {
  appendLive(root, claude, { kind: "start", at: "2026-10-20T10:00:00Z", source: "startup" });
  updateLiveMeta(root, claude, { transcript_path: transcript });
}

beforeAll(async () => {
  project = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
  root = realpathSync(project.root);
  tmp = mkdtempSync(join(tmpdir(), "azimuth-claude-"));
  main = join(tmp, "claude/projects/-demo/c1.jsonl");
  write(
    join(tmp, "claude/projects/-demo/c1/subagents/agent-a1.jsonl"),
    fixture("c1/subagents/agent-a1.jsonl"),
  );
  liveSession("c1", main);
  for (const id of ["a1", "a2"])
    appendLive(root, "c1", {
      kind: "subagent",
      at: "2026-10-20T10:00:30Z",
      agent_id: id,
      agent_type: "Explore",
    });
  write(join(tmp, "elsewhere/c2.jsonl"), fixture("c1.jsonl"));
  liveSession("c2", join(tmp, "elsewhere/c2.jsonl"));
  symlinkSync(join(tmp, "elsewhere/c2.jsonl"), join(tmp, "claude/projects/-demo/c3.jsonl"));
  liveSession("c3", join(tmp, "claude/projects/-demo/c3.jsonl"));
  write(join(tmp, "claude/projects/-demo/c5.txt"), fixture("c1.jsonl"));
  liveSession("c5", join(tmp, "claude/projects/-demo/c5.txt"));
  server = await startServer({
    root,
    viewerDir: VIEWER,
    port: 0,
    useFsWatch: false,
    pollMs: 200,
    transcriptRoots: [join(tmp, "claude/projects")],
  });
});

// Each test starts from a fresh copy of the main fixture, written for this project's root.
beforeEach(() => write(main, fixture("c1.jsonl").split("/work/demo").join(root)));

afterAll(async () => {
  await server?.close();
  project?.cleanup();
  rmSync(tmp, { recursive: true, force: true });
});

function get(path: string, token: string | null = server.token) {
  return fetch(`${server.url}api/transcript/${path}`, {
    headers: token === null ? {} : { "x-azimuth-token": token },
  });
}

async function page(path: string): Promise<TranscriptPage> {
  const res = await get(path);
  expect(res.status).toBe(200);
  return (await res.json()) as TranscriptPage;
}

const kinds = (entries: TranscriptEntry[]) => entries.map((e) => e.kind);

describe("F-014 the transcript route", () => {
  it("S-014.10.1 serves the main transcript", async () => {
    const body = await page("c1");
    expect(body).toMatchObject({ ok: true, claude_session: "c1", agent: null, skipped: false });
    expect(body.entries).toHaveLength(8);
    expect(body.next).toBe(statSync(main).size);
  });

  it("S-014.10.2 serves a subagent's transcript from its documented location", async () => {
    const body = await page("c1?agent=a1");
    expect(body.agent).toBe("a1");
    expect(kinds(body.entries)).toEqual(["message", "tool", "message"]);
  });

  it("S-014.10.3 returns only new lines when following live", async () => {
    const n = (await page("c1")).next;
    const line = `${JSON.stringify({
      type: "assistant",
      uuid: "e17",
      parentUuid: "e15",
      timestamp: "2026-10-20T10:02:00.000Z",
      sessionId: "c1",
      isSidechain: false,
      message: { role: "assistant", content: [{ type: "text", text: "Done." }] },
    })}\n`;
    appendFileSync(main, line);
    const body = await page(`c1?after=${n}`);
    expect(body.entries).toEqual([
      { kind: "message", role: "assistant", text: "Done.", at: "2026-10-20T10:02:00.000Z" },
    ]);
    expect(body.next).toBe(n + Buffer.byteLength(line));
    expect(body.skipped).toBe(false);
  });

  it("S-014.10.4 serves nothing without the token", async () => {
    for (const token of [null, "wrong"]) {
      const res = await get("c1", token);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: "token" });
    }
  });

  it("S-014.10.5 refuses files outside Claude Code's projects folders", async () => {
    for (const claude of ["c2", "c3", "c5"]) {
      const res = await get(claude);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ ok: false, error: "forbidden" });
    }
  });

  it("S-014.10.6 finds no unknown session, agent or missing file", async () => {
    for (const path of ["c9", "c1?agent=a9", "c1?agent=a2"]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ ok: false, error: "not-found" });
    }
  });

  it("S-014.10.7 calls a malformed offset or agent ID invalid", async () => {
    const size = statSync(main).size;
    for (const query of ["after=-1", "after=abc", `after=${size + 1}`, "agent=..%2Fa1"]) {
      const res = await get(`c1?${query}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: "invalid" });
    }
  });

  it("S-014.10.8 serves a large transcript from its last 512 KiB", async () => {
    const entry = (i: number, text: string) =>
      JSON.stringify({
        type: "assistant",
        uuid: `b${String(i).padStart(3, "0")}`,
        timestamp: "2026-10-20T10:00:00.000Z",
        message: { role: "assistant", content: [{ type: "text", text }] },
      });
    const lines = Array.from({ length: 700 }, (_, i) => {
      const padding = 1023 - Buffer.byteLength(entry(i, ""));
      return `${entry(i, "x".repeat(padding))}\n`;
    });
    expect(new Set(lines.map((l) => Buffer.byteLength(l)))).toEqual(new Set([1024]));
    writeFileSync(main, lines.join(""));
    const body = await page("c1");
    expect(body.entries).toHaveLength(512);
    expect(body.next).toBe(716_800);
    expect(body.skipped).toBe(true);
  });

  it("S-014.10.9 allows Claude Code's projects folders by default", () => {
    expect(defaultTranscriptRoots({ CLAUDE_CONFIG_DIR: "/cfg" }, "/home/dev")).toEqual([
      "/cfg/projects",
      "/home/dev/.claude/projects",
    ]);
    expect(defaultTranscriptRoots({}, "/home/dev")).toEqual(["/home/dev/.claude/projects"]);
  });

  it("S-014.10.10 exports no live sessions or transcripts", () => {
    const { index } = buildIndex(root, { mode: "live" });
    expect(index.live.find((s) => s.claude_session === "c1")?.main.transcript).toBe(true);
    const html = exportHtml(VIEWER, index, { root, home: homedir() });
    const json =
      /<script type="application\/json" id="azimuth-index">(.*?)<\/script>/s.exec(html)?.[1] ?? "";
    expect((JSON.parse(json) as Index).live).toEqual([]);
    expect(html).not.toContain("Reading the module first.");
    expect(html).not.toContain("Found 1 caller");
  });
});
