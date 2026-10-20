import type { Index } from "../../../../src/core/types";
import type { ActivityKind } from "./feed";
import { activityData, type ActivityData, type SessionStatus } from "./sessions";

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

/** Window bounds, ticks and label in the viewer's local time (feature.md Assumptions). */
export function timelineWindow(range: TimelineRange, now: number): TimelineWindow {
  return { range, start: now, end: now, ticks: [], label: "" };
}

export function layoutTimeline(
  index: Index,
  options: TimelineOptions,
  _data: ActivityData = activityData(index, options.now),
): TimelineLayout {
  return { window: timelineWindow(options.range, options.now), now: 0, rows: [], earlier: [] };
}
