import type { LiveRecord } from "./live";
import type {
  AgentStatus,
  LiveActivity,
  LiveEdit,
  LiveEvent,
  LiveWait,
  LiveWaitSpan,
  Session,
} from "./types";

/**
 * What each agent of one Claude Code session is doing, derived from its live records: statuses,
 * waits on you, current actions, recent edits and wait spans. Pure: no I/O.
 */

/** An agent with no record for longer than this counts as done (idle, crashed or abandoned). */
export const DONE_AFTER_MS = 30 * 60_000;
export const MAX_EDITS = 5;
export const MAX_WAITS = 20;
export const IDLE_REASON = "Waiting for your next prompt";

export interface Activity {
  main: LiveActivity;
  /** Every agent ID seen in a subagent, subagent-stop, tool or wait record. */
  agents: Map<string, LiveActivity>;
  status: AgentStatus;
  waiting: LiveWait | null;
}

type ToolRecord = Extract<LiveRecord, { kind: "tool" }>;

const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

/** One agent while the records are replayed. */
interface Lane {
  startedAt: string;
  /** Whether `startedAt` came from a `subagent` record. */
  announced: boolean;
  /** Its own latest record (subagents) for the 30-minute rule. */
  lastAt: string;
  /** Set by `end`, or a subagent's `subagent-stop`. */
  endedAt: string | null;
  current: LiveEvent | null;
  edits: LiveEdit[];
  spans: LiveWaitSpan[];
  /** The open wait on you; `anyone` when it came from a notification of an unknown agent. */
  open: { span: LiveWaitSpan; anyone: boolean } | null;
  /** The main agent's open idle span (from a `stop`). */
  idle: LiveWaitSpan | null;
}

const newLane = (at: string): Lane => ({
  startedAt: at,
  announced: false,
  lastAt: at,
  endedAt: null,
  current: null,
  edits: [],
  spans: [],
  open: null,
  idle: null,
});

/** A tool record as an index event (added, removed and error null when absent). */
export function toLiveEvent(record: ToolRecord): LiveEvent {
  return {
    at: record.at,
    tool: record.tool,
    file: record.file,
    summary: record.summary,
    agent_id: record.agent_id ?? null,
    added: record.added ?? null,
    removed: record.removed ?? null,
    error: record.error ?? null,
  };
}

function closeWait(lane: Lane, at: string): void {
  if (lane.open) lane.open.span.to = at;
  lane.open = null;
}

function closeIdle(lane: Lane, at: string): void {
  if (lane.idle) lane.idle.to = at;
  lane.idle = null;
}

function openWait(lane: Lane, r: Extract<LiveRecord, { kind: "wait" }>, anyone: boolean): void {
  if (lane.open) {
    // Asked again before answering: the wait goes on, about the newer prompt.
    lane.open.span.reason = r.reason;
    lane.open.anyone &&= anyone;
    return;
  }
  const span: LiveWaitSpan = { from: r.at, to: null, reason: r.reason };
  lane.spans.push(span);
  lane.open = { span, anyone };
}

function noteTool(lane: Lane, r: ToolRecord): void {
  lane.current = toLiveEvent(r);
  if (!EDIT_TOOLS.has(r.tool) || r.failed || !r.file) return;
  lane.edits.push({ file: r.file, at: r.at, added: r.added ?? null, removed: r.removed ?? null });
  if (lane.edits.length > MAX_EDITS) lane.edits.shift();
}

/** The lane's spans as they stand at `endAt` (when the agent went quiet), without empty ones. */
function spansOf(lane: Lane, endAt: string | null): LiveWaitSpan[] {
  return lane.spans
    .map((s) => ({ ...s, to: s.to ?? endAt }))
    .filter((s) => s.to === null || Date.parse(s.to) !== Date.parse(s.from))
    .slice(-MAX_WAITS);
}

const waitOf = (span: LiveWaitSpan): LiveWait => ({ reason: span.reason, since: span.from });

/**
 * Each agent's activity from one session's records, at `now` (rules in State transitions and
 * feature.md Assumptions). `startedAt` is the session's start (sidecar or first record);
 * `transcript` is false everywhere (readLiveSessions sets it).
 */
