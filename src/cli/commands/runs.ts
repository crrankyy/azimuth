import { loadProject } from "../../core/model";
import { findRun, runHistory } from "../../core/runs";
import type { VerifyRun } from "../../core/types";
import { print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";
import { outcome, runResultLine, seconds, tailLines } from "../verify-report";

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

function prebuildText(prebuild: VerifyRun["prebuild"]): string {
  if (!prebuild) return "none";
  return `${prebuild.ok ? "passed" : "failed"} in ${seconds(prebuild.duration_ms)}`;
}

/**
 * The lines of `show R-NNNN`: the run's result line, then each field. Waited and Session are
 * left out for run files written before those keys existed, so `none` only means a known null.
 */
export function runPage(run: VerifyRun): string[] {
  const lines = [
    runResultLine(run),
    `At: ${run.at}`,
    `Commit: ${run.commit ?? "none"}`,
    `Command: ${run.command}`,
  ];
  if (run.waited_ms !== undefined) lines.push(`Waited: ${Math.ceil(run.waited_ms / 1000)}s`);
  if (run.ses !== undefined) lines.push(`Session: ${run.ses ?? "none"}`);
  lines.push(`Prebuild: ${prebuildText(run.prebuild)}`);
  if (run.junit) {
    const { tests, failures, errors, skipped } = run.junit;
    lines.push(`JUnit: tests ${tests}, failures ${failures}, errors ${errors}, skipped ${skipped}`);
  }
  if (run.scenarios.length > 0) {
    lines.push(`Scenarios: ${run.scenarios.map((s) => `${s.id} ${s.status}`).join(", ")}`);
  }
  const tail = tailLines(run.output_tail);
  return tail.length > 0 ? [...lines, "Output:", ...tail] : [...lines, "Output: (none)"];
}

/**
 * show's handling of a run ID. Reads the runs from the model rather than the index, whose runs
 * are only the latest ones, so every run on disk can be shown.
 */
export function showRun(root: string, id: string, flags: { brief: boolean; json: boolean }): void {
  const run = findRun(loadProject(root), id);
  if (!run) throw new UsageError(`${id} not found.`);
  if (flags.json) printJson(run);
  else if (flags.brief) print(runLine(run, true));
  else for (const line of runPage(run)) print(line);
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
