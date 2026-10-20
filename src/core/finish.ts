import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeProject } from "./build-index";
import { AzimuthError, isAzimuthError } from "./errors";
import { updateFrontmatterItem } from "./frontmatter";
import { headSha, isGitRepo, readBlobs, readCommits } from "./git";
import { globToRegExp, matchesAny, testFileMatcher } from "./glob";
import { featureOf, idKind } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import type { FeatureEntity } from "./model";
import { addNote } from "./notes";
import { parsePlan, type TaskRaw } from "./parse/feature";
import { AZ_DIR } from "./paths";
import { inScope, repoPath, runScope } from "./run-scope";
import { scanTestFile } from "./trace";
import { addLogEntry, moveTask, type Who } from "./transitions";
import type { Commit, Id, Problem } from "./types";
import { verifyBatch, verifyTargets, type PrebuildResult, type VerifyBatchResult } from "./verify";

/** "adopt" runs after "check" and before "note", and only when `adopt` is given. */
export type FinishStepName =
  "check" | "adopt" | "note" | "stage" | "commit" | "verify" | "done" | "log";
export type FinishStepStatus = "done" | "failed" | "not-run";

export interface FinishStep {
  step: FinishStepName;
  status: FinishStepStatus;
  /** One line: what the step did, or why it failed; "" when not run. */
  detail: string;
  /** Further lines: the feature's errors, git's output or a verify output tail; "" otherwise. */
  output: string;
}

export interface FinishResult {
  task: Id;
  /** featureOf(task). */
  feature: Id;
  /** True when the task ended done. */
  ok: boolean;
  /**
   * check, adopt, note, stage, commit, verify, done, log, in this order, every one of them
   * (status "not-run" for those that didn't run); "adopt" only when `adopt` was given, "note"
   * only when a note was given.
   */
  steps: FinishStep[];
  /** Paths staged and committed, sorted; [] until the stage step ran. */
  staged: string[];
  /** Changed paths left out of the commit, sorted; [] until the stage step ran. */
  not_staged: string[];
  /** The new commit's 7-character SHA; null until the commit step succeeded. */
  commit: string | null;
  /** The recorded run; null when none was (failed prebuild, interruption, earlier failure). */
  run: Id | null;
  /** True when `signal` aborted the verify step. */
  interrupted: boolean;
  /** not_staged's paths outside `.azimuth/` that no other in-progress task lists, sorted. */
  not_staged_outside: string[];
  /** not_staged's paths outside `.azimuth/` that another in-progress task lists, sorted. */
  not_staged_other_tasks: string[];
  /** not_staged's paths under `.azimuth/`, sorted. */
  not_staged_records: string[];
  /**
   * Staged paths matching parallel.shared_files that another in-progress task also lists,
   * sorted by path; [] until the stage step staged something.
   */
  shared: SharedStaged[];
}

export interface FinishOptions extends Who {
  /** The commit message as given; withRefsTrailer adds `Refs: <T-ID>` when it has no Refs line. */
  message: string;
  /** Appended to the feature's notes.md (F-008 addNote) before staging; null or absent: no note step. */
  note?: string | null;
  /** Aborting kills the running verify command (verifyBatch); done and log don't run. */
  signal?: AbortSignal;
  /**
   * Changed paths to add to the task's `files` in plan.md (the adopt step) and stage with the
   * rest. Each is trimmed and loses a leading "./" and a trailing "/"; empty entries are
   * dropped and duplicates count once. Absent or empty after that: no adopt step.
   */
  adopt?: string[];
}

export interface PathSelection {
  /** Changed paths that are the task's files (or under one) or under the feature's folder, sorted. */
  staged: string[];
  /** Every other changed path, sorted. */
  not_staged: string[];
}

export interface SharedStaged {
  path: string;
  /** The other in-progress tasks that list it, in model order (feature ID, then plan order). */
  tasks: Id[];
}

export interface NotStagedSplit {
  outside: string[];
  other_tasks: string[];
  records: string[];
}

/** Why the check refuses a changed path. */
export type UnlistedReason =
  /** Rule (a): scenarios the task covers that the working copy marks and HEAD's copy doesn't. */
  | { kind: "marker"; scenarios: Id[] }
  /** Rule (b): the impact.md entry the path equals or lies under. */
  | { kind: "impact"; change: "create" | "modify" | "test" };

export interface UnlistedFile {
  path: string;
  reason: UnlistedReason;
}

