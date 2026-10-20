import type { Facts } from "./facts";
import { ACTIVE_STATUSES } from "./flows";
import { globToRegExp, matchesAny } from "./glob";
import { featureOf } from "./ids";
import type { FeatureEntity, Model } from "./model";
import { specHash } from "./spec-hash";
import type {
  Coverage,
  CoverageStatus,
  FeatureDerived,
  FeatureStatus,
  Milestone,
  ScenarioTest,
  VerifyRun,
} from "./types";

/** Statuses that no longer count toward progress or reverse dependencies. */
export const RETIRED_STATUSES: FeatureStatus[] = ["cancelled", "superseded"];

export type DerivedInfo = Omit<FeatureDerived, "next_gate">;

export interface ScenarioCoverage {
  status: CoverageStatus;
  tests: ScenarioTest[];
}

export interface Derived {
  features: Map<string, FeatureEntity>;
  info: Map<string, DerivedInfo>;
  coverage: Map<string, ScenarioCoverage>;
  /** Latest run per task ID. */
  lastRun: Map<string, VerifyRun>;
  /** Current spec hash per feature (null without spec files). */
  currentHash: Map<string, string | null>;
}

/** Latest run (by time) whose scenario list mentions each scenario. */
function latestScenarioRuns(runs: VerifyRun[]): Map<string, CoverageStatus> {
  const out = new Map<string, CoverageStatus>();
  for (const run of runs) for (const s of run.scenarios) out.set(s.id, s.status);
  return out;
}

export function coverageOf(
  scenarioId: string,
  facts: Facts,
  runStatus: Map<string, CoverageStatus>,
): ScenarioCoverage {
  const refs = facts.tests.get(scenarioId) ?? [];
  if (refs.length === 0) return { status: "untested", tests: [] };
  const status = runStatus.get(scenarioId) ?? "not-run";
  return {
    status,
    tests: refs.map((t) => ({
      file: t.file,
      name: t.name,
      status,
      confidence: t.confidence,
      committed: t.committed !== false,
    })),
  };
}

function maxTime(values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (!Number.isNaN(ms) && ms > bestMs) {
      best = v;
      bestMs = ms;
    }
  }
  return best;
}

/** Abbreviated SHAs can differ in length; one is a prefix of the other for the same commit. */
export const sameCommit = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/**
 * Whether a commit changed anything outside `.azimuth/`, i.e. more than Azimuth's own records.
 * A commit whose changed files aren't known counts as a code commit.
 */
export function isCodeCommit(sha: string, facts: Facts): boolean {
  const files = changedFiles(sha, facts);
  return !files || files.some((path) => !path.startsWith(".azimuth/"));
}

/** The files a commit changed, as git prints them; undefined when they aren't known. */
function changedFiles(sha: string, facts: Facts): string[] | undefined {
  return facts.git.files.get(sha) ?? [...facts.git.files].find(([s]) => sameCommit(s, sha))?.[1];
}

/**
 * Whether any commit after `sha`, up to HEAD, is a code commit; null when `sha` isn't in the
 * history the index read.
 */
export function codeChangedSince(sha: string, facts: Facts): boolean | null {
  const at = facts.git.commits.findIndex((c) => sameCommit(c.sha, sha));
  if (at === -1) return null;
  return facts.git.commits.slice(0, at).some((c) => isCodeCommit(c.sha, facts));
}

/** Why a passing run is no longer current. */
export type StaleCause =
  /**
   * A later code commit changed a path that isn't ignored and is in scope (or, without a scope,
   * outside .azimuth/).
   */
  | { kind: "changed"; commit: string; path: string }
  /** A later commit's changed files aren't known. */
  | { kind: "unknown-files"; commit: string }
  /** The run's commit isn't in the history the index read. */
  | { kind: "outside-history" };

/**
 * The earliest commit after `sha`, up to HEAD, that changed a path outside .azimuth/ that isn't
 * `ignored` and for which `touches` is true (any such path when `touches` is null), or whose
 * changed files aren't known. Within that commit, the first such path in git's order. Null when
 * the run is still current. `ignored` wins over `touches`.
 */
export function staleCause(
  sha: string,
  facts: Facts,
  touches: ((path: string) => boolean) | null,
  ignored: (path: string) => boolean = () => false,
): StaleCause | null {
  const at = facts.git.commits.findIndex((c) => sameCommit(c.sha, sha));
  if (at === -1) return { kind: "outside-history" };
  // Commits are newest first: walk from the one right after the run up to HEAD.
  for (const commit of facts.git.commits.slice(0, at).reverse()) {
    const files = changedFiles(commit.sha, facts);
    if (!files) return { kind: "unknown-files", commit: commit.sha };
    const path = files.find(
      (p) => !p.startsWith(".azimuth/") && !ignored(p) && (touches?.(p) ?? true),
    );
    if (path !== undefined) return { kind: "changed", commit: commit.sha, path };
  }
  return null;
}

/**
 * How many code commits came after `sha`, up to HEAD. Past the history the index read, files are
 * unknown, so every commit counts (`code: false`). Null when `sha` is unknown to git.
 */
