import { ACTIVE_STATUSES } from "../../../../src/core/flows";
import type {
  Feature,
  Id,
  ImpactChange,
  Index,
  Issue,
  IssueType,
  Level,
  Severity,
} from "../../../../src/core/types";
import { localDay, plural, shortDate } from "../../lib/format";
import { href } from "../../lib/router";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
export const LEVEL_ORDER: Level[] = ["low", "medium", "high"];
const TYPE_ORDER: IssueType[] = ["bug", "debt", "risk"];

export const isOpen = (i: Issue) => i.status === "open" || i.status === "in-progress";

const levelRank = (l: Level | null) => (l ? LEVEL_ORDER.indexOf(l) : -1);

/** Open first, then grouped by type, most severe first. */
export function sortIssues(issues: Issue[]): Issue[] {
  const weight = (i: Issue) =>
    i.type === "risk"
      ? levelRank(i.likelihood) + levelRank(i.impact)
      : 4 - SEVERITY_ORDER.indexOf(i.severity ?? "low");
  return [...issues].sort(
    (a, b) =>
      Number(isOpen(b)) - Number(isOpen(a)) ||
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      weight(b) - weight(a) ||
      a.id.localeCompare(b.id),
  );
}

/** "#/issues/BUG-0001/page". */
export function issuePageHref(id: Id): string {
  return href("issues", id, "page");
}

/** Where j, k and Esc lead from an issue's page: neighbours in sortIssues(issues) order (null past either end), and the list. */
export function issuePageTargets(
  issues: Issue[],
  id: Id,
): { previous: string | null; next: string | null; back: string } {
  const order = sortIssues(issues);
  const at = order.findIndex((i) => i.id === id);
  const page = (i: Issue | undefined) => (at >= 0 && i ? issuePageHref(i.id) : null);
  return { previous: page(order[at - 1]), next: page(order[at + 1]), back: href("issues", id) };
}

/** "open 4 days", "open 1 day", "opened today" (calendar days since `created`, local time); "closed Sep 15" when resolved or won't fix. */
export function issueAge(issue: Issue, now: number): string {
  if (!isOpen(issue)) return `closed ${shortDate(issue.resolved_at)}`.trim();
  // Both local days parse as UTC midnights, so a DST change can't shift the count by one.
  const today = localDay(new Date(now).toISOString());
  const days = Math.round((Date.parse(today) - Date.parse(localDay(issue.created))) / 86_400_000);
  return days > 0 ? `open ${plural(days, "day")}` : "opened today";
}

/** 0–4 from likelihood × impact; ≥3 is the danger zone, 2 the warning zone. */
export function riskScore(likelihood: Level, impact: Level): number {
  return levelRank(likelihood) + levelRank(impact);
}

/** The body of a `## Title` section, or null. */
export function sectionOf(body: string, title: string): string | null {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => new RegExp(`^#{1,6}\\s+${title}\\s*$`, "i").test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l));
  const text = lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
  return text || null;
}

/** Active features that also change `path` (impact or a reported file conflict). */
export function featuresChanging(index: Index, path: string): Feature[] {
  return index.features.filter(
    (f) =>
      f.derived.file_conflicts.some((c) => c.path === path) ||
      (ACTIVE_STATUSES.includes(f.status) &&
        (f.detail?.impact ?? []).some(
          (e) => e.path === path && (e.change === "create" || e.change === "modify"),
        )),
  );
}

export interface PlannedChange {
  feature: Id;
  /** The feature's impact change for the path; null when the index has no detail for it (a file conflict only). */
  change: ImpactChange | null;
}

/** featuresChanging(index, path), each with its impact change for the path. */
export function plannedChanges(index: Index, path: string): PlannedChange[] {
  return featuresChanging(index, path).map((f) => ({
    feature: f.id,
    change: f.detail?.impact.find((e) => e.path === path && e.change !== "read")?.change ?? null,
  }));
}

/** "Planned changes: F-005 (modify) and F-007" ("A, B and C" for three); null for none. */
export function plannedChangesLabel(changes: PlannedChange[]): string | null {
  const names = changes.map((c) => (c.change ? `${c.feature} (${c.change})` : c.feature));
  const last = names.pop();
  if (!last) return null;
  return `Planned changes: ${names.length > 0 ? `${names.join(", ")} and ` : ""}${last}`;
}

/** Risk files the index left out because they failed validation. */
export function invalidRisks(index: Index): { id: string; reason: string }[] {
  return index.problems.flatMap((p) => {
    if (p.severity !== "error") return [];
    const id = (p.ref ?? "").startsWith("RISK-") ? p.ref : /(RISK-\d{4})/.exec(p.file)?.[1];
    if (!id || index.issues.some((i) => i.id === id)) return [];
    return [{ id, reason: p.message.split(/\.\s/)[0] ?? p.message }];
  });
}
