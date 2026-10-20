import { featureOf } from "../../../../src/core/ids";
import type { Index, LiveWaitSpan } from "../../../../src/core/types";
import { actionLabel, agentRows, type AgentRow } from "../../data/agents";
import { clock, dayHeading, localDay, shortDate } from "../../lib/format";
import { href } from "../../lib/router";
import { AGENT_LOOK } from "../../lib/status";
import type { ActivityKind } from "./feed";
import {
  activityData,
  sessionMatchesFeature,
  shortSessionId,
  type ActivityData,
  type ActivitySession,
  type SessionStatus,
} from "./sessions";

export type TimelineRange = "75m" | "today" | "3d";

export const RANGES: { value: TimelineRange; label: string }[] = [
  { value: "75m", label: "Last 75 min" },
  { value: "today", label: "Today" },
  { value: "3d", label: "3 days" },
];

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
  /**
   * The row's own agent's current action while that agent is running, else null: "<tool> <file
   * name>" ("Edit policy.ts", as in the design) when it has a file, else its summary.
   */
  action: string | null;
  /** The whole action (F-015's actionLabel, "Edit src/retry/policy.ts") for its title. */
  actionTitle: string | null;
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

/** Window bounds, ticks and label in the viewer's local time (feature.md Assumptions). */
export function timelineWindow(range: TimelineRange, now: number): TimelineWindow {
  if (range === "75m") return recentWindow(now);
  const today = new Date(now);
  const day = (offset: number, hours = 0) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hours).getTime();
  if (range === "today") {
    const start = day(0);
    const end = day(1);
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => tick(day(0, h), start, end, clockOf));
    return { range, start, end, ticks, label: dayHeading(isoOf(now), now) };
  }
  const start = day(-2);
  const end = day(1);
  const ticks = [-2, -1, 0].map((d) => tick(day(d), start, end, dayLabel));
  return {
    range,
    start,
    end,
    ticks,
    label: `${shortDate(isoOf(start))} – ${shortDate(isoOf(now))}`,
  };
}

const QUARTER = 15 * 60_000;

/** Ends at the first local quarter hour strictly after `now`; starts 75 minutes earlier. */
function recentWindow(now: number): TimelineWindow {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() - (next.getMinutes() % 15) + 15);
  const end = next.getTime();
  const start = end - 5 * QUARTER;
  const ticks = [0, 1, 2, 3, 4].map((i) => tick(start + i * QUARTER, start, end, clockOf));
  // "Today" or "Yesterday", from the heading of the start's day.
  const day = dayHeading(isoOf(start), now).split(" · ")[0];
  return {
    range: "75m",
    start,
    end,
    ticks,
    label: `${day}, ${clockOf(start)} – ${clockOf(end)}`,
  };
}

const isoOf = (ms: number) => new Date(ms).toISOString();
const clockOf = (ms: number) => clock(isoOf(ms));
/** "Fri Oct 16" */
const dayLabel = (ms: number) =>
  `${new Date(ms).toLocaleDateString("en-US", { weekday: "short" })} ${shortDate(isoOf(ms))}`;

const round = (x: number) => Math.round(x * 100) / 100;

function tick(at: number, start: number, end: number, label: (ms: number) => string): TimelineTick {
  return { left: round(((at - start) / (end - start)) * 100), label: label(at) };
}

/** "11:00–11:58", or "11:40–now" without an end. */
const timeRange = (from: string, to: string | null) => `${clock(from)}–${to ? clock(to) : "now"}`;

export function layoutTimeline(
  index: Index,
  options: TimelineOptions,
  data: ActivityData = activityData(index, options.now),
): TimelineLayout {
  const window = timelineWindow(options.range, options.now);
  const percent = (ms: number) => ((ms - window.start) / (window.end - window.start)) * 100;
  const layout: TimelineLayout = {
    window,
    now: round(percent(options.now)),
    rows: [],
    earlier: [],
  };
  if (!options.kinds.has("session")) return layout;

  const place = (from: number, to: number) => {
    const left = Math.max(from, window.start);
    const right = Math.min(to, window.end);
    if (!(left < right)) return null;
    return { left: round(percent(left)), width: round(percent(right) - percent(left)) };
  };
  const sessions = data.sessions.filter((s) => sessionMatchesFeature(s, options.feature));
  for (const s of sessions) {
    const from = Date.parse(s.start);
    const to = s.end ? Date.parse(s.end) : options.now;
    const base = place(from, to);
    if (!base) {
      if (isEarlierToday(s, to, window, options)) layout.earlier.push(earlierSession(s));
      continue;
    }
    const rows = s.live ? agentRows(s.live) : [];
    const main = rows[0] ?? null;
    layout.rows.push({
      key: s.key,
      depth: 0,
      status: s.status,
      statusLabel: statusLabel(s.status),
      name: shortSessionId(s),
      id: s.key,
      detail: null,
      skill: s.skill,
      feature: rowFeature(s),
      href: sessionHref(s),
      spans: [
        { kind: baseKind(s.status), ...base, title: baseTitle(s.status, s.start, s.end) },
        ...waitSpans(main?.waits ?? [], from, to, options.now, place),
      ],
      markers: markers(s, data, window, percent, options.kinds),
      ...runningAction(s.status === "running" ? main : null),
    });
    if (!options.kinds.has("subagent")) continue;
    const subagents = rows
      .slice(1)
      .filter((a) => Date.parse(a.started_at) < to)
      .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
    for (const agent of subagents) {
      const row = subagentRow(s, agent, to, options.now, place);
      if (row) layout.rows.push(row);
    }
  }
  return layout;
}