export interface UnlistedContext {
  /** The task being finished; `files` includes the paths being adopted. */
  task: Pick<TaskRaw, "id" | "files" | "covers">;
  feature: Pick<FeatureEntity, "id" | "dir" | "impact">;
  /** Every other in-progress task, of any feature. */
  others: Pick<TaskRaw, "id" | "files">[];
  /** config.tests.globs, matched with testFileMatcher (glob.ts). */
  testGlobs: string[];
  /**
   * A changed test path's text in the working tree and at HEAD; null where the file doesn't
   * exist (deleted from the working tree; untracked, renamed or no HEAD).
   */
  texts: (path: string) => { working: string | null; head: string | null };
}

const TRAILER = /^[A-Za-z][A-Za-z0-9-]*: \S/;
const isBlank = (line: string) => line.trim() === "";

/**
 * The message with trailing whitespace removed and, unless a line after the first starts with
 * "Refs:" (any case), `Refs: <taskId>` added: as the first line of the last paragraph when that
 * paragraph isn't the first and every line of it matches /^[A-Za-z][A-Za-z0-9-]*: \S/, else as
 * a new last paragraph after a blank line.
 */
export function withRefsTrailer(message: string, taskId: string): string {
  const text = message.replace(/\s+$/, "");
  const lines = text.split("\n");
  if (lines.slice(1).some((line) => /^refs:/i.test(line))) return text;
  const refs = `Refs: ${taskId}`;
  const blank = lines.findLastIndex(isBlank);
  const last = lines.slice(blank + 1);
  const isFirst = !lines.slice(0, Math.max(blank, 0)).some((line) => !isBlank(line));
  // Inside git's trailer block, so that `Co-Authored-By:` and the other trailers stay trailers.
  if (!isFirst && last.every((line) => TRAILER.test(line))) {
    return [...lines.slice(0, blank + 1), refs, ...last].join("\n");
  }
  return `${text}\n\n${refs}`;
}

/**
 * Splits changed paths (repo-relative, as `git status --porcelain` prints them) into the ones to
 * stage and the ones to leave. A path is the task's when runScope(task, { impact: [] }, [], [])
 * is non-null and inScope(path, scope) holds (equal to a file, or under it as a directory, after
 * removing a leading "./" and a trailing "/"); it is a record when it starts with `featureDir`
 * (a feature's `dir`, with its trailing slash).
 */
export function selectPaths(
  changed: string[],
  task: Pick<TaskRaw, "files">,
  featureDir: string,
): PathSelection {
  const scope = runScope(task, { impact: [] }, [], []);
  const belongs = (path: string) =>
    path.startsWith(featureDir) || (scope !== null && inScope(path, scope));
  const unique = [...new Set(changed)].sort();
  return {
    staged: unique.filter(belongs),
    not_staged: unique.filter((path) => !belongs(path)),
  };
}

/** Whether `files` list a path (equal to one, or under it as a directory), as selectPaths decides. */
function listedIn(files: string[]): (path: string) => boolean {
  const scope = runScope({ files }, { impact: [] }, [], []);
  return (path) => scope !== null && inScope(path, scope);
}

/** Whether a path is already a task's: listed in its files or in its feature's folder. */
function ownedBy(files: string[], featureDir: string): (path: string) => boolean {
  const listed = listedIn(files);
  return (path) => path.startsWith(featureDir) || listed(path);
}

/** The --adopt paths as git prints them (runScope's normalization), each once, in the order given. */
function adoptPaths(given: string[] | undefined): string[] {
  return [...new Set((given ?? []).map(repoPath).filter(Boolean))];
}

/** The scenarios a test file's text marks; a missing file (null) marks none. */
function markedScenarios(text: string | null, path: string): Set<Id> {
  if (text === null) return new Set();
  // Only markers count: trace hides mention-only fallbacks, so they never prove a scenario.
  const marked = [...scanTestFile(text, path)].filter(([, refs]) =>
    refs.some((r) => r.confidence === "marker"),
  );
  return new Set(marked.map(([id]) => id));
}

/**
 * The changed paths the check refuses, sorted by path. A path is a candidate when it is outside
 * the task's files and doesn't start with `feature.dir` (selectPaths' not_staged). A candidate
 * is refused:
 * (a) when it is a test file (testFileMatcher) whose working copy marks a scenario of
 *     task.covers that HEAD's copy doesn't mark; reason { kind: "marker", scenarios } sorted;
 * (b) otherwise, when it equals or lies under a create, modify or test entry of feature.impact
 *     and no task in `others` lists it; reason { kind: "impact", change } of the first such entry.
 * `texts` is called only for candidates that match testGlobs.
 */
