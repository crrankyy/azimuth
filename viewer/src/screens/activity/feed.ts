import { featureOf } from "../../../../src/core/ids";
import { dayHeading, localDay } from "../../lib/format";
import type {
  Commit,
  Feature,
  Index,
  LiveSession,
  LogEntry,
  Session,
  VerifyRun,
} from "../../../../src/core/types";
import type { ActivityData, SessionStatus } from "./sessions";

/** The kind chips: Sessions, Subagents, Commits, Verify runs, Your actions. */
export type ActivityKind = "session" | "subagent" | "commit" | "run" | "action";
/** Feed item kinds (unchanged). */
export type FeedKind = "session" | "commit" | "run" | "action";

interface Base {
  key: string;
  at: string;
  /** Features this item belongs to; empty for untracked commits. */
  features: string[];
}

export type FeedItem =
  | (Base & { kind: "session"; session: Session })
  | (Base & { kind: "commit"; commit: Commit })
  | (Base & { kind: "run"; run: VerifyRun })
  | (Base & { kind: "action"; entry: LogEntry; feature: Feature });

/** "all", "untracked" (commits without refs) or a feature ID. */
export type FeatureFilter = string;

export type Period = "today" | "yesterday" | "earlier";

export interface PeriodGroup {
  period: Period;
  /** "Today · Sunday, Oct 18" | "Yesterday · Saturday, Oct 17" | "Earlier" */
  heading: string;
  items: FeedItem[];
}

const unique = (ids: (string | null)[]) => [...new Set(ids.filter((x): x is string => !!x))];

/**
 * Newest first. Leaves out persisted sessions whose activity status is running or waiting (they
 * are cards) and commits and runs owned by a listed session (they are in its thread).
 */
export function buildFeed(index: Index, data: ActivityData): FeedItem[] {
  const listed = index.sessions.filter((s) => !isCard(data.byKey.get(s.id)?.status));
  const listedIds = new Set(listed.map((s) => s.id));
  const inThread = (id: string) => {
    const owner = data.attribution.owner.get(id);
    return owner !== undefined && listedIds.has(owner);
  };
  const items: FeedItem[] = [
    ...listed.map((session) => ({
      kind: "session" as const,
      key: session.id,
      at: session.ended_at ?? session.started_at,
      features: unique(session.touched.map(featureOf)),
      session,
    })),
    ...index.commits
      .filter((c) => !inThread(c.sha))
      .map((commit) => ({
        kind: "commit" as const,
        key: commit.sha,
        at: commit.at,
        features: unique(commit.refs.map(featureOf)),
        commit,
      })),
    ...index.runs
      .filter((r) => !inThread(r.id))
      .map((run) => ({
        kind: "run" as const,
        key: run.id,
        at: run.at,
        features: unique([featureOf(run.target)]),
        run,
      })),
    ...index.features.flatMap((feature) =>
      (feature.detail?.log ?? [])
        .filter((entry) => entry.actor === "you")
        .map((entry, i) => ({
          kind: "action" as const,
          key: `${feature.id}-${entry.at}-${i}`,
          at: entry.at,
          features: [feature.id],
          entry,
          feature,
        })),
    ),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Running and waiting sessions are shown as cards above the feed. */
const isCard = (status: SessionStatus | undefined) => status === "running" || status === "waiting";

export function matchesFeature(item: FeedItem, filter: FeatureFilter): boolean {
  if (filter === "all") return true;
  if (filter === "untracked") return item.kind === "commit" && item.commit.refs.length === 0;
  return item.features.includes(filter);
}

/** Feature filter options with counts, busiest first. */
export function featureCounts(items: FeedItem[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items)
    for (const id of item.features) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

const PERIODS: Period[] = ["today", "yesterday", "earlier"];

/** Today and Yesterday by local day, everything older in Earlier; empty groups are left out. */
export function byPeriod(items: FeedItem[], now: number): PeriodGroup[] {
  const today = localDay(new Date(now).toISOString());
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  const yesterday = localDay(before.toISOString());
  const periodOf = (item: FeedItem): Period => {
    const day = localDay(item.at);
    if (day === today) return "today";
    if (day === yesterday) return "yesterday";
    return "earlier";
  };
  return PERIODS.flatMap((period) => {
    const grouped = items.filter((item) => periodOf(item) === period);
    const [first] = grouped;
    if (!first) return [];
    const heading = period === "earlier" ? "Earlier" : dayHeading(first.at, now);
    return [{ period, heading, items: grouped }];
  });
}

/** Items grouped by local day, keeping the newest-first order. */
export function byDay(items: FeedItem[]): { day: string; items: FeedItem[] }[] {
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const day = localDay(item.at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

const LIVE_WINDOW_MS = 120_000;

/** Same rule as the sidebar's live strip: not ended and seen in the last two minutes. */
export function isLive(at: string, now: number): boolean {
  return now - Date.parse(at) < LIVE_WINDOW_MS;
}

export function activeLive(live: LiveSession[], now: number): LiveSession[] {
  return live.filter((s) => !s.ended_at && isLive(s.last_seen_at, now));
}
