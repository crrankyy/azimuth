import { featureOf } from "../../../../src/core/ids";
import type {
  AgentStatus,
  Commit,
  Decision,
  Index,
  Issue,
  LiveSession,
  Question,
  Session,
  VerifyRun,
} from "../../../../src/core/types";
import { sessionEnd } from "../../data/agents";

/** F-014's agent status, or "open": a persisted session with no end and no live data. */
export type SessionStatus = AgentStatus | "open";

/** One unit of agent work on Activity: a persisted session, a live Claude Code session, or both. */
export interface ActivitySession {
  /** The SES ID when known (persisted, or named by the live session), else the Claude Code session ID. */
  key: string;
  ses: string | null;
  session: Session | null;
  live: LiveSession | null;
  /** session.started_at, else live.started_at. */
  start: string;
  /** session.ended_at ?? sessionEnd(live) (F-015: set only once the live session is done); else null (still going). */
  end: string | null;
  /** "done" when session.ended_at is set; else live.status; else "open". */
  status: SessionStatus;
  /** Sorted, unique: live.features, live.feature and featureOf(each touched ID). */
  features: string[];
  /** live.skill ?? session.skill. */
  skill: string | null;
  /** live.goal ?? session.goal ("" counts as none). */
  goal: string | null;
}

export interface Attribution {
  /** By ActivitySession.key, oldest first. */
  commits: Map<string, Commit[]>;
  runs: Map<string, VerifyRun[]>;
  questions: Map<string, Question[]>;
  /** ADRs in a session's `raised`; `at` is decided_at when it lies within the session's span, else null. */
  decisions: Map<string, { decision: Decision; at: string | null }[]>;
  /** Issues in a session's `raised` (their files carry only a date). */
  issues: Map<string, Issue[]>;
  /** Commit SHA or run ID → the key of the session it belongs to. */
  owner: Map<string, string>;
}

/** Everything the timeline, the cards, the threads and the feed share for one render. */
export interface ActivityData {
  /** Ordered by start, oldest first. */
  sessions: ActivitySession[];
  byKey: Map<string, ActivitySession>;
  attribution: Attribution;
}

export function activitySessions(index: Index): ActivitySession[] {
  const persisted = new Set(index.sessions.map((s) => s.id));
  // index.live is most recently active first, so `find` takes the latest one naming a SES.
  const joined = index.sessions.map((session) =>
    fromSession(session, index.live.find((l) => l.ses === session.id) ?? null),
  );
  const liveOnly = new Map<string, ActivitySession>();
  for (const live of index.live) {
    if (live.ses && persisted.has(live.ses)) continue;
    const s = fromLive(live);
    if (!liveOnly.has(s.key)) liveOnly.set(s.key, s);
  }
  return byTime([...joined, ...liveOnly.values()], (s) => s.start);
}

/** A persisted session, with the live session that names it when there is one. */
function fromSession(session: Session, live: LiveSession | null): ActivitySession {
  return {
    key: session.id,
    ses: session.id,
    session,
    live,
    start: session.started_at,
    end: session.ended_at ?? (live ? sessionEnd(live) : null),
    status: session.ended_at ? "done" : (live?.status ?? "open"),
    features: sessionFeatures(session, live),
    skill: live?.skill ?? session.skill,
    goal: nonEmpty(live?.goal) ?? nonEmpty(session.goal),
  };
}

/** A live session whose SES is unknown or names no persisted session. */
function fromLive(live: LiveSession): ActivitySession {
  return {
    key: live.ses ?? live.claude_session,
    ses: live.ses,
    session: null,
    live,
    start: live.started_at,
    end: sessionEnd(live),
    status: live.status,
    features: sessionFeatures(null, live),
    skill: live.skill,
    goal: nonEmpty(live.goal),
  };
}

function sessionFeatures(session: Session | null, live: LiveSession | null): string[] {
  const ids = [
    ...(live?.features ?? []),
    live?.feature ?? null,
    ...(session?.touched ?? []).map(featureOf),
  ];
  return [...new Set(ids.filter((id): id is string => !!id))].sort();
}

const nonEmpty = (text: string | null | undefined) => (text?.trim() ? text : null);

/** Oldest first; a timestamp that doesn't parse sorts last. */
function byTime<T>(items: T[], time: (item: T) => string): T[] {
  const ms = (item: T) => {
    const t = Date.parse(time(item));
    return Number.isNaN(t) ? Infinity : t;
  };
  return [...items].sort((a, b) => ms(a) - ms(b));
}

/** [start, end ?? now] in epoch milliseconds. */
export function sessionSpan(s: ActivitySession, now: number): { from: number; to: number } {
  return { from: Date.parse(s.start), to: s.end ? Date.parse(s.end) : now };
}

