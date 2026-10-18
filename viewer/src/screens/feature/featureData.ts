import type {
  Commit,
  CoverageStatus,
  Decision,
  Feature,
  GateCheck,
  Index,
  Issue,
  LogEntry,
  Question,
  Scenario,
  ScenarioKind,
  Session,
  Task,
  VerifyRun,
} from "../../../../src/core/types";

/** Pure lookups the feature detail screen derives from the index. */

export const TAB_IDS = [
  "context",
  "impact",
  "stories",
  "contract",
  "plan",
  "activity",
  "as-built",
] as const;
export type TabId = (typeof TAB_IDS)[number];

export function isTabId(tab: string | null): tab is TabId {
  return (TAB_IDS as readonly (string | null)[]).includes(tab);
}

/** Whether an ID is this feature or one of its stories, scenarios or tasks. */
export function ownsId(f: Feature, id: string): boolean {
  const n = f.id.slice(2);
  return (
    id === f.id || id.startsWith(`ST-${n}.`) || id.startsWith(`S-${n}.`) || id.startsWith(`T-${n}.`)
  );
}

export const scenariosOf = (f: Feature): Scenario[] =>
  f.detail?.stories.flatMap((s) => s.scenarios) ?? [];

export function countBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

export const KINDS: ScenarioKind[] = ["happy", "negative", "edge"];
export const COVERAGES: CoverageStatus[] = ["passing", "failing", "not-run", "untested"];

/** "4 passing", "1 failing · 1 untested" for a set of scenarios. */
export function coverageBreakdown(scenarios: Scenario[]): string {
  const counts = countBy(scenarios, (s) => s.coverage.status);
  return COVERAGES.filter((c) => counts[c])
    .map((c) => `${counts[c]} ${c === "not-run" ? "not run" : c}`)
    .join(" · ");
}

/** The newest verify run that reported this scenario. */
export function latestRunFor(index: Index, scenarioId: string): VerifyRun | undefined {
  return index.runs
    .filter((r) => r.scenarios.some((s) => s.id === scenarioId))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

/** The error line and source pointer under a failing test in a run's output tail. */
export function failureLine(run: VerifyRun, testName: string): string | null {
  const lines = run.output_tail.split("\n");
  const at = lines.findIndex((l) => l.includes(testName));
  if (at < 0) return null;
  const rest = lines.slice(at + 1).map((l) => l.trim());
  const error = rest.find((l) => l.length > 0);
  if (!error) return null;
  const pointer = rest.find((l) => /^❯\s+\S+/.test(l));
  const where = pointer?.replace(/^❯\s+/, "").split("/").pop();
  return where ? `${error} · ${where}` : error;
}

export const isOpenTask = (t: Task) => t.status !== "done" && t.status !== "skipped";

/** Questions raised for the feature or linked to it; open ones first. */
export function relatedQuestions(index: Index, f: Feature): Question[] {
  const rank = (q: Question) => (q.status === "open" ? 0 : 1);
  return index.questions
    .filter((q) => q.feature === f.id || q.links.some((id) => ownsId(f, id)))
    .sort((a, b) => rank(a) - rank(b) || b.id.localeCompare(a.id));
}

const DECISION_RANK: Record<Decision["status"], number> = {
  proposed: 0,
  accepted: 1,
  rejected: 2,
  superseded: 3,
};

export function relatedDecisions(index: Index, f: Feature): Decision[] {
  return index.decisions
    .filter((d) => d.links.some((id) => ownsId(f, id)))
    .sort((a, b) => DECISION_RANK[a.status] - DECISION_RANK[b.status] || b.id.localeCompare(a.id));
}

export function relatedIssues(index: Index, f: Feature): Issue[] {
  const rank = (i: Issue) => (i.status === "open" || i.status === "in-progress" ? 0 : 1);
  return index.issues
    .filter((i) => i.links.some((id) => ownsId(f, id)))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

export type FeedItem =
  | { kind: "log"; at: string; entry: LogEntry }
  | { kind: "session"; at: string; session: Session; commits: Commit[] }
  | { kind: "commit"; at: string; commit: Commit }
  | { kind: "run"; at: string; run: VerifyRun };

/** One time-ordered feed: log entries, sessions (with their commits), other commits, runs. */
export function activityFeed(index: Index, f: Feature): FeedItem[] {
  const sessions = index.sessions.filter((s) => s.touched.some((id) => ownsId(f, id)));
  const inSession = new Set(sessions.map((s) => s.id));
  const bySha = new Map(index.commits.map((c) => [c.sha, c]));
  const items: FeedItem[] = [
    ...(f.detail?.log ?? []).map((entry): FeedItem => ({ kind: "log", at: entry.at, entry })),
    ...sessions.map((session): FeedItem => ({
      kind: "session",
      at: session.ended_at ?? session.started_at,
      session,
      commits: session.commits.flatMap((sha) => bySha.get(sha) ?? []),
    })),
    ...index.commits
      .filter((c) => c.refs.some((id) => ownsId(f, id)))
      .filter((c) => !c.session || !inSession.has(c.session))
      .map((commit): FeedItem => ({ kind: "commit", at: commit.at, commit })),
    ...index.runs
      .filter((r) => ownsId(f, r.target))
      .map((run): FeedItem => ({ kind: "run", at: run.at, run })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** A failing gate check's detail, enriched with what the index already knows. */
export function checkDetail(index: Index, f: Feature, check: GateCheck): string {
  const detail = check.detail ?? "";
  if (check.ok) return detail;
  if (check.id === "verify.tasks-done" && f.detail) {
    const open = f.detail.tasks.filter(isOpenTask).map((t) => t.id);
    return open.length ? `${detail} · ${open.join(", ")}` : detail;
  }
  const question = /^(Q-\d{4}) is open$/.exec(detail)?.[1];
  const q = question ? index.questions.find((x) => x.id === question) : undefined;
  return q ? `${detail}: ${q.title}` : detail;
}

/** A transition log body without its leading "from → to." line start. */
export const transitionRest = (body: string): string =>
  body.replace(/^\S+\s*→\s*\S+?\.?(\s|$)/, "").trim();

/** IDs of open blocking questions stopping this feature. */
export const blockingQuestions = (f: Feature): string[] =>
  f.derived.blocked_by.filter((b) => b.kind === "question").map((b) => b.id);
