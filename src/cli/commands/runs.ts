import { loadProject } from "../../core/model";
import { runHistory } from "../../core/runs";
import type { VerifyRun } from "../../core/types";
import { print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";
import { outcome, seconds } from "../verify-report";

/** What `runs --json` prints for each run: the record without its output tail. */
export type RunSummary = Omit<VerifyRun, "output_tail">;

/** Lines `runs` prints when --limit isn't given. */
export const DEFAULT_RUN_LIMIT = 20;

/**
 * DEFAULT_RUN_LIMIT when value is undefined; the number when value matches /^[1-9]\d*$/;
 * otherwise throws a UsageError.
 */
export function parseLimit(value: string | undefined): number {
  if (value === undefined) return DEFAULT_RUN_LIMIT;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new UsageError(`--limit takes a whole number of at least 1, not "${value}".`);
  }
  return Number(value);
}

/**
 * `<id>[ <target>] <at> <commit | "no commit"> <outcome> in <seconds>`, then the wait and the
 * prebuild when there were any.
 */
export function runLine(run: VerifyRun, withTarget: boolean): string {
  const target = withTarget ? ` ${run.target}` : "";
  const head = `${run.id}${target} ${run.at} ${run.commit ?? "no commit"}`;
  // Rounded up, as verify prints it, so any wait shows as at least 1s.
  const waited = run.waited_ms ? `, waited ${Math.ceil(run.waited_ms / 1000)}s` : "";
  const prebuild = run.prebuild
    ? `, prebuild ${run.prebuild.ok ? "passed" : "failed"} in ${seconds(run.prebuild.duration_ms)}`
    : "";
  return `${head} ${outcome(run.ok, run.exit_code)} in ${seconds(run.duration_ms)}${waited}${prebuild}`;
}

function summary({ output_tail: _tail, ...rest }: VerifyRun): RunSummary {
  return rest;
}

export const runs: Command = {
  usage: "runs <T-ID|F-ID> [--limit N] [--json]",
  summary: "A task's or feature's verify runs, newest first: when, at which commit, the outcome",
  options: { limit: { type: "string" }, json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const limit = parseLimit(values.limit as string | undefined);
    const rt = runtime(values);
    const history = runHistory(loadProject(rt.root), id, limit);
    if (rt.json) {
      printJson(history.runs.map(summary));
      return;
    }
    if (history.total === 0) {
      print(`No verify runs for ${history.ref} yet.`);
      return;
    }
    for (const run of history.runs) print(runLine(run, history.kind === "feature"));
    const older = history.total - history.runs.length;
    if (older > 0) print(`… and ${older} older`);
  },
};
