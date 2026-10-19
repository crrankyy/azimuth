---
language: typescript
---
# F-016: Contract

## Data structures

```ts
// viewer/src/screens/activity/sessions.ts (pure; imports types, featureOf and F-015's sessionEnd)
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

// viewer/src/screens/activity/feed.ts
/** The kind chips: Sessions, Subagents, Commits, Verify runs, Your actions. */
export type ActivityKind = "session" | "subagent" | "commit" | "run" | "action";
/** Feed item kinds (unchanged). */
export type FeedKind = "session" | "commit" | "run" | "action";
export type Period = "today" | "yesterday" | "earlier";
export interface PeriodGroup {
  period: Period;
  /** "Today · Sunday, Oct 18" | "Yesterday · Saturday, Oct 17" | "Earlier" */
  heading: string;
  items: FeedItem[];
}

// viewer/src/screens/activity/timeline.ts (pure)
export type TimelineRange = "75m" | "today" | "3d";
/** [{75m, "Last 75 min"}, {today, "Today"}, {3d, "3 days"}] */
export const RANGES: { value: TimelineRange; label: string }[];

export interface TimelineTick {
  /** Percent of the window, two decimals. */
  left: number;
  /** "11:15" | "03:00" | "Fri Oct 16" */
  label: string;
}

export interface TimelineWindow {
  range: TimelineRange;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  ticks: TimelineTick[];
  /** "Today, 11:00 – 12:15" | "Today · Sunday, Oct 18" | "Oct 16 – Oct 18" */
  label: string;
}

export type SpanKind = "running" | "waiting" | "done" | "open";

export interface TimelineSpan {
  kind: SpanKind;
  left: number;
  width: number;
  /**
   * "Finished · 11:00–11:58" | "Running · 11:40–now" | "Open · 11:50–now · no live data" |
   * "Waiting on you · 12:00–now · Permission prompt: Bash pnpm vitest run"
   */
  title: string;
}

export type MarkerKind = "commit" | "run-pass" | "run-fail" | "question" | "adr";

export interface TimelineMarker {
  kind: MarkerKind;
  /** SHA, run ID, question ID or ADR ID. */
  id: string;
  at: string;
  left: number;
  /**
   * "Commit a41f2b9 · <subject>" | "R-0140 passed · T-005.2" | "R-0142 failed · T-005.4" |
   * "Q-0002 raised · <title>" | "ADR-0004 proposed · <title>"
   */
  title: string;
}

export interface TimelineRow {
  /** The session key, or "<session key>/<agent_id>" for a subagent. */
  key: string;
  depth: 0 | 1;
  status: SessionStatus;
  /** "running" | "waiting on you" | "done" | "open" */
  statusLabel: string;
  /** Session: shortSessionId ("…1100"); subagent: agent_type ?? "subagent". */
  name: string;
  /** The full session key or agent ID, for the row's title. */
  id: string;
  /** Subagent: its description; session: null. */
  detail: string | null;
  /** Session rows only (null on subagent rows). */
  skill: string | null;
  feature: string | null;
  /**
   * "#/activity/<SES>" for a done or open session with a SES; else "#/agents/<claude-session>";
   * a subagent row: its AgentRow.href, "#/agents/<claude-session>/<agent>".
   */
  href: string;
  /** The base span first, then wait spans, oldest first. */
  spans: TimelineSpan[];
  /** Session rows only, by time. */
  markers: TimelineMarker[];
  /** The row's own agent's current.summary while that agent is running, else null. */
  action: string | null;
}

export interface EarlierSession {
  /** The SES ID, else the first 8 characters of the Claude Code session ID. */
  id: string;
  /** "09:30–10:25" */
  label: string;
  /** "#/activity/<SES>", or "#/agents/<claude-session>" for a live session without a SES. */
  href: string;
}

export interface TimelineLayout {
  window: TimelineWindow;
  /** Left of the now line, percent. */
  now: number;
  rows: TimelineRow[];
  /** Today's sessions that ended before the window, oldest first. */
  earlier: EarlierSession[];
}

export interface TimelineOptions {
  now: number;
  range: TimelineRange;
  kinds: ReadonlySet<ActivityKind>;
  /** "all", "untracked" or a feature ID (feed.ts FeatureFilter). */
  feature: string;
}

// viewer/src/screens/activity/thread.ts (pure)
export type ThreadEntry =
  /** "└ explorer map retry call sites · 4m"; duration null while it runs ("running"). */
  | { kind: "subagent"; at: string; agent: string; text: string; duration: string | null; href: string }
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
```