/** Lower-case status words beside the mark: "running", "waiting on you", "done", "open". */
const statusLabel = (status: SessionStatus) =>
  status === "open" ? "open" : AGENT_LOOK[status].label.toLowerCase();

const baseKind = (status: SessionStatus): SpanKind =>
  status === "done" || status === "open" ? status : "running";

function baseTitle(status: SessionStatus, from: string, to: string | null): string {
  const times = timeRange(from, to);
  if (status === "done") return `Finished · ${times}`;
  if (status === "open") return `Open · ${times} · no live data`;
  return `Running · ${times}`;
}

/** The agent's waits on you, clipped to its own span; drawn striped over it. */
function waitSpans(
  waits: LiveWaitSpan[],
  from: number,
  to: number,
  now: number,
  place: (from: number, to: number) => { left: number; width: number } | null,
): TimelineSpan[] {
  return waits.flatMap((wait) => {
    const at = place(
      Math.max(Date.parse(wait.from), from),
      Math.min(wait.to ? Date.parse(wait.to) : now, to),
    );
    if (!at) return [];
    const title = `Waiting on you · ${timeRange(wait.from, wait.to)} · ${wait.reason}`;
    return [{ kind: "waiting" as const, ...at, title }];
  });
}

/** The live session's feature, else the first touched feature, else any of its features. */
function rowFeature(s: ActivitySession): string | null {
  const touched = s.session?.touched.map(featureOf).find((id) => id !== null);
  return s.live?.feature ?? touched ?? s.features[0] ?? null;
}

/** A finished or open session opens its card; a live one its transcript page. */
function sessionHref(s: ActivitySession): string {
  if (s.ses && (s.status === "done" || s.status === "open")) return href("activity", s.ses);
  return s.live ? href("agents", s.live.claude_session) : href("activity", s.key);
}

/** The agent's own latest action while it runs, short for the row and whole for its title. */
function runningAction(agent: AgentRow | null): Pick<TimelineRow, "action" | "actionTitle"> {
  const current = agent?.status === "running" ? agent.current : null;
  if (!current) return { action: null, actionTitle: null };
  const name = current.file?.split(/[\\/]/).pop();
  return {
    action: name ? `${current.tool} ${name}` : actionLabel(current),
    actionTitle: actionLabel(current),
  };
}

function subagentRow(
  s: ActivitySession,
  agent: AgentRow,
  sessionEnd: number,
  now: number,
  place: (from: number, to: number) => { left: number; width: number } | null,
): TimelineRow | null {
  const from = Date.parse(agent.started_at);
  // A subagent without an end stops with its session (at `now` while the session runs).
  const to = agent.ended_at ? Date.parse(agent.ended_at) : sessionEnd;
  const base = place(from, to);
  if (!base) return null;
  const end = agent.ended_at ?? s.end;
  return {
    key: `${s.key}/${agent.agent_id}`,
    depth: 1,
    status: agent.status,
    statusLabel: statusLabel(agent.status),
    name: agent.name,
    id: agent.agent_id ?? agent.key,
    detail: agent.description,
    skill: null,
    feature: null,
    href: agent.href,
    spans: [
      {
        kind: baseKind(agent.status),
        ...base,
        title: baseTitle(agent.status, agent.started_at, end),
      },
      ...waitSpans(agent.waits, from, to, now, place),
    ],
    markers: [],
    ...runningAction(agent),
  };
}

/** Commits and runs (when their chips are on), questions and timed ADRs in the window, by time. */
function markers(
  s: ActivitySession,
  data: ActivityData,
  window: TimelineWindow,
  percent: (ms: number) => number,
  kinds: ReadonlySet<ActivityKind>,
): TimelineMarker[] {
  const { attribution } = data;
  const all: Omit<TimelineMarker, "left">[] = [
    ...(kinds.has("commit") ? (attribution.commits.get(s.key) ?? []) : []).map((c) => ({
      kind: "commit" as const,
      id: c.sha,
      at: c.at,
      title: `Commit ${c.sha} · ${c.subject}`,
    })),
    ...(kinds.has("run") ? (attribution.runs.get(s.key) ?? []) : []).map((r) => ({
      kind: r.ok ? ("run-pass" as const) : ("run-fail" as const),
      id: r.id,
      at: r.at,
      title: `${r.id} ${r.ok ? "passed" : "failed"} · ${r.target}`,
    })),
    ...(attribution.questions.get(s.key) ?? []).map((q) => ({
      kind: "question" as const,
      id: q.id,
      at: q.raised_at,
      title: `${q.id} raised · ${q.title}`,
    })),
    ...(attribution.decisions.get(s.key) ?? []).flatMap(({ decision, at }) =>
      at
        ? [
            {
              kind: "adr" as const,
              id: decision.id,
              at,
              title: `${decision.id} proposed · ${decision.title}`,
            },
          ]
        : [],
    ),
  ];
  return all
    .map((m) => ({ ...m, ms: Date.parse(m.at) }))
    .filter((m) => window.start <= m.ms && m.ms <= window.end)
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms, ...m }) => ({ ...m, left: round(percent(ms)) }));
}

/** Only for Last 75 min: a session of today's local day that ended before the window. */
function isEarlierToday(
  s: ActivitySession,
  to: number,
  window: TimelineWindow,
  options: TimelineOptions,
): boolean {
  return (
    window.range === "75m" &&
    s.end !== null &&
    to <= window.start &&
    localDay(s.start) === localDay(isoOf(options.now))
  );
}

function earlierSession(s: ActivitySession): EarlierSession {
  return {
    id: s.ses ?? s.key.slice(0, 8),
    label: timeRange(s.start, s.end),
    href: s.ses ? href("activity", s.ses) : href("agents", s.live?.claude_session ?? s.key),
  };
}
