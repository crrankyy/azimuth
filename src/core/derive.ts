import type { Facts } from "./facts";
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

/** Statuses whose features are being specified or built. */
export const ACTIVE_STATUSES: FeatureStatus[] = ["approved", "in-progress", "verifying"];
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
    tests: refs.map((t) => ({ file: t.file, name: t.name, status, confidence: t.confidence })),
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

  const conflicts = fileConflicts(model.features);
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

/** Paths that two active features both create or modify. */
function fileConflicts(features: FeatureEntity[]): Map<string, { path: string; with: string }[]> {
  const owners = new Map<string, string[]>();
  for (const f of features) {
    if (!ACTIVE_STATUSES.includes(f.status)) continue;
    for (const entry of f.impact) {
      if (entry.change !== "create" && entry.change !== "modify") continue;
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
