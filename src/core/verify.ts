import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateId } from "./allocate";
import { AzimuthError } from "./errors";
import { headSha, toUtc } from "./git";
import { featureOf, idKind } from "./ids";
import { parseJunit, scenariosFromOutput } from "./junit";
import { loadProject, type FeatureEntity } from "./model";
import { azPath } from "./paths";
import { traceTests } from "./trace";
import type { VerifyRun } from "./types";

export interface VerifyTarget {
  task: string;
  feature: string;
  command: string;
  covers: string[];
}

/** Tasks to verify for a task ID, a feature ID, or (with no ID) every in-flight feature. */
export function verifyTargets(root: string, id: string | null): VerifyTarget[] {
  const model = loadProject(root);
  const pick = (f: FeatureEntity) =>
    f.tasks
      .filter((t) => t.status !== "skipped" && t.verify.trim())
      .map((t) => ({ task: t.id, feature: f.id, command: t.verify, covers: t.covers }));
  if (id === null) {
    return model.features
      .filter((f) => f.status === "in-progress" || f.status === "verifying")
      .flatMap(pick);
  }
  const kind = idKind(id);
  const feature = model.features.find((f) => f.id === featureOf(id));
  if (!feature || (kind !== "task" && kind !== "feature")) {
    throw new AzimuthError("not-found", `${id} is not a feature or task in this project.`);
  }
  const targets = pick(feature);
  const selected = kind === "task" ? targets.filter((t) => t.task === id) : targets;
  if (selected.length === 0)
    throw new AzimuthError("invalid", `${id} has no verify command to run.`);
  return selected;
}

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, "").split("\n").slice(-lines).join("\n");
}

/** Runs one verify command, records the run in the cache and returns it. */
export function runVerify(root: string, target: VerifyTarget, now = () => new Date()): VerifyRun {
  const config = loadProject(root).config;
  const scratch = join(tmpdir(), `azimuth-junit-${process.pid}-${Date.now()}`);
  mkdirSync(scratch, { recursive: true });
  const junitPath = join(scratch, "junit.xml");
  const started = Date.now();
  const result = spawnSync("/bin/sh", ["-c", target.command], {
    cwd: root,
    encoding: "utf8",
    timeout: config.verify.timeout_seconds * 1000,
    maxBuffer: 64 * 1024 * 1024,
    // Commands can write a JUnit report here for exact per-scenario results.
    env: { ...process.env, AZIMUTH_JUNIT: junitPath, AZIMUTH_TASK: target.task, FORCE_COLOR: "0" },
  });
  const durationMs = Date.now() - started;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const timedOut = result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const ok = exitCode === 0 && !timedOut;
  const tests = traceTests(root, config.tests.globs);
  const testFiles = new Map(
    target.covers.map((id) => [id, (tests.get(id) ?? []).map((t) => t.file)]),
  );
  let scenarios = scenariosFromOutput(output, ok, target.covers, testFiles);
  let junit: VerifyRun["junit"] = null;
  if (existsSync(junitPath)) {
    const parsed = parseJunit(readFileSync(junitPath, "utf8"));
    scenarios = new Map([...scenarios, ...parsed.scenarios]);
    junit = parsed.summary;
  }
  rmSync(scratch, { recursive: true, force: true });
  const run: Omit<VerifyRun, "id"> = {
    target: target.task,
    command: target.command,
    ok,
    exit_code: timedOut ? 124 : exitCode,
    duration_ms: durationMs,
    at: toUtc(now().toISOString()),
    commit: headSha(root),
    output_tail: tail(
      timedOut ? `${output}\n[azimuth] timed out after ${config.verify.timeout_seconds}s` : output,
      config.verify.output_tail_lines,
    ),
    scenarios: [...scenarios].map(([id, status]) => ({ id, status })),
    junit,
  };
  mkdirSync(azPath(root, "cache", "runs"), { recursive: true });
  const id = allocateId(root, "run", (id) => {
    const file = azPath(root, "cache", "runs", `${id}.json`);
    writeFileSync(file, JSON.stringify({ id, ...run }, null, 2) + "\n", { flag: "wx" });
  });
  return { id, ...run };
}
