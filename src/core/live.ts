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
  // `pid` is Claude Code's own process ID (CLAUDE_PID), when the hook had one.
  | { kind: "start"; at: string; source?: string; pid?: number }
  | {
      kind: "tool";
      at: string;
      tool: string;
      file: string | null;
      summary: string;
      agent_id?: string | null;
      agent_type?: string | null;
      /** The Agent tool's own tool use, and the subagent it started (from its response). */
      tool_use_id?: string | null;
      spawned?: string | null;
    }
  /** PreToolUse for the Agent tool: what a subagent is being asked to do. */
  | { kind: "launch"; at: string; tool_use_id: string; description: string; refs: string[] }
  /** SubagentStart and SubagentStop. */
  | { kind: "subagent"; at: string; agent_id: string; agent_type: string | null }
  | { kind: "subagent-stop"; at: string; agent_id: string }
  | { kind: "session"; at: string; ses: string }
  | { kind: "prompt"; at: string; pid?: number }
  | { kind: "stop"; at: string }
  | { kind: "end"; at: string; reason?: string }
  | { kind: "cursor"; at: string; scope: "wake" | "prompt"; keys: string[] };

/** What deciding whether a Claude Code session is still open needs from the outside world. */
export interface OpenCheck {
  now: Date;
  /** How long a session without a process ID counts as open after its last record. */
  idleMs: number;
  /** Whether a process is running (injected so tests don't depend on real processes). */
  alive: (pid: number) => boolean;
}

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

/** Task and feature IDs a launch names: its description's, or its prompt's when it names none. */
export function launchRefs(description: string, prompt: string): string[] {
  void description;
  void prompt;
  return [];
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
          description: null,
          task: null,
          feature: null,
          stopped_at: null,
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
    features: [],
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

/**
 * Whether one Claude Code session's live log describes a session that is still open: no end
 * record since its latest start, and its Claude Code process still runs. Sessions without a
 * recorded process ID count as open while they were active within the idle limit.
 */
export function sessionOpen(records: LiveRecord[], check: OpenCheck): boolean {
  let pid: number | null = null;
  let ended = false;
  let lastSeen = -Infinity;
  for (const r of records) {
    if (r.kind === "cursor") continue;
    lastSeen = Math.max(lastSeen, Date.parse(r.at));
    if (r.kind === "start") ended = false;
    if (r.kind === "end") ended = true;
    if ((r.kind === "start" || r.kind === "prompt") && r.pid) pid = r.pid;
  }
  if (ended || lastSeen === -Infinity) return false;
  const quiet = check.now.getTime() - lastSeen;
  // Process IDs get reused, so one is only trusted while the log is fresh.
  if (pid !== null) return quiet < KEEP_MS && check.alive(pid);
  return quiet < check.idleMs;
}

/** Whether any Claude Code session of this project is open (logs written in the last day). */
export function anySessionOpen(root: string, check: OpenCheck): boolean {
  const dir = liveDir(root);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => {
    if (!name.endsWith(".jsonl")) return false;
    const path = join(dir, name);
    try {
      if (check.now.getTime() - statSync(path).mtimeMs > KEEP_MS) return false;
      return sessionOpen(parseLiveLines(readTail(path)), check);
    } catch {
      // Removed between listing and reading.
      return false;
    }
  });
}

/** Whether a process with this ID is running; one we may not signal (EPERM) still runs. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
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
