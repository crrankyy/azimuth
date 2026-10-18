import { ACTIVE_STATUSES } from "../../../../src/core/flows";
import type { Feature, Index, Issue, IssueType, Level, Severity } from "../../../../src/core/types";

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

/** Risk files the index left out because they failed validation. */
export function invalidRisks(index: Index): { id: string; reason: string }[] {
  return index.problems.flatMap((p) => {
    if (p.severity !== "error") return [];
    const id = (p.ref ?? "").startsWith("RISK-") ? p.ref : /(RISK-\d{4})/.exec(p.file)?.[1];
    if (!id || index.issues.some((i) => i.id === id)) return [];
    return [{ id, reason: p.message.split(/\.\s/)[0] ?? p.message }];
  });
}
