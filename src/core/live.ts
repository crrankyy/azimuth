import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { toUtc } from "./git";
import { featureOf, MENTION_PATTERN } from "./ids";
import { sharedCacheDir, writeFileAtomic } from "./lock";
import type { Id, ISODateTime, LiveAgent, LiveEvent, LiveSession } from "./types";

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

/**
 * The sidecar of one Claude Code session's live log: `<liveDir>/<claude-session>.meta.json`,
 * named like `liveFile` (characters outside [\w.-] become "_"). Rewritten whole and atomically;
 * F-014 reads `transcript_path` from it through `readLiveMeta`.
 */
export interface LiveMeta {
  /**
   * When the Claude Code session first started (its first SessionStart hook), UTC. Never changes
   * once set.
   */
  started_at: ISODateTime | null;
  /** The Azimuth session last started (or reused) in this Claude Code session. */
  ses: Id | null;
  /** Claude Code's transcript (JSONL) path from the latest SessionStart input that had one. */
  transcript_path: string | null;
}

/** What deciding whether a Claude Code session is still open needs from the outside world. */
export interface OpenCheck {
  now: Date;
  /** How long a session without a process ID counts as open after its last record. */
  idleMs: number;
  /** Whether a process is running (injected so tests don't depend on real processes). */
  alive: (pid: number) => boolean;
}

const TAIL_BYTES = 64 * 1024;
const META_SUFFIX = ".meta.json";
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

/** `<liveDir>/<sanitized claude-session>.meta.json`. */
export function liveMetaFile(root: string, claudeSession: string): string {
  return join(liveDir(root), `${claudeSession.replace(/[^\w.-]/g, "_")}${META_SUFFIX}`);
}

/**
 * The sidecar, or null when it is missing, isn't JSON or isn't an object. A field that isn't a
 * string reads as null.
 */
export function readLiveMeta(root: string, claudeSession: string): LiveMeta | null {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(liveMetaFile(root, claudeSession), "utf8"));
  } catch {
    // Missing, or not JSON: the sidecar is a cache, so it reads as unknown.
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const fields = data as Record<string, unknown>;
  const field = (key: keyof LiveMeta) =>
    typeof fields[key] === "string" ? (fields[key] as string) : null;
  return {
    started_at: field("started_at"),
    ses: field("ses"),
    transcript_path: field("transcript_path"),
  };
}

/**
 * Merges `patch` into the sidecar (creating it with null fields) and writes it atomically.
 * Keys whose value is undefined are ignored; an existing `started_at` is kept.
 */
export function updateLiveMeta(
  root: string,
  claudeSession: string,
  patch: Partial<LiveMeta>,
): LiveMeta {
  const current = readLiveMeta(root, claudeSession);
  const merged = (key: keyof LiveMeta) =>
    (patch[key] === undefined ? current?.[key] : patch[key]) ?? null;
  const next: LiveMeta = {
    started_at: current?.started_at ?? merged("started_at"),
    ses: merged("ses"),
    transcript_path: merged("transcript_path"),
  };
  writeFileAtomic(liveMetaFile(root, claudeSession), `${JSON.stringify(next, null, 2)}\n`);
  return next;
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
  const refs = (text: string) => [
    ...new Set(
      (text.match(MENTION_PATTERN) ?? []).filter(
        (id) => id.startsWith("T-") || id.startsWith("F-"),
      ),
    ),
  ];
  const own = refs(description);
  return own.length > 0 ? own : refs(prompt);
}

/** The work item an event points at: an ID in a command or a feature folder in a path. */
function workItem(event: LiveEvent): { feature: string | null; task: string | null } {
  const text = `${event.summary} ${event.file ?? ""}`;
  const ids = text.match(MENTION_PATTERN) ?? [];
  const task = ids.find((id) => id.startsWith("T-")) ?? null;
  const feature = task ? featureOf(task) : (ids.find((id) => id.startsWith("F-")) ?? null);
  return { feature, task };
}

type Launch = Extract<LiveRecord, { kind: "launch" }>;

/**
 * Which launch each subagent came from. The Agent tool's response names the subagent exactly; a
 * foreground subagent's response only comes when it finishes, so until then subagents are
 * matched to the launches nobody claimed, in order.
 */
