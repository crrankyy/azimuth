import { spawnSync } from "node:child_process";
import { analyzeProject } from "./build-index";
import { AzimuthError, isAzimuthError } from "./errors";
import { headSha, isGitRepo } from "./git";
import { featureOf, idKind } from "./ids";
import type { FeatureEntity } from "./model";
import { addNote } from "./notes";
import type { TaskRaw } from "./parse/feature";
import { inScope, runScope } from "./run-scope";
import { addLogEntry, moveTask, type Who } from "./transitions";
import type { Id, Problem } from "./types";
import { verifyBatch, verifyTargets, type VerifyBatchResult } from "./verify";

export type FinishStepName = "check" | "note" | "stage" | "commit" | "verify" | "done" | "log";
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
   * check, note, stage, commit, verify, done, log, in this order, every one of them (status
   * "not-run" for those that didn't run); "note" only when a note was given.
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
}

export interface FinishOptions extends Who {
  /** The commit message as given; withRefsTrailer adds `Refs: <T-ID>` when it has no Refs line. */
  message: string;
  /** Appended to the feature's notes.md (F-008 addNote) before staging; null or absent: no note step. */
  note?: string | null;
  /** Aborting kills the running verify command (verifyBatch); done and log don't run. */
  signal?: AbortSignal;
}

export interface PathSelection {
  /** Changed paths that are the task's files (or under one) or under the feature's folder, sorted. */
  staged: string[];
  /** Every other changed path, sorted. */
  not_staged: string[];
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

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, "").split("\n").slice(-lines).join("\n");
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

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
  | { ok: true; feature: FeatureEntity; task: TaskRaw; tailLines: number }
  | { ok: false; detail: string; output: string };

const refuse = (detail: string, output = ""): Checked => ({ ok: false, detail, output });

/** The check step: reads only, in the order of contract.md's table. */
function check(root: string, taskId: string, featureId: string, now: Date): Checked {
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
  const staged = runGit(root, ["diff", "--cached", "--name-only", "--no-renames", "-z"]);
  if (staged.code !== 0) {
    return refuse(`git diff failed (exit ${staged.code})`, tail(staged.output, tailLines));
  }
  // Refusing here keeps the commit to the staged set without a pathspec commit.
  const outside = selectPaths(nulList(staged.stdout), task, feature.dir).not_staged;
  if (outside.length > 0) {
    return refuse(
      `Already staged, but not ${taskId}'s files or ${featureId}'s records: ${outside.join(", ")}. Unstage them (git restore --staged <path>) or commit them first.`,
    );
  }
  return { ok: true, feature, task, tailLines };
}

interface VerifyOutcome {
  passed: boolean;
  detail: string;
  output: string;
  /** What the log entry says after `Committed <sha>; `. */
  logged: string;
}

function verifyOutcome(batch: VerifyBatchResult): VerifyOutcome {
  const { prebuild } = batch;
  if (prebuild && !prebuild.ok) {
    const failed = `prebuild failed (exit ${prebuild.exit_code})`;
    return {
      passed: false,
      detail: `${failed} in ${seconds(prebuild.duration_ms)}`,
      output: prebuild.output_tail,
      logged: `${failed}.`,
    };
  }
  const run = batch.runs[0];
  if (!run) throw new Error("verifyBatch recorded no run for the task.");
  if (run.ok) {
    return {
      passed: true,
      detail: `${run.id} passed in ${seconds(run.duration_ms)}`,
      output: "",
      logged: `${run.id} passed.`,
    };
  }
  const failed = `${run.id} failed (exit ${run.exit_code})`;
  return {
    passed: false,
    detail: `${failed} in ${seconds(run.duration_ms)}`,
    output: run.output_tail,
    logged: `${failed}.`,
  };
}

const STEPS: FinishStepName[] = ["check", "note", "stage", "commit", "verify", "done", "log"];

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
  const result: FinishResult = {
    task: taskId,
    feature: featureId,
    ok: false,
    steps: STEPS.filter((name) => name !== "note" || hasNote).map((name) => ({
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

  const checked = check(root, taskId, featureId, opts.now ?? new Date());
  if (!checked.ok) {
    mark("check", "failed", checked.detail, checked.output);
    return result;
  }
  mark("check", "done", `${featureId} has no errors`);
  const { feature, task, tailLines } = checked;

  if (hasNote && !attempt("note", () => addNote(root, taskId, opts.note ?? "", who).message)) {
    return result;
  }

  const status = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
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
  if (selection.staged.length === 0) {
    mark(
      "stage",
      "failed",
      `Nothing to commit: none of ${taskId}'s files and none of ${featureId}'s records changed.`,
    );
    return result;
  }
  // Literal pathspecs: a path holding `*` or `[` must stage that file, never what it matches.
  const add = runGit(root, ["--literal-pathspecs", "add", "-A", "--", ...selection.staged]);
  if (add.code !== 0) {
    mark("stage", "failed", `git add failed (exit ${add.code})`, tail(add.output, tailLines));
    return result;
  }
  result.staged = selection.staged;
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
  const sha = headSha(root) ?? "";
  result.commit = sha;
  mark("commit", "done", `${sha} ${message.split("\n")[0] ?? ""}`);

  let batch: VerifyBatchResult;
  try {
    batch = await verifyBatch(root, verifyTargets(root, [taskId]), {
      ses: opts.session ?? null,
      signal: opts.signal,
    });
  } catch (e) {
    if (!isAzimuthError(e)) throw e;
    mark("verify", "failed", e.message);
    return result;
  }
  if (batch.interrupted) {
    result.interrupted = true;
    mark("verify", "failed", "interrupted");
    return result;
  }
  const outcome = verifyOutcome(batch);
  result.run = batch.runs[0]?.id ?? null;
  mark("verify", outcome.passed ? "done" : "failed", outcome.detail, outcome.output);
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