Used from F-015, as its contract defines them (built before F-016; not changed here):

```ts
// viewer/src/lib/status.ts
export const AGENT_LOOK: Record<AgentStatus, AgentLook>; // mark "az-run" | "az-wait" | "az-g s-done"; label "Running" | "Waiting on you" | "Done"
// viewer/src/components/Status.tsx
export function AgentStatusMark(props: { status: AgentStatus; short?: boolean; hideLabel?: boolean }): ReactElement;
// viewer/src/lib/format.ts
export function elapsed(ms: number): string; // "45s", "4m 01s", "5m", "25m", "1h 05m"
// viewer/src/data/agents.ts (pure)
export function agentRows(session: LiveSession): AgentRow[]; // main agent first, then subagents; AgentRow.href "#/agents/<cs>[/<agent>]"
export function sessionEnd(session: LiveSession): string | null; // null unless done
export function actionLabel(event: LiveEvent): string; // "<tool> <file>", else the summary
// viewer/src/lib/router.ts: Section "agents"; #/agents/<claude-session>[/<agent>] is the transcript page
// test/fixtures/live/agents.ts
export function liveEvent(over: Partial<LiveEvent>): LiveEvent;
export function liveAgent(over: Partial<LiveAgent>): LiveAgent;
export function liveSession(over: Partial<LiveSession>): LiveSession;
export function indexWithLive(live: LiveSession[], over?: Partial<Index>): Index;
```

```css
/* viewer/src/styles/azimuth.css (F-015, from the design's azimuth.css) */
.az-run { /* … */ animation: az-pulse 1.6s ease-in-out infinite; }
.az-wait { /* … */ }
.az-stripe { background: repeating-linear-gradient(-45deg, rgba(249, 226, 175, 0.28) 0 4px, rgba(249, 226, 175, 0.08) 4px 8px); }
@media (prefers-reduced-motion: reduce) { .az-run { animation: none; } }
```

## Public signatures

