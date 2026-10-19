import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateId } from "./allocate";
import { loadConfig } from "./config";
import { AzimuthError } from "./errors";
import { headSha, toUtc } from "./git";
import { featureOf, idKind } from "./ids";
import { parseJunit, scenariosFromOutput } from "./junit";
import { acquireVerifyLock, type VerifyLockOptions } from "./lock";
import { loadProject, type FeatureEntity } from "./model";
import { azPath } from "./paths";
import { runShell } from "./shell";
import { traceTests } from "./trace";
import type { Id, VerifyRun } from "./types";

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
  /** null when no prebuild is configured or it was skipped. */
  prebuild: PrebuildResult | null;
  /** In target order; [] when the prebuild failed. */
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

/** Runs one target's verify command and records the run; null when aborted (nothing recorded). */
export async function runVerify(
  root: string,
  target: VerifyTarget,
  context: RunContext,
): Promise<VerifyRun | null> {
  const { now = () => new Date() } = context;
  const config = loadProject(root).config;
  const scratch = join(tmpdir(), `azimuth-junit-${process.pid}-${Date.now()}`);
  mkdirSync(scratch, { recursive: true });
  const junitPath = join(scratch, "junit.xml");
  const result = await runShell(target.command, {
    cwd: root,
    timeoutMs: config.verify.timeout_seconds * 1000,
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
      timedOut ? `${output}\n[azimuth] timed out after ${config.verify.timeout_seconds}s` : output,
      config.verify.output_tail_lines,
    ),
    scenarios: [...scenarios].map(([id, status]) => ({ id, status })),
    junit,
    waited_ms: context.waited_ms,
    ses: context.ses,
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
    duration_ms: result.duration_ms,
    output_tail: tail(output, verify.output_tail_lines),
  };
}

/**
 * Takes the verify lock, runs verify.prebuild once (unless skipped), then each target in order,
 * and releases the lock. No targets: returns at once without waiting or building.
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
      if (!prebuild.ok) return { waited_ms, prebuild, runs, interrupted: false };
    }
    for (const target of targets) {
      if (signal?.aborted) return { waited_ms, prebuild, runs, interrupted: true };
      onProgress({ kind: "target", target });
      const run = await runVerify(root, target, { waited_ms, ses, signal, now: options.now });
      if (!run) return { waited_ms, prebuild, runs, interrupted: true };
      runs.push(run);
      onProgress({ kind: "run", run });
    }
    return { waited_ms, prebuild, runs, interrupted: false };
  } finally {
    lock.release();
  }
}