export function unlistedFiles(changed: string[], ctx: UnlistedContext): UnlistedFile[] {
  const isTest = testFileMatcher(ctx.testGlobs);
  const covers = new Set(ctx.task.covers);
  const impact = ctx.feature.impact.flatMap((e) =>
    e.change === "read" ? [] : [{ change: e.change, holds: listedIn([e.path]) }],
  );
  const claims = ctx.others.map((t) => listedIn(t.files));
  const newMarkers = (path: string): Id[] => {
    const { working, head } = ctx.texts(path);
    const before = markedScenarios(head, path);
    return [...markedScenarios(working, path)]
      .filter((id) => covers.has(id) && !before.has(id))
      .sort();
  };
  const reasonFor = (path: string): UnlistedReason | null => {
    const scenarios = isTest(path) ? newMarkers(path) : [];
    if (scenarios.length > 0) return { kind: "marker", scenarios };
    const entry = impact.find((e) => e.holds(path));
    if (!entry || claims.some((lists) => lists(path))) return null;
    return { kind: "impact", change: entry.change };
  };
  return selectPaths(changed, ctx.task, ctx.feature.dir).not_staged.flatMap((path) => {
    const reason = reasonFor(path);
    return reason ? [{ path, reason }] : [];
  });
}

/**
 * Splits the paths left out of the commit: `records` start with ".azimuth/"; of the rest,
 * `other_tasks` are listed by a task in `others`; `outside` is everything else. Each is sorted.
 */
export function splitNotStaged(
  notStaged: string[],
  others: Pick<TaskRaw, "files">[],
): NotStagedSplit {
  const claims = others.map((t) => listedIn(t.files));
  const split: NotStagedSplit = { outside: [], other_tasks: [], records: [] };
  for (const path of [...notStaged].sort()) {
    if (path.startsWith(`${AZ_DIR}/`)) split.records.push(path);
    else if (claims.some((lists) => lists(path))) split.other_tasks.push(path);
    else split.outside.push(path);
  }
  return split;
}

/**
 * The staged paths matching one of `sharedFiles` (globToRegExp) that a task in `others` lists,
 * sorted by path, each with those tasks in the order of `others`.
 */
export function sharedStaged(
  staged: string[],
  sharedFiles: string[],
  others: Pick<TaskRaw, "id" | "files">[],
): SharedStaged[] {
  const shared = sharedFiles.map(globToRegExp);
  const claims = others.map((t) => ({ id: t.id, lists: listedIn(t.files) }));
  return [...new Set(staged)]
    .sort()
    .filter((path) => matchesAny(path, shared))
    .map((path) => ({ path, tasks: claims.filter((t) => t.lists(path)).map((t) => t.id) }))
    .filter((entry) => entry.tasks.length > 0);
}

interface GitResult {
  code: number;
  stdout: string;
  /** stdout followed by stderr. */
  output: string;
}

/**
 * Runs git with the caller's environment and configuration, so hooks run. Unlike git.ts's
 * helper it keeps stderr, which holds the hooks' and git's own reasons for a failure.
 */
function runGit(root: string, args: string[], input?: string): GitResult {
  const result = spawnSync("git", ["-c", "core.quotepath=off", ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = result.stdout ?? "";
  return { code: result.status ?? 1, stdout, output: `${stdout}${result.stderr ?? ""}` };
}

/** Paths in `git status --porcelain=v1 -z` output: both paths of a rename, one of a copy. */
function porcelainPaths(out: string): string[] {
  const tokens = out.split("\0");
  const paths: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i] ?? "";
    if (!entry) continue;
    const xy = entry.slice(0, 2);
    paths.push(entry.slice(3));
    // In the -z format a rename or copy is followed by its source path as a token of its own.
    if (/[RC]/.test(xy)) {
      const source = tokens[++i];
      if (source && xy.includes("R")) paths.push(source);
    }
  }
  return paths;
}

const nulList = (out: string) => out.split("\0").filter(Boolean);

const STATUS_ARGS = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, "").split("\n").slice(-lines).join("\n");
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** The line `azimuth verify` prints for a wait (cli/verify-report.ts), rounded up; "" for none. */
const waitedLine = (ms: number) =>
  ms > 0 ? `waited ${Math.ceil(ms / 1000)}s for another verify` : "";