```ts
// viewer/src/screens/activity/sessions.ts
export function activitySessions(index: Index): ActivitySession[];
/** [start, end ?? now] in epoch milliseconds. */
export function sessionSpan(s: ActivitySession, now: number): { from: number; to: number };
/**
 * Commits: their `session` when it is a key; else an agent commit goes to the only session whose
 * span contains its time. Runs: their `ses` when it is a key; without `ses`, the owner of their
 * `commit` (SHAs compared on their first 7 characters, as git.ts does); `ses: null`, none. Questions: `raised_by` when it is a key. ADRs and issues: the
 * session whose `raised` lists them. An ID that names no key, or an item no rule places, has no
 * owner.
 */
export function attribute(index: Index, sessions: ActivitySession[], now: number): Attribution;
export function activityData(index: Index, now: number): ActivityData;
/** The earliest other session that started at or after `s` ended; null while `s` is open or when none did. */
export function pickedUpBy(sessions: ActivitySession[], s: ActivitySession): { id: string; at: string } | null;
/** "…" + the SES ID after "SES-YYYYMMDD-" ("…1100", "…1100-2"); else the first 8 characters of the key. */
export function shortSessionId(s: ActivitySession): string;
/** "all" → true; "untracked" → false; a feature ID → s.features includes it. */
export function sessionMatchesFeature(s: ActivitySession, filter: string): boolean;

// viewer/src/screens/activity/timeline.ts
/** Window bounds, ticks and label in the viewer's local time (feature.md Assumptions). */
export function timelineWindow(range: TimelineRange, now: number): TimelineWindow;
export function layoutTimeline(
  index: Index,
  options: TimelineOptions,
  data?: ActivityData, // default activityData(index, options.now)
): TimelineLayout;

// viewer/src/screens/activity/thread.ts
/** One thread per persisted session, keyed by SES ID. */
export function sessionThreads(
  index: Index,
  data: ActivityData,
  options: { now: number; kinds: ReadonlySet<ActivityKind> },
): Map<string, SessionThread>;

// viewer/src/screens/activity/feed.ts
/**
 * Newest first. Leaves out persisted sessions whose activity status is running or waiting (they
 * are cards) and commits and runs owned by a listed session (they are in its thread).
 */
export function buildFeed(index: Index, data: ActivityData): FeedItem[];
/** Today and Yesterday by local day, everything older in Earlier; empty groups are left out. */
export function byPeriod(items: FeedItem[], now: number): PeriodGroup[];
// byDay is removed; matchesFeature, featureCounts, activeLive and isLive are unchanged.

// viewer/src/screens/activity/LiveCards.tsx
/** Activity sessions whose status is running or waiting: running first, each group oldest first. */
export function liveCards(data: ActivityData): ActivitySession[];
/** The card grid; renders nothing for an empty list. Each card links to "#/agents/<claude-session>" and has id "ses-<SES>" when it has a SES. */
export function LiveCards(props: { sessions: ActivitySession[]; now: number }): ReactNode;

// viewer/src/screens/activity/AgentTimeline.tsx
export function AgentTimeline(props: {
  layout: TimelineLayout;
  range: TimelineRange;
  onRange: (range: TimelineRange) => void;
}): ReactNode;

// viewer/src/screens/activity/ActivityFeed.tsx
export interface FeedState {
  now: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  changed: Set<string>;
  /** sessionThreads(...); replaces liveSessions. */
  threads: Map<string, SessionThread>;
}
/** Period groups; the cards come first under Today (a Today group is shown for them alone if needed). */
export function ActivityFeed(props: {
  items: FeedItem[];
  cards: ActivitySession[];
  state: FeedState;
}): ReactNode;

// viewer/src/components/SessionCard.tsx (`live` prop removed: live sessions are cards now)
export function SessionCard(props: {
  session: Session;
  thread: SessionThread;
  expanded: boolean;
  onToggle: () => void;
  /** Prefix the collapsed times with the date (the feed's Earlier group). */
  dated?: boolean;
  flash?: boolean;
}): ReactNode;

// test/fixtures/live/timeline.ts (tests only; built with F-015's builders)
export const FIXTURE_NOW: number; // Date.parse("2026-10-18T12:05:00Z")
/** A fresh copy of c1201, c1202, c1140, c1100 (most recently active first, as index.live is ordered). */
export function timelineLive(): LiveSession[];
/** indexWithLive(live): the Hookline expected index (a structuredClone) with `live` set. */
export function fixtureIndex(live?: LiveSession[]): Index; // default timelineLive()
```

A session row's mark is a `<span class="{AGENT_LOOK[status].mark}" aria-hidden="true">` followed
by its status words, or `StatusGlyph` `s-open` labelled "Open" for `open`; subagent rows start
with "└". Waiting spans also carry `.az-stripe`. Thread entries
use a ring for commits, `StatusGlyph` `s-done` ("Passed") or `s-failing` ("Failed") for runs, a
diamond labelled "Raised" for questions, ADRs and issues, and "└" for subagents.

Rendered markup the tests rely on:

