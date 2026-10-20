import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateId } from "./allocate";
import { loadConfig, type PrebuildFailure } from "./config";
import { AzimuthError } from "./errors";
import { headSha, toUtc } from "./git";
import { featureOf, idKind } from "./ids";
import { parseJunit, scenariosFromOutput } from "./junit";
import { acquireVerifyLock, type VerifyLockOptions } from "./lock";
import { loadProject, type FeatureEntity } from "./model";
import { azPath } from "./paths";
import { runShell } from "./shell";
import { traceTests } from "./trace";
import type { Id, RunPrebuild, VerifyRun } from "./types";

export interface VerifyTarget {
  task: string;
  feature: string;
  command: string;
  covers: string[];
}

export interface PrebuildResult {
  command: string;
  ok: boolean;
  /** 124 after a timeout. */
  exit_code: number;
  /** True when verify.build_timeout_seconds stopped it; a timed-out prebuild never lets targets run. */
  timed_out: boolean;
  duration_ms: number;
  /** Last verify.output_tail_lines lines; ends with "[azimuth] prebuild timed out after <N>s" on a timeout. */
  output_tail: string;
}

/** What verifyBatch reports as it goes, in this order. */
export type VerifyProgress =
  | { kind: "waited"; waited_ms: number } // once, after the lock is taken
  | { kind: "prebuild"; command: string } // before the prebuild starts
  | { kind: "prebuilt"; result: PrebuildResult } // after it ends
  | { kind: "target"; target: VerifyTarget } // before each target's command starts
  | { kind: "run"; run: VerifyRun }; // after each run is recorded

export interface RunContext {
  waited_ms: number;
  ses: Id | null;
  /** Written to the run as `prebuild`; default null. */
  prebuild?: RunPrebuild | null;
  /**
   * The command's timeout, also the N of "[azimuth] timed out after <N>s"; default
   * verify.timeout_seconds.
   */
  timeout_seconds?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

export interface VerifyBatchOptions {
  /** Run verify.prebuild first when one is configured; default true (`--no-prebuild` passes false). */
  prebuild?: boolean;
  /** Written to every run as `ses`; default null. */
  ses?: Id | null;
  onProgress?: (event: VerifyProgress) => void;
  /** Aborting kills the running command's group; it and the remaining targets aren't recorded. */
  signal?: AbortSignal;
  /** Injected for tests. */
  lock?: Pick<VerifyLockOptions, "now" | "sleep">;
  now?: () => Date;
}

export interface VerifyBatchResult {
  waited_ms: number;
  /** null when no prebuild is configured, it was skipped, or it was interrupted. */
  prebuild: PrebuildResult | null;
  /** In target order; [] when the prebuild failed under prebuild_failure: stop, or timed out. */
  runs: VerifyRun[];
  interrupted: boolean;
}

function pick(f: FeatureEntity): VerifyTarget[] {
  return f.tasks
    .filter((t) => t.status !== "skipped" && t.verify.trim())
    .map((t) => ({ task: t.id, feature: f.id, command: t.verify, covers: t.covers }));
}

/** The targets for one task or feature ID; throws when it is unknown or has nothing to run. */
function targetsFor(features: FeatureEntity[], id: string): VerifyTarget[] {
  const kind = idKind(id);
  const feature = features.find((f) => f.id === featureOf(id));
  if (!feature || (kind !== "task" && kind !== "feature")) {
    throw new AzimuthError("not-found", `${id} is not a feature or task in this project.`);
  }
  const targets = pick(feature);
  const selected = kind === "task" ? targets.filter((t) => t.task === id) : targets;
  if (selected.length === 0)
    throw new AzimuthError("invalid", `${id} has no verify command to run.`);
  return selected;
}

/**
 * Tasks to verify for several task and feature IDs, deduplicated in the order named; with no IDs,
 * every task of in-progress and verifying features. Throws before anything runs.
 */
export function verifyTargets(root: string, ids: string[]): VerifyTarget[] {
  const { features } = loadProject(root);
  if (ids.length === 0) {
    return features
      .filter((f) => f.status === "in-progress" || f.status === "verifying")
      .flatMap(pick);
  }
  const byTask = new Map<string, VerifyTarget>();
  for (const target of ids.flatMap((id) => targetsFor(features, id))) {
    if (!byTask.has(target.task)) byTask.set(target.task, target);
  }
  return [...byTask.values()];
}

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, "").split("\n").slice(-lines).join("\n");
}

/**
 * Runs one target's verify command under context.timeout_seconds (default
 * verify.timeout_seconds) and records the run with `prebuild: context.prebuild ?? null`; null
 * when aborted (nothing recorded).
 */