/**
 * The newest commit whose Refs name the task, made since the task last moved to in-progress:
 * every commit from HEAD back to it must show the task in progress in plan.md. Moves to
 * in-progress aren't logged, so plan.md's history is the only record of when one happened.
 */
function taskCommit(
  root: string,
  feature: FeatureEntity,
  taskId: string,
  depth: number,
): Commit | null {
  const commits = readCommits(root, depth);
  const index = commits.findIndex((c) => c.refs.includes(taskId));
  if (index === -1) return null;
  const since = commits.slice(0, index + 1);
  const plan = feature.files.plan ?? `${feature.dir}plan.md`;
  const blobs = readBlobs(
    root,
    since.map((c) => `${c.sha}:${plan}`),
  );
  const inProgress = (c: Commit) => {
    const text = blobs.get(`${c.sha}:${plan}`);
    if (!text) return false;
    const found = parsePlan(text, plan, feature.id).tasks.find((t) => t.id === taskId);
    return found?.status === "in-progress";
  };
  return since.every(inProgress) ? (commits[index] ?? null) : null;
}

/** The rule `azimuth check F-NNN` uses: the feature's own problems, its parts' and its folder's. */
function relatedTo(p: Problem, featureId: string): boolean {
  return (
    p.ref === featureId ||
    (p.ref !== null && featureOf(p.ref) === featureId) ||
    p.file.includes(`/${featureId}-`) ||
    p.file.includes(`/${featureId}.`)
  );
}

const problemText = (p: Problem) => `${p.code} ${p.file}${p.line ? `:${p.line}` : ""} ${p.message}`;

const moveFirst = (id: string, status: string) =>
  `${id} is ${status}. Move it to in-progress first (\`azimuth move ${id} in-progress\`).`;

type Checked =
  | {
      ok: true;
      feature: FeatureEntity;
      /** The task, its files followed by the adopted paths it doesn't own yet. */
      task: TaskRaw;
      /** Every other in-progress task, of any feature, in model order. */
      others: TaskRaw[];
      sharedFiles: string[];
      tailLines: number;
      logDepth: number;
    }
  | { ok: false; detail: string; output: string };

const refuse = (detail: string, output = ""): Checked => ({ ok: false, detail, output });