```text
<section class="az-card tl" aria-label="Agent timeline">
  … <span class="tl-range-label">Today, 11:00 – 12:15 · each row is a session, indented rows are its subagents</span>
  … <div class="az-seg" role="group" aria-label="Range"> Last 75 min | Today | 3 days </div>
  … <div class="tl-now" style="left:86.67%"><span>now</span></div>
  <a class="tl-row d0 s-waiting" href="…" title="SES-20261018-1140"> label: mark, …1140, pm-spec, F-010 (span.az-id), waiting on you
    <span class="tl-span k-running" style="left:53.33%;width:33.33%" role="img" aria-label="Running · 11:40–now" title="Running · 11:40–now"></span>
    <span class="tl-mark m-run-fail" style="left:74.67%" role="img" aria-label="R-0142 failed · T-005.4" title="R-0142 failed · T-005.4"></span><span class="tl-mark-label">R-0142 ✕</span>
  </a>
  <a class="tl-row d1 …"> └ researcher survey log fields …</a>
  legend: Running · Waiting on you · Finished · Commit · Run passed · Run failed · Raised a question or ADR
  Earlier today: SES-20261018-0930 · 09:30–10:25
</section>
<a class="az-card live-card s-running" id="ses-SES-20261018-1201" href="#/agents/c1201"> AgentStatusMark(Running) …1201 4m | Implement retry exhaustion | F-005 · T-005.4 · 2 subagents | ▸ test-runner: pnpm vitest run </a>
```

## Live fixture

`test/fixtures/live/timeline.ts`, F-014-shaped, on 2026-10-18 (UTC), next to F-015's
`agents.ts` and built with its builders. It has its own four sessions so F-016's expected values
don't move when F-015's fixture does. Every live session has `last_seen_at` at its latest record,
`stopped_at` and `ended_at` null unless stated, `events` holding its `current` events, and
`transcript: false` everywhere.

| Claude session | ses · skill · goal | status · waiting | main agent | features · task | `current` (latest of any agent) |
| --- | --- | --- | --- | --- | --- |
| c1201 | SES-20261018-1201 · pm-build · "Implement retry exhaustion" | running · null | running, started 12:01:00, current Edit `src/retry/policy.ts` "Edited src/retry/policy.ts" at 12:04:00 | [F-005] · T-005.4 | a2's Bash "pnpm vitest run" at 12:04:50 |
| c1202 | SES-20261018-1202 · pm-build · "Fix lint errors, re-verify F-007" | running · null | running, started 12:02:00, current Edit `src/api/attempts.ts` "Edited src/api/attempts.ts" at 12:04:40 | [F-007] · T-007.4 | main's Edit at 12:04:40 |
| c1140 | SES-20261018-1140 · pm-spec · "Write the F-010 spec" | waiting · {reason "Permission prompt: Bash pnpm vitest run", since 12:00:00} | waiting (same waiting), started 11:40:00, waits [{from 12:00:00, to null, same reason}], current Bash "pnpm vitest run" at 11:59:58 | [F-010] · null | main's Bash at 11:59:58 |
| c1100 | SES-20261018-1100 · pm-build · "Build F-005 tasks T-005.2 to T-005.4" | done · null | done, started 11:00:00, ended 11:58:00, waits [{from 11:20:00, to 11:23:00, reason "Permission prompt: Bash pnpm build"}], current null | [] · null (feature F-005) | null; `ended_at` 11:58:00 |

Subagents (`LiveAgent`, `agent_type` · `description`):

| Session | agent_id | type · description | status | started_at → ended_at | current |
| --- | --- | --- | --- | --- | --- |
| c1201 | a1 | explorer · "find decideRetry() callers" | done | 12:01:20 → 12:02:32 | Grep at 12:02:10 |
| c1201 | a2 | test-runner · "re-run policy.test.ts" | running | 12:04:25 → null | Bash "pnpm vitest run" at 12:04:50 |
| c1202 | a4 | code-reviewer · "review diff" | running | 12:04:10 → null | Read `src/api/attempts.ts` "Read src/api/attempts.ts" at 12:04:30 |
| c1140 | a3 | researcher · "survey log fields" | done | 11:42:00 → 11:50:00 | Read at 11:49:00 |
| c1100 | a5 | explorer · "map retry call sites" | done | 11:02:00 → 11:06:00 | Grep at 11:05:00 |

A done subagent also has `stopped_at` equal to its `ended_at`.

## Errors

None. The layout, attribution and thread functions never throw: a timestamp that doesn't parse
leaves its item out (no row, marker or entry).

## State transitions
None.
