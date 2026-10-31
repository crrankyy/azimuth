import { AzimuthError } from "./errors";
import { compareIds, featureOf, idKind } from "./ids";
import type { Model } from "./model";
import type { Id, VerifyRun } from "./types";

/** The runs of one task or feature, as `azimuth runs` lists them. */
export interface RunHistory {
  /** The ID asked for. */
  ref: Id;
  kind: "task" | "feature";
  /** Newest first (newestFirst), at most `limit` of them. */
  runs: VerifyRun[];
  /** How many runs the ref has in all; total - runs.length is the `… and <n> older` count. */
  total: number;
}

/**
 * Newest `at` first (Date.parse), then the higher run ID first (compareIds), as indexRuns orders
 * the index's runs.
 */
export function newestFirst(a: VerifyRun, b: VerifyRun): number {
  return Date.parse(b.at) - Date.parse(a.at) || compareIds(b.id, a.id);
}

/**
 * The runs of a task (target === ref) or of a feature (featureOf(target) === ref, so runs of
 * removed tasks and of the feature itself count), sorted with newestFirst and cut to `limit`
 * (a whole number ≥ 1; the CLI checks it).
 *
 * Checks, in order (see Errors): ref's kind is task or feature; the feature exists in
 * model.features; a task is listed in its feature's plan or targeted by a run; a feature has a
 * task or a run. A known task or feature without runs returns runs [] and total 0.
 * Never reads files.
 */
export function runHistory(
  model: Pick<Model, "features" | "runs">,
  ref: string,
  limit: number,
): RunHistory {
  const kind = idKind(ref);
  if (kind !== "task" && kind !== "feature") {
    throw new AzimuthError("invalid", `${ref} is not a task or feature ID.`);
  }
  const feature = model.features.find((f) => f.id === featureOf(ref));
  if (!feature) throw new AzimuthError("not-found", `${ref} does not exist.`);
  const matches = (run: VerifyRun) =>
    kind === "task" ? run.target === ref : featureOf(run.target) === ref;
  const all = model.runs.filter(matches);
  if (kind === "task" && all.length === 0 && !feature.tasks.some((t) => t.id === ref)) {
    throw new AzimuthError("not-found", `${ref} does not exist.`);
  }
  if (kind === "feature" && all.length === 0 && feature.tasks.length === 0) {
    throw new AzimuthError("invalid", `${ref} has no tasks and no verify runs.`);
  }
  return { ref, kind, runs: [...all].sort(newestFirst).slice(0, limit), total: all.length };
}

/** The run with this ID, or null. */
export function findRun(model: Pick<Model, "runs">, id: string): VerifyRun | null {
  return model.runs.find((run) => run.id === id) ?? null;
}
