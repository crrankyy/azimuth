import { featureOf } from "../../../../src/core/ids";
import type {
  Commit,
  Feature,
  Index,
  LiveSession,
  LogEntry,
  Session,
  VerifyRun,
} from "../../../../src/core/types";

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

const unique = (ids: (string | null)[]) => [...new Set(ids.filter((x): x is string => !!x))];

/**
 * Everything that happened, newest first. A session's commits are shown inside its SessionCard,
 * so only commits outside any known session get their own row.
 */
export function buildFeed(index: Index): FeedItem[] {
  const sessionIds = new Set(index.sessions.map((s) => s.id));
  const items: FeedItem[] = [
    ...index.sessions.map((session) => ({
      kind: "session" as const,
      key: session.id,
      at: session.ended_at ?? session.started_at,
      features: unique(session.touched.map(featureOf)),
      session,
    })),
    ...index.commits
      .filter((c) => !c.session || !sessionIds.has(c.session))
      .map((commit) => ({
        kind: "commit" as const,
        key: commit.sha,
        at: commit.at,
        features: unique(commit.refs.map(featureOf)),
        commit,
      })),
    ...index.runs.map((run) => ({
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

/** Items grouped by UTC day, keeping the newest-first order. */
export function byDay(items: FeedItem[]): { day: string; items: FeedItem[] }[] {
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const day = item.at.slice(0, 10);
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