/** A working-tree file's text; null when it doesn't exist (deleted). */
function readWorking(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** unlistedFiles' texts, with HEAD's copies of `testPaths` read in one readBlobs call. */
function changedTexts(root: string, testPaths: string[]): UnlistedContext["texts"] {
  const heads = readBlobs(
    root,
    testPaths.map((path) => `HEAD:${path}`),
  );
  return (path) => ({
    working: readWorking(join(root, path)),
    // readBlobs stops early on a truncated reply, leaving later specs out of the map.
    head: heads.get(`HEAD:${path}`) ?? null,
  });
}

/** One line of the refusal's output: the path and why the check refuses it. */
function unlistedLine({ path, reason }: UnlistedFile, taskId: string, featureId: string): string {
  if (reason.kind === "impact") {
    return `${path}: a ${reason.change} path in ${featureId}'s impact.md that no in-progress task lists`;
  }
  const markers = reason.scenarios.length === 1 ? "a marker" : "markers";
  return `${path}: adds ${markers} for ${reason.scenarios.join(", ")}, which ${taskId} covers`;
}

/**
 * Why the check refuses --adopt paths, one sentence per invalid path, in the order given. A path
 * the task already owns is accepted, changed or not. Any other must be exactly a path git status
 * lists, so a directory can't sweep in another lane's files, and no other in-progress task may
 * list it, since it belongs in that task's commit.
 */
function adoptRefusals(
  adopt: string[],
  changed: string[],
  owns: (path: string) => boolean,
  others: Pick<TaskRaw, "id" | "files">[],
): string[] {
  const isChanged = new Set(changed);
  const claims = others.map((t) => ({ id: t.id, lists: listedIn(t.files) }));
  return adopt.flatMap((path) => {
    if (owns(path)) return [];
    if (!isChanged.has(path)) return [`Can't adopt ${path}: git status shows no change to it.`];
    const other = claims.find((t) => t.lists(path))?.id;
    if (!other) return [];
    return [
      `Can't adopt ${path}: ${other} lists it and is in progress, so it goes in ${other}'s commit.`,
    ];
  });
}

/** The check step: reads only, in the order of contract.md's table. */
function check(
  root: string,
  taskId: string,
  featureId: string,
  adopt: string[],
  now: Date,
): Checked {
  if (!isGitRepo(root)) return refuse("Not a git repository: task finish commits with git.");
  const { model, problems } = analyzeProject(root, now);
  const feature = model.features.find((f) => f.id === featureId);
  if (!feature) return refuse(`${featureId} does not exist.`);
  const task = feature.tasks.find((t) => t.id === taskId);
  if (!task) {
    return refuse(`${taskId} is not a task in ${feature.files.plan ?? `${feature.dir}plan.md`}.`);
  }
  if (feature.status !== "in-progress") return refuse(moveFirst(featureId, feature.status));
  if (task.status !== "in-progress") return refuse(moveFirst(taskId, task.status));
  try {
    verifyTargets(root, [taskId]);
  } catch (e) {
    if (!isAzimuthError(e)) throw e;
    return refuse(e.message);
  }
  const errors = problems.filter((p) => p.severity === "error" && relatedTo(p, featureId));
  if (errors.length > 0) {
    const count = `${errors.length} ${errors.length === 1 ? "error" : "errors"}`;
    return refuse(`${featureId} has ${count}`, errors.map(problemText).join("\n"));
  }
  const tailLines = model.config.verify.output_tail_lines;
  const status = runGit(root, STATUS_ARGS);
  if (status.code !== 0) {
    return refuse(`git status failed (exit ${status.code})`, tail(status.output, tailLines));
  }
  const changed = porcelainPaths(status.stdout);
  const others = model.features.flatMap((f) =>
    f.tasks.filter((t) => t.status === "in-progress" && t.id !== taskId),
  );
  const owns = ownedBy(task.files, feature.dir);
  const refusals = adoptRefusals(adopt, changed, owns, others);
  if (refusals.length > 0) return refuse(refusals.join(" "));
  // From here on the adopted paths count as the task's files, as they will once adopt writes them.
  const widened = { ...task, files: [...task.files, ...adopt.filter((path) => !owns(path))] };
  const staged = runGit(root, ["diff", "--cached", "--name-only", "--no-renames", "-z"]);
  if (staged.code !== 0) {
    return refuse(`git diff failed (exit ${staged.code})`, tail(staged.output, tailLines));
  }
  // Refusing here keeps the commit to the staged set without a pathspec commit.
  const outside = selectPaths(nulList(staged.stdout), widened, feature.dir).not_staged;
  if (outside.length > 0) {
    return refuse(
      `Already staged, but not ${taskId}'s files or ${featureId}'s records: ${outside.join(", ")}. Unstage them (git restore --staged <path>) or commit them first.`,
    );
  }
  const testGlobs = model.config.tests.globs;
  const unlisted = unlistedFiles(changed, {
    task: widened,
    feature,
    others,
    testGlobs,
    texts: changedTexts(root, changed.filter(testFileMatcher(testGlobs))),
  });
  if (unlisted.length > 0) {
    return refuse(
      `Changed outside ${taskId}'s files: ${unlisted.map((u) => u.path).join(", ")}. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.`,
      unlisted.map((u) => unlistedLine(u, taskId, featureId)).join("\n"),
    );
  }
  return {
    ok: true,
    feature,
    task: widened,
    others,
    sharedFiles: model.config.parallel.shared_files,
    tailLines,
    logDepth: model.config.git.log_depth,
  };
}

interface VerifyOutcome {
  passed: boolean;
  detail: string;
  output: string;
  /** What the log entry says after `Committed <sha>; `. */
  logged: string;
}

/**
 * What the verify line adds after the run's duration. The run records only the prebuild's ok and
 * duration, so the exit code comes from the batch's PrebuildResult.
 */
function prebuildSuffix(prebuild: PrebuildResult | null): string {
  if (!prebuild) return "";
  const took = seconds(prebuild.duration_ms);
  if (prebuild.ok) return ` (prebuild ${took})`;
  return ` after a failed prebuild (exit ${prebuild.exit_code}, ${took})`;
}

function verifyOutcome(batch: VerifyBatchResult): VerifyOutcome {
  const { prebuild } = batch;
  const run = batch.runs[0];
  // A run after a failed prebuild exists only under prebuild_failure: continue.
  if (prebuild && !prebuild.ok && !run) {
    const failed = `prebuild failed (exit ${prebuild.exit_code})`;
    return {
      passed: false,
      detail: `${failed} in ${seconds(prebuild.duration_ms)}`,
      output: prebuild.output_tail,
      logged: `${failed}.`,
    };
  }
  if (!run) throw new Error("verifyBatch recorded no run for the task.");
  const suffix = prebuildSuffix(prebuild);
  const after = prebuild && !prebuild.ok ? " after a failed prebuild" : "";
  if (run.ok) {
    return {
      passed: true,
      detail: `${run.id} passed in ${seconds(run.duration_ms)}${suffix}`,
      output: "",
      logged: `${run.id} passed${after}.`,
    };
  }
  const failed = `${run.id} failed (exit ${run.exit_code})`;
  return {
    passed: false,
    detail: `${failed} in ${seconds(run.duration_ms)}${suffix}`,
    output: run.output_tail,
    logged: `${failed}${after}.`,
  };
}

/**
 * The adopt step's writer, as moveTask writes plan.md: inside the lock, re-reads plan.md and
 * appends to the task's `files` the adopted paths it doesn't own yet, in the order given. Writes
 * nothing when it owns them all. Returns the step's detail.
 */
function adoptFiles(root: string, feature: FeatureEntity, taskId: string, adopt: string[]): string {
  const plan = feature.files.plan ?? `${feature.dir}plan.md`;
  return withLock(root, () => {
    const text = readWorking(join(root, plan));
    if (text === null) throw new AzimuthError("not-found", `${plan} does not exist.`);
    const files = parsePlan(text, plan, feature.id).tasks.find((t) => t.id === taskId)?.files;
    if (!files) throw new AzimuthError("not-found", `${taskId} is not in ${plan}.`);
    const owns = ownedBy(files, feature.dir);
    const added = adopt.filter((path) => !owns(path));
    if (added.length === 0) return `already ${taskId}'s files: ${adopt.join(", ")}`;
    const updated = updateFrontmatterItem(text, "tasks", (item) => item.id === taskId, {
      files: [...files, ...added],
    });
    if (updated === null) throw new AzimuthError("not-found", `${taskId} is not in ${plan}.`);
    writeFileAtomic(join(root, plan), updated);
    return `added to ${taskId}'s files: ${added.join(", ")}`;
  });
}

const STEPS: FinishStepName[] = [
  "check",
  "adopt",
  "note",
  "stage",
  "commit",
  "verify",
  "done",
  "log",
];

/**
 * Runs the steps in order and stops at the first that fails; after a failed verify only the log
 * step still runs. Never throws for a failing step (AzimuthErrors from the writers it calls
 * become that step's detail); unexpected errors propagate.
 */
export async function finishTask(
  root: string,
  taskId: string,
  opts: FinishOptions,
): Promise<FinishResult> {
  const featureId = featureOf(taskId);
  if (idKind(taskId) !== "task" || !featureId) {
    throw new AzimuthError("invalid", `${taskId} is not a task ID.`);
  }
  const who: Who = { actor: opts.actor, session: opts.session, now: opts.now };
  const hasNote = opts.note !== undefined && opts.note !== null;
  const adopt = adoptPaths(opts.adopt);
  const runs = (name: FinishStepName) =>
    (name !== "note" || hasNote) && (name !== "adopt" || adopt.length > 0);
  const result: FinishResult = {
    task: taskId,
    feature: featureId,
    ok: false,
    steps: STEPS.filter(runs).map((name) => ({
      step: name,
      status: "not-run",
      detail: "",
      output: "",
    })),
    staged: [],
    not_staged: [],
    commit: null,
    run: null,
    interrupted: false,
    not_staged_outside: [],
    not_staged_other_tasks: [],
    not_staged_records: [],
    shared: [],
  };
  const mark = (name: FinishStepName, status: FinishStepStatus, detail: string, output = "") => {
    const found = result.steps.find((s) => s.step === name);
    if (found) Object.assign(found, { status, detail, output });
  };
  /** Runs a writer; its AzimuthError fails the step. Returns whether it succeeded. */
  const attempt = (name: FinishStepName, write: () => string): boolean => {
    try {
      mark(name, "done", write());
      return true;
    } catch (e) {
      if (!isAzimuthError(e)) throw e;
      mark(name, "failed", e.message);
      return false;
    }
  };

  const checked = check(root, taskId, featureId, adopt, opts.now ?? new Date());
  if (!checked.ok) {
    mark("check", "failed", checked.detail, checked.output);
    return result;
  }
  mark("check", "done", `${featureId} has no errors`);
  const { feature, task, others, sharedFiles, tailLines, logDepth } = checked;

  // Before the note: a failed note then leaves a plan.md that a rerun with the same --adopt accepts.
  if (adopt.length > 0 && !attempt("adopt", () => adoptFiles(root, feature, taskId, adopt))) {
    return result;
  }
  if (hasNote && !attempt("note", () => addNote(root, taskId, opts.note ?? "", who).message)) {
    return result;
  }

  // Read again: the note step may have written notes.md since the check.
  const status = runGit(root, STATUS_ARGS);
  if (status.code !== 0) {
    mark(
      "stage",
      "failed",
      `git status failed (exit ${status.code})`,
      tail(status.output, tailLines),
    );
    return result;
  }
  const selection = selectPaths(porcelainPaths(status.stdout), task, feature.dir);
  result.not_staged = selection.not_staged;
  const split = splitNotStaged(selection.not_staged, others);
  result.not_staged_outside = split.outside;
  result.not_staged_other_tasks = split.other_tasks;
  result.not_staged_records = split.records;
  const unchanged = `none of ${taskId}'s files and none of ${featureId}'s records changed`;
  let sha: string;
  if (selection.staged.length === 0) {
    // A rerun after a verify that failed for a reason outside the task finds its work committed.
    const committed = taskCommit(root, feature, taskId, logDepth);
    if (!committed) {
      mark("stage", "failed", `Nothing to commit: ${unchanged}.`);
      return result;
    }
    sha = committed.sha;
    mark("stage", "done", `nothing left to stage: ${unchanged}`);
    const given = opts.message.trim().split("\n")[0] ?? "";
    mark(
      "commit",
      "done",
      `skipped: ${sha} ${committed.subject} already commits ${taskId}`,
      given ? `--commit message ignored: ${given}` : "",
    );
  } else {
    // Literal pathspecs: a path holding `*` or `[` must stage that file, never what it matches.
    const add = runGit(root, ["--literal-pathspecs", "add", "-A", "--", ...selection.staged]);
    if (add.code !== 0) {
      mark("stage", "failed", `git add failed (exit ${add.code})`, tail(add.output, tailLines));
      return result;
    }
    result.staged = selection.staged;
    result.shared = sharedStaged(selection.staged, sharedFiles, others);
    mark("stage", "done", selection.staged.join(", "));

    const message = withRefsTrailer(opts.message, taskId);
    const commit = runGit(root, ["commit", "-F", "-"], message);
    if (commit.code !== 0) {
      mark(
        "commit",
        "failed",
        `git commit failed (exit ${commit.code})`,
        tail(commit.output, tailLines),
      );
      return result;
    }
    sha = headSha(root) ?? "";
    mark("commit", "done", `${sha} ${message.split("\n")[0] ?? ""}`);
  }
  result.commit = sha;

  let batch: VerifyBatchResult;
  let waited = "";
  try {
    batch = await verifyBatch(root, verifyTargets(root, [taskId]), {
      ses: opts.session ?? null,
      signal: opts.signal,
      onProgress: (event) => {
        if (event.kind === "waited") waited = waitedLine(event.waited_ms);
      },
    });
  } catch (e) {
    if (!isAzimuthError(e)) throw e;
    mark("verify", "failed", e.message, waited);
    return result;
  }
  if (batch.interrupted) {
    result.interrupted = true;
    mark("verify", "failed", "interrupted", waited);
    return result;
  }
  const outcome = verifyOutcome(batch);
  result.run = batch.runs[0]?.id ?? null;
  mark(
    "verify",
    outcome.passed ? "done" : "failed",
    outcome.detail,
    [waited, outcome.output].filter(Boolean).join("\n"),
  );
  const logged = `Committed ${sha}; ${outcome.logged}`;

  if (!outcome.passed) {
    attempt("log", () => {
      addLogEntry(root, taskId, "note", logged, who);
      return logged;
    });
    return result;
  }
  // The move's own log entry carries the result, so the task gets one entry.
  if (!attempt("done", () => moveTask(root, taskId, "done", { ...who, note: logged }).message)) {
    return result;
  }
  mark("log", "done", logged);
  result.ok = true;
  return result;
}