export async function runVerify(
  root: string,
  target: VerifyTarget,
  context: RunContext,
): Promise<VerifyRun | null> {
  const { now = () => new Date() } = context;
  const config = loadProject(root).config;
  const timeoutSeconds = context.timeout_seconds ?? config.verify.timeout_seconds;
  const scratch = join(tmpdir(), `azimuth-junit-${process.pid}-${Date.now()}`);
  mkdirSync(scratch, { recursive: true });
  const junitPath = join(scratch, "junit.xml");
  const result = await runShell(target.command, {
    cwd: root,
    timeoutMs: timeoutSeconds * 1000,
    // Commands can write a JUnit report here for exact per-scenario results.
    env: { ...process.env, AZIMUTH_JUNIT: junitPath, AZIMUTH_TASK: target.task, FORCE_COLOR: "0" },
    signal: context.signal,
  });
  if (result.aborted) {
    rmSync(scratch, { recursive: true, force: true });
    return null;
  }
  const { output, timed_out: timedOut } = result;
  const ok = result.exit_code === 0 && !timedOut;
  const traced = traceTests(root, config.tests.globs);
  const tests = new Map(target.covers.map((id) => [id, traced.get(id) ?? []]));
  let scenarios = scenariosFromOutput(output, ok, target.covers, tests);
  let junit: VerifyRun["junit"] = null;
  if (existsSync(junitPath)) {
    const parsed = parseJunit(readFileSync(junitPath, "utf8"), tests);
    scenarios = new Map([...scenarios, ...parsed.scenarios]);
    junit = parsed.summary;
  }
  rmSync(scratch, { recursive: true, force: true });
  const run: Omit<VerifyRun, "id"> = {
    target: target.task,
    command: target.command,
    ok,
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    at: toUtc(now().toISOString()),
    commit: headSha(root),
    output_tail: tail(
      timedOut ? `${output}\n[azimuth] timed out after ${timeoutSeconds}s` : output,
      config.verify.output_tail_lines,
    ),
    scenarios: [...scenarios].map(([id, status]) => ({ id, status })),
    junit,
    waited_ms: context.waited_ms,
    ses: context.ses,
    prebuild: context.prebuild ?? null,
  };
  mkdirSync(azPath(root, "cache", "runs"), { recursive: true });
  const id = allocateId(root, "run", (id) => {
    const file = azPath(root, "cache", "runs", `${id}.json`);
    writeFileSync(file, JSON.stringify({ id, ...run }, null, 2) + "\n", { flag: "wx" });
  });
  return { id, ...run };
}

/** Runs verify.prebuild under verify.build_timeout_seconds; null when aborted. */
async function runPrebuild(
  root: string,
  command: string,
  verify: { build_timeout_seconds: number; output_tail_lines: number },
  signal: AbortSignal | undefined,
): Promise<PrebuildResult | null> {
  const result = await runShell(command, {
    cwd: root,
    timeoutMs: verify.build_timeout_seconds * 1000,
    env: { ...process.env, FORCE_COLOR: "0" },
    signal,
  });
  if (result.aborted) return null;
  const output = result.timed_out
    ? `${result.output}\n[azimuth] prebuild timed out after ${verify.build_timeout_seconds}s`
    : result.output;
  return {
    command,
    ok: result.exit_code === 0 && !result.timed_out,
    exit_code: result.exit_code,
    timed_out: result.timed_out,
    duration_ms: result.duration_ms,
    output_tail: tail(output, verify.output_tail_lines),
  };
}

/** Whether a prebuild that ended keeps every target from running. */
function stopsBatch(prebuild: PrebuildResult, failure: PrebuildFailure): boolean {
  if (prebuild.ok) return false;
  // continue never covers a timeout: each command would redo a build that outlasted its limit.
  return prebuild.timed_out || failure === "stop";
}

/** What each target records and runs under after `prebuild` (null when none ran). */
function afterPrebuild(
  prebuild: PrebuildResult | null,
  verify: { timeout_seconds: number; build_timeout_seconds: number },
): Pick<RunContext, "prebuild" | "timeout_seconds"> {
  if (!prebuild) return { prebuild: null, timeout_seconds: verify.timeout_seconds };
  const { ok, duration_ms } = prebuild;
  // After a failed prebuild each command builds what the prebuild didn't, so it gets its time too.
  const timeout_seconds = ok
    ? verify.timeout_seconds
    : verify.build_timeout_seconds + verify.timeout_seconds;
  return { prebuild: { ok, duration_ms }, timeout_seconds };
}

/**
 * Takes the verify lock, runs verify.prebuild once (unless skipped), then each target in order,
 * and releases the lock. No targets: returns at once without waiting or building.
 * - Passing prebuild: every run records { ok: true, duration_ms } and keeps timeout_seconds.
 * - Prebuild exits non-zero: under stop, returns with no runs; under continue, runs every target
 *   under build_timeout_seconds + timeout_seconds, each run recording { ok: false, duration_ms }.
 * - Prebuild times out: returns with no runs. Interrupted: returns interrupted, prebuild null.
 */
export async function verifyBatch(
  root: string,
  targets: VerifyTarget[],
  options: VerifyBatchOptions = {},
): Promise<VerifyBatchResult> {
  const { ses = null, signal, onProgress = () => {} } = options;
  const runs: VerifyRun[] = [];
  if (targets.length === 0) return { waited_ms: 0, prebuild: null, runs, interrupted: false };
  const lock = await acquireVerifyLock(root, { ...options.lock, signal });
  if (!lock) return { waited_ms: 0, prebuild: null, runs, interrupted: true };
  const { waited_ms } = lock;
  try {
    onProgress({ kind: "waited", waited_ms });
    const { verify } = loadConfig(root).config;
    const command = options.prebuild === false ? "" : (verify.prebuild ?? "").trim();
    let prebuild: PrebuildResult | null = null;
    if (command) {
      onProgress({ kind: "prebuild", command });
      prebuild = await runPrebuild(root, command, verify, signal);
      if (!prebuild) return { waited_ms, prebuild, runs, interrupted: true };
      onProgress({ kind: "prebuilt", result: prebuild });
      if (stopsBatch(prebuild, verify.prebuild_failure)) {
        return { waited_ms, prebuild, runs, interrupted: false };
      }
    }
    const context: RunContext = {
      waited_ms,
      ses,
      signal,
      now: options.now,
      ...afterPrebuild(prebuild, verify),
    };
    for (const target of targets) {
      if (signal?.aborted) return { waited_ms, prebuild, runs, interrupted: true };
      onProgress({ kind: "target", target });
      const run = await runVerify(root, target, context);
      if (!run) return { waited_ms, prebuild, runs, interrupted: true };
      runs.push(run);
      onProgress({ kind: "run", run });
    }
    return { waited_ms, prebuild, runs, interrupted: false };
  } finally {
    lock.release();
  }
}