const within = (iso: string, span: { from: number; to: number }) => {
  const t = Date.parse(iso);
  return span.from <= t && t <= span.to;
};

function push<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

/**
 * Commits: their `session` when it is a key; else an agent commit goes to the only session whose
 * span contains its time. Runs: their `ses` when it is a key; without `ses`, the owner of their
 * `commit` (SHAs compared on their first 7 characters, as git.ts does); `ses: null`, none.
 * Questions: `raised_by` when it is a key. ADRs and issues: the session whose `raised` lists them.
 * An ID that names no key, or an item no rule places, has no owner.
 */
export function attribute(index: Index, sessions: ActivitySession[], now: number): Attribution {
  const keys = new Set(sessions.map((s) => s.key));
  const attribution: Attribution = {
    commits: new Map(),
    runs: new Map(),
    questions: new Map(),
    decisions: new Map(),
    issues: new Map(),
    owner: new Map(),
  };
  const { owner } = attribution;

  const commitOwner = new Map<string, string>();
  for (const commit of byTime(index.commits, (c) => c.at)) {
    const key = commitSession(commit, sessions, keys, now);
    if (!key) continue;
    owner.set(commit.sha, key);
    commitOwner.set(commit.sha.slice(0, 7), key);
    push(attribution.commits, key, commit);
  }
  for (const run of byTime(index.runs, (r) => r.at)) {
    const key = runSession(run, keys, commitOwner);
    if (!key) continue;
    owner.set(run.id, key);
    push(attribution.runs, key, run);
  }
  for (const question of byTime(index.questions, (q) => q.raised_at))
    if (keys.has(question.raised_by)) push(attribution.questions, question.raised_by, question);

  const decisions = new Map(index.decisions.map((d) => [d.id, d]));
  const issues = new Map(index.issues.map((i) => [i.id, i]));
  for (const s of sessions) {
    if (!s.session) continue;
    const span = sessionSpan(s, now);
    for (const id of s.session.raised) {
      const decision = decisions.get(id);
      // An ADR records only a date; its decided_at is a time only when it falls in the session.
      if (decision) {
        const at =
          decision.decided_at && within(decision.decided_at, span) ? decision.decided_at : null;
        push(attribution.decisions, s.key, { decision, at });
      }
      const issue = issues.get(id);
      if (issue) push(attribution.issues, s.key, issue);
    }
  }
  return attribution;
}

/** A commit's session; one recorded without a session is placed by time, when only one fits. */
function commitSession(
  commit: Commit,
  sessions: ActivitySession[],
  keys: Set<string>,
  now: number,
): string | null {
  if (commit.session) return keys.has(commit.session) ? commit.session : null;
  if (commit.actor !== "agent") return null;
  // Parallel sessions overlap, and a session records its commits only when it closes.
  const [only, ...more] = sessions.filter((s) => within(commit.at, sessionSpan(s, now)));
  return only && more.length === 0 ? only.key : null;
}

function runSession(
  run: VerifyRun,
  keys: Set<string>,
  commitOwner: Map<string, string>,
): string | null {
  // Runs written before F-007 have no `ses`; `ses: null` means outside any session.
  if (run.ses !== undefined) return run.ses !== null && keys.has(run.ses) ? run.ses : null;
  return run.commit ? (commitOwner.get(run.commit.slice(0, 7)) ?? null) : null;
}

export function activityData(index: Index, now: number): ActivityData {
  const sessions = activitySessions(index);
  return {
    sessions,
    byKey: new Map(sessions.map((s) => [s.key, s])),
    attribution: attribute(index, sessions, now),
  };
}

/** The earliest other session that started at or after `s` ended; null while `s` is open or when none did. */
export function pickedUpBy(
  sessions: ActivitySession[],
  s: ActivitySession,
): { id: string; at: string } | null {
  if (!s.end) return null;
  const end = Date.parse(s.end);
  // SessionStart hands every new Claude Code session the latest handoff.
  const [next] = byTime(
    sessions.filter((o) => o.key !== s.key && Date.parse(o.start) >= end),
    (o) => o.start,
  );
  return next ? { id: next.key, at: next.start } : null;
}

/** "…" + the SES ID after "SES-YYYYMMDD-" ("…1100", "…1100-2"); else the first 8 characters of the key. */
export function shortSessionId(s: ActivitySession): string {
  const time = s.ses ? /^SES-\d{8}-(.+)$/.exec(s.ses)?.[1] : undefined;
  return time ? `…${time}` : s.key.slice(0, 8);
}

/** "all" → true; "untracked" → false; a feature ID → s.features includes it. */
export function sessionMatchesFeature(s: ActivitySession, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "untracked") return false;
  return s.features.includes(filter);
}