export function deriveActivity(records: LiveRecord[], now: Date, startedAt: string): Activity {
  const main = newLane(startedAt);
  const subs = new Map<string, Lane>();
  const sub = (id: string, at: string) => {
    const known = subs.get(id);
    if (known) return known;
    const lane = newLane(at);
    subs.set(id, lane);
    return lane;
  };
  const everyone = () => [main, ...subs.values()];
  /** A notification nobody claimed ends at whatever any agent does next. */
  const closeAnyone = (at: string) => {
    if (main.open?.anyone) closeWait(main, at);
  };
  let lastAt: string | null = null;

  for (const r of records) {
    if (r.kind === "cursor") continue;
    if (lastAt === null || Date.parse(r.at) >= Date.parse(lastAt)) lastAt = r.at;
    const own = "agent_id" in r && r.agent_id ? sub(r.agent_id, r.at) : null;
    if (own) own.lastAt = r.at;
    switch (r.kind) {
      case "start":
        main.endedAt = null;
        for (const lane of everyone()) closeWait(lane, r.at);
        closeIdle(main, r.at);
        break;
      case "end":
        for (const lane of everyone()) {
          closeWait(lane, r.at);
          lane.endedAt ??= r.at;
        }
        closeIdle(main, r.at);
        break;
      case "prompt":
      case "stop":
        closeWait(main, r.at);
        if (r.kind === "prompt") closeIdle(main, r.at);
        else main.idle ??= pushIdle(main, r.at);
        break;
      case "launch":
        closeIdle(main, r.at);
        break;
      case "subagent":
        if (own && !own.announced) {
          own.startedAt = r.at;
          own.announced = true;
        }
        break;
      case "subagent-stop":
        if (own) {
          closeWait(own, r.at);
          own.endedAt ??= r.at;
        }
        closeAnyone(r.at);
        break;
      case "tool": {
        const lane = own ?? main;
        closeWait(lane, r.at);
        closeAnyone(r.at);
        if (lane === main) closeIdle(main, r.at);
        noteTool(lane, r);
        break;
      }
      case "wait": {
        const anyone = r.agent_id === null && r.source === "notification";
        // PermissionRequest fires before the notification about the same prompt.
        if (anyone && everyone().some((lane) => lane.open)) break;
        openWait(own ?? main, r, anyone);
        break;
      }
    }
  }

  const judged = (lane: Lane, quietSince: string | null, isMain: boolean) => {
    const verdict = judge(lane, quietSince, now.getTime(), isMain);
    return {
      activity: {
        status: verdict.status,
        waiting: verdict.waiting,
        current: lane.current,
        started_at: lane.startedAt,
        ended_at: verdict.ended_at,
        edits: [...lane.edits],
        waits: spansOf(lane, verdict.quietAt),
        transcript: false,
      },
      asked: verdict.status === "waiting" && lane.open !== null,
    };
  };
  const mainJudged = judged(main, lastAt, true);
  const subJudged = [...subs].map(([id, lane]) => [id, judged(lane, lane.lastAt, false)] as const);
  const all = [mainJudged, ...subJudged.map(([, j]) => j)];
  return {
    main: mainJudged.activity,
    agents: new Map(subJudged.map(([id, j]) => [id, j.activity])),
    ...sessionState(all, mainJudged.activity),
  };
}

function pushIdle(main: Lane, at: string): LiveWaitSpan {
  const span: LiveWaitSpan = { from: at, to: null, reason: IDLE_REASON };
  main.spans.push(span);
  return span;
}

interface Verdict {
  status: AgentStatus;
  waiting: LiveWait | null;
  ended_at: string | null;
  /** When the agent went quiet: its open spans end there. */
  quietAt: string | null;
}

/** An agent's status at `nowMs`, by the rules in order; `quietSince` is its last record. */
function judge(lane: Lane, quietSince: string | null, nowMs: number, isMain: boolean): Verdict {
  const settled = { quietAt: null };
  if (lane.endedAt) return { status: "done", waiting: null, ended_at: lane.endedAt, ...settled };
  if (lane.open)
    return { status: "waiting", waiting: waitOf(lane.open.span), ended_at: null, ...settled };
  if (quietSince && nowMs - Date.parse(quietSince) > DONE_AFTER_MS)
    return { status: "done", waiting: null, ended_at: quietSince, quietAt: quietSince };
  if (isMain && lane.idle)
    return { status: "waiting", waiting: waitOf(lane.idle), ended_at: null, ...settled };
  return { status: "running", waiting: null, ended_at: null, ...settled };
}

/**
 * Waiting on you when any agent has an open permission wait (the earliest), else running when
 * any agent runs, else waiting when the main agent waits for your prompt, else done.
 */
function sessionState(
  all: { activity: LiveActivity; asked: boolean }[],
  main: LiveActivity,
): { status: AgentStatus; waiting: LiveWait | null } {
  const asked = all
    .flatMap((a) => (a.asked && a.activity.waiting ? [a.activity.waiting] : []))
    .sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
  if (asked[0]) return { status: "waiting", waiting: asked[0] };
  if (all.some((a) => a.activity.status === "running")) return { status: "running", waiting: null };
  if (main.status === "waiting") return { status: "waiting", waiting: main.waiting };
  return { status: "done", waiting: null };
}

const GOAL_BULLET = /^- \d{1,2}:\d{2} · /;

/** Goal and skill: the last `## Goals` bullet, else the frontmatter goal ("" → null) and skill. */
export function latestGoal(session: Pick<Session, "goal" | "skill" | "goals">): {
  goal: string | null;
  skill: string | null;
} {
  const last = session.goals
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => GOAL_BULLET.test(line))
    .at(-1);
  if (!last) return { goal: session.goal.trim() || null, skill: session.skill };
  const rest = last.replace(GOAL_BULLET, "");
  const split = rest.indexOf(" · ");
  const skill = split > 0 ? rest.slice(0, split) : "";
  if (skill && !/\s/.test(skill)) return { goal: rest.slice(split + 3) || null, skill };
  return { goal: rest || null, skill: null };
}