export function codeCommitsAfter(
  sha: string,
  facts: Facts,
): { count: number; code: boolean } | null {
  const at = facts.git.commits.findIndex((c) => sameCommit(c.sha, sha));
  if (at !== -1) {
    const count = facts.git.commits.slice(0, at).filter((c) => isCodeCommit(c.sha, facts)).length;
    return { count, code: true };
  }
  const count = facts.git.commitsAfter(sha);
  return count === null ? null : { count, code: false };
}

/** Commits whose `Refs:` mention the feature or one of its tasks/stories/scenarios. */
export function commitsFor(featureId: string, facts: Facts) {
  return facts.git.commits.filter((c) => c.refs.some((ref) => featureOf(ref) === featureId));
}

export function derive(model: Model, facts: Facts): Derived {
  const features = new Map(model.features.map((f) => [f.id, f]));
  const runStatus = latestScenarioRuns(model.runs);
  const lastRun = new Map<string, VerifyRun>();
  for (const run of model.runs) lastRun.set(run.target, run);

  const coverage = new Map<string, ScenarioCoverage>();
  const currentHash = new Map<string, string | null>();
  for (const f of model.features) {
    for (const story of f.stories)
      for (const sc of story.scenarios) coverage.set(sc.id, coverageOf(sc.id, facts, runStatus));
    currentHash.set(f.id, f.spec ? specHash(f.spec) : null);
  }

  const conflicts = fileConflicts(
    model.features,
    model.config.parallel.shared_files.map(globToRegExp),
  );
  const staleMs = model.config.stale_after_days * 86_400_000;
  const info = new Map<string, DerivedInfo>();
  for (const f of model.features) {
    const scenarios = f.stories.flatMap((s) => s.scenarios);
    const cov: Coverage = {
      passing: 0,
      failing: 0,
      not_run: 0,
      untested: 0,
      total: scenarios.length,
    };
    for (const sc of scenarios) {
      const status = coverage.get(sc.id)?.status ?? "untested";
      if (status === "not-run") cov.not_run++;
      else cov[status]++;
    }
    const modified =
      ACTIVE_STATUSES.includes(f.status) &&
      f.approved_hash !== null &&
      currentHash.get(f.id) !== null &&
      currentHash.get(f.id) !== f.approved_hash;
    const lastActivity = maxTime([
      ...f.log.map((e) => e.at),
      ...commitsFor(f.id, facts).map((c) => c.at),
      ...f.tasks.map((t) => lastRun.get(t.id)?.at),
    ]);
    const blockedBy: DerivedInfo["blocked_by"] = model.questions
      .filter((q) => q.status === "open" && q.blocking && q.feature === f.id)
      .map((q) => ({ kind: "question" as const, id: q.id }));
    if (f.status === "approved" || f.status === "in-progress") {
      for (const dep of f.depends_on) {
        if (features.get(dep)?.status !== "done") blockedBy.push({ kind: "dependency", id: dep });
      }
    }
    info.set(f.id, {
      blocks: model.features
        .filter((g) => g.depends_on.includes(f.id) && !RETIRED_STATUSES.includes(g.status))
        .map((g) => g.id),
      blocked_by: blockedBy,
      modified_since_approval: modified,
      stale:
        f.status === "in-progress" &&
        (lastActivity === null || facts.now.getTime() - Date.parse(lastActivity) > staleMs),
      progress: {
        done: f.tasks.filter((t) => t.status === "done" || t.status === "skipped").length,
        total: f.tasks.length,
      },
      coverage: cov,
      last_activity: lastActivity,
      file_conflicts: conflicts.get(f.id) ?? [],
      approval_changes: modified ? (facts.git.approvalChanges.get(f.id) ?? []) : [],
    });
  }
  return { features, info, coverage, lastRun, currentHash };
}

/** Paths that two active features both create or modify, shared files aside. */
function fileConflicts(
  features: FeatureEntity[],
  shared: RegExp[],
): Map<string, { path: string; with: string }[]> {
  const owners = new Map<string, string[]>();
  for (const f of features) {
    if (!ACTIVE_STATUSES.includes(f.status)) continue;
    for (const entry of f.impact) {
      if (entry.change !== "create" && entry.change !== "modify") continue;
      if (matchesAny(entry.path, shared)) continue;
      const list = owners.get(entry.path) ?? [];
      if (!list.includes(f.id)) list.push(f.id);
      owners.set(entry.path, list);
    }
  }
  const out = new Map<string, { path: string; with: string }[]>();
  for (const [path, ids] of owners) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const list = out.get(id) ?? [];
      for (const other of ids) if (other !== id) list.push({ path, with: other });
      out.set(id, list);
    }
  }
  return out;
}

export function milestoneProgress(
  model: Model,
  milestoneId: string,
): Pick<Milestone, "features" | "progress"> {
  const members = model.features.filter((f) => f.milestone === milestoneId);
  const counted = members.filter((f) => !RETIRED_STATUSES.includes(f.status));
  const byStatus: Milestone["progress"]["by_status"] = {};
  for (const f of counted) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
  return {
    features: members.map((f) => f.id),
    progress: {
      done: counted.filter((f) => f.status === "done").length,
      total: counted.length,
      by_status: byStatus,
    },
  };
}
