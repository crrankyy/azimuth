import type { Commit, Index, LiveSession, Session, VerifyRun } from "../../../../src/core/types";
import { agentDuration, agentRows } from "../../data/agents";
import { elapsed, shortDuration } from "../../lib/format";
import { href } from "../../lib/router";
import type { ActivityKind } from "./feed";
import {
  pickedUpBy,
  type ActivityData,
  type ActivitySession,
  type Attribution,
  type SessionStatus,
} from "./sessions";

export type ThreadEntry =
  /** "└ explorer map retry call sites · 4m"; duration null while it runs ("running"). */
  | {
      kind: "subagent";
      at: string;
      agent: string;
      text: string;
      duration: string | null;
      href: string;
    }
  /** at null and subject "Not in the index" for a SHA the index doesn't have. */
  | { kind: "commit"; at: string | null; sha: string; subject: string; refs: string[] }
  /** text "R-0140 passed · 1.3 s" | "R-0142 failed · 2.1 s". */
  | { kind: "run"; at: string; id: string; ok: boolean; text: string; target: string }
  | { kind: "question"; at: string; id: string; title: string }
  | { kind: "adr"; at: string | null; id: string; title: string }
  | { kind: "issue"; at: null; id: string; title: string };

export interface SessionThread {
  status: SessionStatus;
  /** Timed entries oldest first (ties: subagent, commit, run, question, adr), then untimed ones. */
  entries: ThreadEntry[];
  /** Subagents in the joined live session, before filters. */
  subagents: number;
  /** The session's runs, before filters. */
  runs: { total: number; failed: number };
  pickedUp: { id: string; at: string } | null;
  /** "#/agents/<live.claude_session>" when live.main.transcript is true, else null. */
  transcript: string | null;
}

type EntryKind = ThreadEntry["kind"];

const TIE_ORDER: Record<EntryKind, number> = {
  subagent: 0,
  commit: 1,
  run: 2,
  question: 3,
  adr: 4,
  issue: 5,
};

/** The kind chip that hides an entry; raised items follow their session, so no chip hides them. */
const CHIP: Partial<Record<EntryKind, ActivityKind>> = {
  subagent: "subagent",
  commit: "commit",
  run: "run",
};

/** One thread per persisted session, keyed by SES ID. */
export function sessionThreads(
  index: Index,
  data: ActivityData,
  options: { now: number; kinds: ReadonlySet<ActivityKind> },
): Map<string, SessionThread> {
  // Compared on their first 7 characters, as attribute() and git.ts do.
  const indexed = new Set(index.commits.map((c) => c.sha.slice(0, 7)));
  const threads = new Map<string, SessionThread>();
  for (const s of data.sessions) {
    if (!s.session) continue;
    const entries = [
      ...timedEntries(s, data.attribution, options.now),
      ...untimedEntries(s, s.session, data.attribution, indexed),
    ].filter((e) => shown(e, options.kinds));
    threads.set(s.session.id, {
      status: s.status,
      entries,
      subagents: s.live?.agents.length ?? 0,
      runs: runTally(data.attribution.runs.get(s.key) ?? []),
      pickedUp: pickedUpBy(data.sessions, s),
      transcript: s.live?.main.transcript ? href("agents", s.live.claude_session) : null,
    });
  }
  return threads;
}

function shown(entry: ThreadEntry, kinds: ReadonlySet<ActivityKind>): boolean {
  const chip = CHIP[entry.kind];
  return !chip || kinds.has(chip);
}

const time = (entry: ThreadEntry) => (entry.at === null ? NaN : Date.parse(entry.at));

/** Oldest first, ties in TIE_ORDER; an entry whose time doesn't parse is left out. */
function timedEntries(s: ActivitySession, attribution: Attribution, now: number): ThreadEntry[] {
  const entries: ThreadEntry[] = [
    ...subagentEntries(s.live, now),
    ...(attribution.commits.get(s.key) ?? []).map(commitEntry),
    ...(attribution.runs.get(s.key) ?? []).map(runEntry),
    ...(attribution.questions.get(s.key) ?? []).map((q): ThreadEntry => ({
      kind: "question",
      at: q.raised_at,
      id: q.id,
      title: q.title,
    })),
    ...(attribution.decisions.get(s.key) ?? []).flatMap(({ decision, at }): ThreadEntry[] =>
      at ? [{ kind: "adr", at, id: decision.id, title: decision.title }] : [],
    ),
  ];
  return entries
    .filter((e) => !Number.isNaN(time(e)))
    .sort((a, b) => time(a) - time(b) || TIE_ORDER[a.kind] - TIE_ORDER[b.kind]);
}

/** Commits the index doesn't have, then ADRs without a time and issues, in `raised` order. */
function untimedEntries(
  s: ActivitySession,
  session: Session,
  attribution: Attribution,
  indexed: Set<string>,
): ThreadEntry[] {
  const missing = session.commits
    .filter((sha) => !indexed.has(sha.slice(0, 7)))
    .map((sha): ThreadEntry => ({
      kind: "commit",
      at: null,
      sha,
      subject: "Not in the index",
      refs: [],
    }));
  const raised = [
    ...(attribution.decisions.get(s.key) ?? []).flatMap(({ decision: d, at }): ThreadEntry[] =>
      at === null ? [{ kind: "adr", at: null, id: d.id, title: d.title }] : [],
    ),
    ...(attribution.issues.get(s.key) ?? []).map((i): ThreadEntry => ({
      kind: "issue",
      at: null,
      id: i.id,
      title: i.title,
    })),
  ];
  const order = (e: ThreadEntry) => ("id" in e ? session.raised.indexOf(e.id) : -1);
  return [...missing, ...raised.sort((a, b) => order(a) - order(b))];
}

function subagentEntries(live: LiveSession | null, now: number): ThreadEntry[] {
  if (!live) return [];
  return agentRows(live)
    .filter((row) => row.agent_id !== null)
    .map((row): ThreadEntry => ({
      kind: "subagent",
      at: row.started_at,
      agent: row.name,
      text: row.description ?? "",
      duration: row.ended_at ? elapsed(agentDuration(row, now)) : null,
      href: row.href,
    }));
}

const commitEntry = (c: Commit): ThreadEntry => ({
  kind: "commit",
  at: c.at,
  sha: c.sha,
  subject: c.subject,
  refs: c.refs,
});

const runEntry = (r: VerifyRun): ThreadEntry => ({
  kind: "run",
  at: r.at,
  id: r.id,
  ok: r.ok,
  text: `${r.id} ${r.ok ? "passed" : "failed"} · ${shortDuration(r.duration_ms)}`,
  target: r.target,
});

function runTally(runs: VerifyRun[]): { total: number; failed: number } {
  return { total: runs.length, failed: runs.filter((r) => !r.ok).length };
}
