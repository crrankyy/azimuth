import type {
  Feature,
  FeatureStatus,
  Index,
  Milestone,
  MilestoneStatus,
} from "../../../../src/core/types";
import { ago, daysUntil, plural, shortDate } from "../../lib/format";
import { LIFECYCLE, PARKED } from "../../lib/status";

/** Pure helpers shared by the Features table and board, the roadmap and the overview. */

export type FlagKey = "conflict" | "modified" | "stale" | "blocked" | "failing";

/** Display order and tone; warnings draw a square dot, dangers a round one. */
export const FLAGS: Record<FlagKey, { label: string; short: string; tone: "warning" | "danger" }> =
  {
    conflict: { label: "File conflict", short: "Conflict", tone: "warning" },
    modified: { label: "Modified", short: "Modified", tone: "warning" },
    stale: { label: "Stale", short: "Stale", tone: "warning" },
    blocked: { label: "Blocked", short: "Blocked", tone: "danger" },
    failing: { label: "Verify failing", short: "Verify failing", tone: "danger" },
  };
export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

/** Features with a failing verify, as the CLI derives it for the inbox. */
export function failingFeatures(index: Index): Set<string> {
  return new Set(index.inbox.flatMap((i) => (i.kind === "failing-verify" && i.ref ? [i.ref] : [])));
}

export function featureFlags(f: Feature, failing: Set<string>): FlagKey[] {
  const d = f.derived;
  const on: Record<FlagKey, boolean> = {
    conflict: d.file_conflicts.length > 0,
    modified: d.modified_since_approval,
    stale: d.stale,
    blocked: d.blocked_by.length > 0,
    failing: failing.has(f.id),
  };
  return FLAG_KEYS.filter((k) => on[k]);
}

/** The reason behind a flag, for its tooltip. */
export function flagReason(f: Feature, flag: FlagKey): string {
  const d = f.derived;
  switch (flag) {
    case "conflict":
      return d.file_conflicts.map((c) => `${c.path} is also changed by ${c.with}`).join("; ");
    case "modified":
      return "The spec changed after it was approved";
    case "stale":
      return "In progress with no activity for days";
    case "blocked":
      return `Blocked by ${d.blocked_by.map((b) => b.id).join(", ")}`;
    case "failing":
      return "A verify run failed";
  }
}

export const isParked = (f: Feature): boolean => PARKED.includes(f.status);
/** Cancelled and superseded features don't count toward milestones or coverage. */
export const isRetired = (f: Feature): boolean =>
  f.status === "cancelled" || f.status === "superseded";

const STATUS_RANK = new Map<FeatureStatus, number>([...LIFECYCLE, ...PARKED].map((s, i) => [s, i]));
export const statusRank = (s: FeatureStatus): number => STATUS_RANK.get(s) ?? 99;

/** "7m ago" for recent work, a date once it is two weeks old. */
export function activityLabel(iso: string | null, now: number): string {
  if (!iso) return "—";
  return now - Date.parse(iso) < 14 * 86_400_000 ? ago(iso, now) : shortDate(iso);
}

export function daysLeftLabel(target: string | null, now: number): string {
  const d = daysUntil(target, now);
  if (d === null) return "";
  return d >= 0 ? `${plural(d, "day")} left` : `${plural(-d, "day")} overdue`;
}

/** The one-line summary next to a milestone's name. */
export function milestoneMeta(m: Milestone, now: number): string {
  const done = `${m.progress.done} of ${m.progress.total} done`;
  if (m.status === "released") return `Released ${shortDate(m.released_at)} · ${done}`;
  const target = m.target ? `Target ${shortDate(m.target)}` : "No target";
  if (m.status === "planned") return target;
  return [target, daysLeftLabel(m.target, now), done].filter(Boolean).join(" · ");
}

const MILESTONE_RANK: Record<MilestoneStatus, number> = { active: 0, planned: 1, released: 2 };

/** Active first, then planned by target, then released (latest first). */
export function orderedMilestones(milestones: Milestone[]): Milestone[] {
  const when = (m: Milestone) =>
    m.status === "released" ? (m.released_at ?? "") : (m.target ?? "9999");
  return [...milestones].sort((a, b) => {
    const rank = MILESTONE_RANK[a.status] - MILESTONE_RANK[b.status];
    if (rank !== 0) return rank;
    const order =
      a.status === "released" ? when(b).localeCompare(when(a)) : when(a).localeCompare(when(b));
    return order || a.id.localeCompare(b.id);
  });
}

export type SortKey = "activity" | "priority" | "id";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "activity", label: "Last activity" },
  { value: "priority", label: "Priority" },
  { value: "id", label: "ID" },
];

const byActivity = (a: Feature, b: Feature) =>
  (b.derived.last_activity ?? "").localeCompare(a.derived.last_activity ?? "");

export function sortFeatures(list: Feature[], sort: SortKey): Feature[] {
  const out = [...list];
  if (sort === "id") return out.sort((a, b) => a.id.localeCompare(b.id));
  if (sort === "priority")
    return out.sort((a, b) => a.priority.localeCompare(b.priority) || byActivity(a, b));
  return out.sort(byActivity);
}

export interface Filters {
  status: string[];
  milestone: string[];
  priority: string[];
  tag: string[];
  flags: string[];
}
export const NO_FILTERS: Filters = { status: [], milestone: [], priority: [], tag: [], flags: [] };
/** The milestone filter's value for features without one. */
export const NO_MILESTONE = "none";

export function matchesFilters(f: Feature, flags: FlagKey[], filters: Filters): boolean {
  const any = (values: string[], test: (v: string) => boolean) =>
    values.length === 0 || values.some(test);
  return (
    any(filters.status, (v) => f.status === v) &&
    any(filters.milestone, (v) => (f.milestone ?? NO_MILESTONE) === v) &&
    any(filters.priority, (v) => f.priority === v) &&
    any(filters.tag, (v) => f.tags.includes(v)) &&
    any(filters.flags, (v) => flags.includes(v as FlagKey))
  );
}