function launchesOf(records: LiveRecord[]): Map<string, Launch> {
  const launches = new Map<string, Launch>();
  const exact = new Map<string, string>();
  const started: string[] = [];
  for (const r of records) {
    if (r.kind === "launch") launches.set(r.tool_use_id, r);
    if (r.kind === "subagent" && !started.includes(r.agent_id)) started.push(r.agent_id);
    if (r.kind === "tool" && r.spawned && r.tool_use_id) exact.set(r.spawned, r.tool_use_id);
  }
  const claimed = new Set(exact.values());
  const unclaimed = [...launches.values()].filter((l) => !claimed.has(l.tool_use_id));
  const out = new Map<string, Launch>();
  for (const [agent, useId] of exact) {
    const l = launches.get(useId);
    if (l) out.set(agent, l);
  }
  for (const agent of started) {
    if (exact.has(agent)) continue;
    const l = unclaimed.shift();
    if (l) out.set(agent, l);
  }
  return out;
}

function assignment(l: Launch | undefined): Pick<LiveAgent, "description" | "task" | "feature"> {
  const task = l?.refs.find((id) => id.startsWith("T-")) ?? null;
  const feature = task ? featureOf(task) : (l?.refs.find((id) => id.startsWith("F-")) ?? null);
  return { description: l?.description ?? null, task, feature };
}

/**
 * As before, except that `ses` and `started_at` come from the sidecar when it has them, and from
 * the records (the last `session` record, the first record) otherwise. Callers that know the
 * sidecar pass it: readLiveSessions, and the SessionStart and PostToolUse hooks.
 */
export function summarizeLive(
  claudeSession: string,
  records: LiveRecord[],
  meta?: LiveMeta | null,
): LiveSession | null {
  if (records.length === 0) return null;
  const tools: LiveEvent[] = [];
  const agents = new Map<string, LiveAgent>();
  const seeAgent = (id: string, type: string | null | undefined, at: string) => {
    const known = agents.get(id);
    agents.set(id, {
      agent_id: id,
      agent_type: type ?? known?.agent_type ?? null,
      last_seen_at: known && known.last_seen_at > at ? known.last_seen_at : at,
      description: null,
      task: null,
      feature: null,
      stopped_at: known?.stopped_at ?? null,
    });
  };
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
    if (r.kind === "subagent") seeAgent(r.agent_id, r.agent_type, r.at);
    if (r.kind === "subagent-stop") {
      seeAgent(r.agent_id, null, r.at);
      const agent = agents.get(r.agent_id);
      if (agent) agent.stopped_at = r.at;
    }
    if (r.kind === "tool") {
      const event: LiveEvent = {
        at: r.at,
        tool: r.tool,
        file: r.file,
        summary: r.summary,
        agent_id: r.agent_id ?? null,
      };
      tools.push(event);
      if (r.agent_id) seeAgent(r.agent_id, r.agent_type, r.at);
    }
  }
  const launches = launchesOf(records);
  for (const agent of agents.values())
    Object.assign(agent, assignment(launches.get(agent.agent_id)));
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
  const mainFeature = [...tools]
    .reverse()
    .filter((e) => e.agent_id === null)
    .map((e) => workItem(e).feature)
    .find(Boolean);
  const running = [...agents.values()].filter((a) => !a.stopped_at).map((a) => a.feature);
  const features = [...new Set([mainFeature, ...running].filter((f): f is string => !!f))].sort();
  return {
    claude_session: claudeSession,
    ses: meta?.ses ?? ses,
    started_at: meta?.started_at ?? records[0]?.at ?? lastSeen,
    last_seen_at: lastSeen,
    stopped_at: stoppedAt,
    ended_at: endedAt,
    agents: [...agents.values()],
    current: tools.at(-1) ?? null,
    feature,
    task,
    features,
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
      const claude = name.slice(0, -6);
      const session = summarizeLive(
        claude,
        parseLiveLines(readTail(path)),
        readLiveMeta(root, claude),
      );
      if (session) out.push(session);
    } catch {
      // Removed between listing and reading.
    }
  }
  return out.sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1));
}

/**
 * Each sidecar's `ses` → its live log's modification time (UTC); the latest wins for a shared
 * `ses`.
 */
export function sessionsLastSeen(root: string): Map<Id, ISODateTime> {
  const dir = liveDir(root);
  const out = new Map<Id, ISODateTime>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(META_SUFFIX)) continue;
    const claude = name.slice(0, -META_SUFFIX.length);
    const ses = readLiveMeta(root, claude)?.ses;
    // A sidecar whose live log is gone (pruned, or no hook ran) says nothing about activity.
    const log = ses ? statSync(liveFile(root, claude), { throwIfNoEntry: false }) : undefined;
    if (!ses || !log) continue;
    const seen = toUtc(new Date(log.mtimeMs).toISOString());
    const known = out.get(ses);
    if (!known || seen > known) out.set(ses, seen);
  }
  return out;
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
