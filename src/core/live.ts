import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { featureOf, MENTION_PATTERN } from "./ids";
import { sharedCacheDir } from "./lock";
import type { LiveEvent, LiveSession } from "./types";

/**
 * Live agent activity, recorded by the Claude Code hooks as one JSON line per event in
 * `cache/live/<claude-session>.jsonl`. Hooks only ever append (several hook processes may run at
 * once), and readers take the tail of each file.
 */
export type LiveRecord =
  | { kind: "start"; at: string; source?: string }
  | {
      kind: "tool";
      at: string;
      tool: string;
      file: string | null;
      summary: string;
      agent_id?: string | null;
      agent_type?: string | null;
    }
  | { kind: "session"; at: string; ses: string }
  | { kind: "prompt"; at: string }
  | { kind: "stop"; at: string }
  | { kind: "end"; at: string; reason?: string }
  | { kind: "cursor"; at: string; scope: "wake" | "prompt"; keys: string[] };

const TAIL_BYTES = 64 * 1024;
const MAX_EVENTS = 20;
const KEEP_MS = 24 * 3_600_000;

export function liveDir(root: string): string {
  return join(sharedCacheDir(root), "live");
}

/** The last `bytes` of a file, starting at a line boundary. */
function readTail(path: string, bytes = TAIL_BYTES): string {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString("utf8");
    return start === 0 ? text : text.slice(text.indexOf("\n") + 1);
  } finally {
    closeSync(fd);
  }
}

export function parseLiveLines(text: string): LiveRecord[] {
  const out: LiveRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as LiveRecord;
      if (record && typeof record.kind === "string" && typeof record.at === "string")
        out.push(record);
    } catch {
      // A line torn by a concurrent append; the next read will see it whole.
    }
  }
  return out;
}

export function liveFile(root: string, claudeSession: string): string {
  return join(liveDir(root), `${claudeSession.replace(/[^\w.-]/g, "_")}.jsonl`);
}

/** Appends one event. A single short write with O_APPEND, so concurrent hooks don't interleave. */
export function appendLive(root: string, claudeSession: string, record: LiveRecord): void {
  mkdirSync(liveDir(root), { recursive: true });
  appendFileSync(liveFile(root, claudeSession), `${JSON.stringify(record)}\n`);
}

export function readLiveRecords(root: string, claudeSession: string): LiveRecord[] {
  const path = liveFile(root, claudeSession);
  return existsSync(path) ? parseLiveLines(readTail(path)) : [];
}

/** The work item an event points at: an ID in a command or a feature folder in a path. */
function workItem(event: LiveEvent): { feature: string | null; task: string | null } {
  const text = `${event.summary} ${event.file ?? ""}`;
  const ids = text.match(MENTION_PATTERN) ?? [];
  const task = ids.find((id) => id.startsWith("T-")) ?? null;
  const feature = task ? featureOf(task) : (ids.find((id) => id.startsWith("F-")) ?? null);
  return { feature, task };
}

export function summarizeLive(claudeSession: string, records: LiveRecord[]): LiveSession | null {
  if (records.length === 0) return null;
  const tools: LiveEvent[] = [];
  const agents = new Map<string, LiveSession["agents"][number]>();
  let ses: string | null = null;
  let stoppedAt: string | null = null;
  let endedAt: string | null = null;
  let lastSeen = records[0]?.at ?? "";
  for (const r of records) {
    if (r.kind !== "cursor" && r.at > lastSeen) lastSeen = r.at;
    if (r.kind === "session") ses = r.ses;
    if (r.kind === "stop") stoppedAt = r.at;
    if (r.kind === "end") endedAt = r.at;
    if (r.kind === "start") endedAt = null;
    if (r.kind === "tool") {
      const event: LiveEvent = {
        at: r.at,
        tool: r.tool,
        file: r.file,
        summary: r.summary,
        agent_id: r.agent_id ?? null,
      };
      tools.push(event);
      if (r.agent_id)
        agents.set(r.agent_id, {
          agent_id: r.agent_id,
          agent_type: r.agent_type ?? null,
          last_seen_at: r.at,
        });
    }
  }
  let feature: string | null = null;
  let task: string | null = null;
  for (const event of [...tools].reverse()) {
    const item = workItem(event);
    if (item.feature) {
      feature = item.feature;
      task = item.task;
      break;
    }
  }
  return {
    claude_session: claudeSession,
    ses,
    started_at: records[0]?.at ?? lastSeen,
    last_seen_at: lastSeen,
    stopped_at: stoppedAt,
    ended_at: endedAt,
    agents: [...agents.values()],
    current: tools.at(-1) ?? null,
    feature,
    task,
    events: tools.slice(-MAX_EVENTS),
  };
}

/** Sessions seen in the last 24 hours, most recently active first. */
export function readLiveSessions(root: string, now = new Date()): LiveSession[] {
  const dir = liveDir(root);
  if (!existsSync(dir)) return [];
  const out: LiveSession[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    const path = join(dir, name);
    try {
      if (now.getTime() - statSync(path).mtimeMs > KEEP_MS) continue;
      const session = summarizeLive(name.slice(0, -6), parseLiveLines(readTail(path)));
      if (session) out.push(session);
    } catch {
      // Removed between listing and reading.
    }
  }
  return out.sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1));
}

/** Deletes live files untouched for more than a day. */
export function pruneLive(root: string, now = new Date()): void {
  const dir = liveDir(root);
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    try {
      if (now.getTime() - statSync(path).mtimeMs > KEEP_MS) unlinkSync(path);
    } catch {
      // Already gone.
    }
  }
}
