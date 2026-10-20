import { commitsFor, isCodeCommit, sameCommit, staleCause, type Derived } from "./derive";
import type { Facts } from "./facts";
import { globToRegExp, matchesAny } from "./glob";
import type { FeatureEntity, Model } from "./model";
import type { TaskRaw } from "./parse/feature";
import { openPlaceholderScenarios } from "./placeholders";
import { inScope, runScope } from "./run-scope";
import type { FeatureStatus, Gate, GateCheck, Problem } from "./types";
import { isHint } from "./validate";

/** The forward transition each status is waiting for. */
export const NEXT_STATUS: Partial<Record<FeatureStatus, FeatureStatus>> = {
  idea: "draft",
  draft: "approved",
  approved: "in-progress",
  "in-progress": "verifying",
  verifying: "done",
};

export interface GateContext {
  model: Model;
  facts: Facts;
  derived: Derived;
  /** All problems (parse + validation), used by "no check errors". */
  problems: Problem[];
}

const pass = (id: string, rule: string, detail?: string): GateCheck =>
  detail === undefined ? { id, rule, ok: true } : { id, rule, ok: true, detail };
const fail = (id: string, rule: string, detail?: string): GateCheck =>
  detail === undefined ? { id, rule, ok: false } : { id, rule, ok: false, detail };
const check = (id: string, rule: string, ok: boolean, detail?: string): GateCheck =>
  ok ? pass(id, rule) : fail(id, rule, detail);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const shortDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "an unknown date");

function blockingQuestions(ctx: GateContext, f: FeatureEntity) {
  return ctx.model.questions.filter((q) => q.status === "open" && q.blocking && q.feature === f.id);
}

function featureProblems(
  ctx: GateContext,
  f: FeatureEntity,
  severity: Problem["severity"],
): Problem[] {
  const scenarioOrTask = (ref: string | null) =>
    ref !== null && new RegExp(`^(ST|S|T)-${f.id.slice(2)}\\.`).test(ref);
  return ctx.problems.filter(
    (p) =>
      p.severity === severity &&
      (p.file.startsWith(f.dir) || p.ref === f.id || scenarioOrTask(p.ref)),
  );
}

/** Whether `depends_on` reaches back to the feature itself. */
export function hasDependencyCycle(model: Model, start: string): boolean {
  const byId = new Map(model.features.map((f) => [f.id, f]));
  const stack = [...(byId.get(start)?.depends_on ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === start) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.depends_on ?? []));
  }
  return false;
}

function draftGate(f: FeatureEntity): GateCheck[] {
  const missing = (["impact", "stories", "contract", "plan"] as const).filter((k) => !f.files[k]);
  const ok = missing.length === 0 && f.stories.length > 0 && f.tasks.length > 0;
  return [
    check(
      "draft.spec-files",
      "Spec files written (impact, stories, contract, plan)",
      ok,
      `Run /azimuth:spec ${f.id}`,
    ),
  ];
}

function approveGate(ctx: GateContext, f: FeatureEntity): GateCheck[] {
  const scenarios = f.stories.flatMap((s) => s.scenarios);
  const errors = featureProblems(ctx, f, "error");
  const badStories = f.stories.filter(
    (s) =>
      !s.scenarios.some((x) => x.kind === "happy") || !s.scenarios.some((x) => x.kind !== "happy"),
  );
  const formatErrors = errors.filter((p) => p.code === "E-STORY-FORMAT");
  const covered = new Set(f.tasks.flatMap((t) => t.covers));
  const uncovered = scenarios.filter((s) => !covered.has(s.id));
  const noVerify = f.tasks.filter((t) => !t.verify.trim());
  const blocking = blockingQuestions(ctx, f);
  const unknownDeps = f.depends_on.filter((d) => !ctx.derived.features.has(d));
  const cycle = hasDependencyCycle(ctx.model, f.id);
  const current = ctx.derived.currentHash.get(f.id) ?? null;
  const atHead = ctx.facts.git.headSpecHash.get(f.id) ?? null;
  const committed = !ctx.facts.git.available || (current !== null && current === atHead);

  const checks: GateCheck[] = [
    check(
      "approve.no-errors",
      "No check errors in this feature",
      errors.length === 0,
      plural(errors.length, "error"),
    ),
    check(
      "approve.story-kinds",
      "Every story has a happy and a negative or edge scenario",
      f.stories.length > 0 && badStories.length === 0,
      badStories.length > 0 ? badStories.map((s) => s.id).join(", ") : "No stories yet",
    ),
    check(
      "approve.gwt",
      "Every scenario has GIVEN, WHEN and THEN",
      scenarios.length > 0 && formatErrors.length === 0,
      formatErrors.length > 0
        ? plural(formatErrors.length, "malformed scenario")
        : "No scenarios yet",
    ),
    check(
      "approve.scenarios-covered",
      "Every scenario is covered by a task",
      uncovered.length === 0,
      uncovered.map((s) => s.id).join(", "),
    ),
    check(
      "approve.verify-commands",
      "Every task has a verify command",
      f.tasks.length > 0 && noVerify.length === 0,
      noVerify.length > 0 ? noVerify.map((t) => t.id).join(", ") : "No tasks yet",
    ),
    check(
      "approve.committed",
      "Spec files committed",
      committed,
      current === null ? "Spec files are missing" : "Commit the spec before approving it",
    ),
    check(
      "approve.no-blocking-questions",
      "No open blocking questions",
      blocking.length === 0,
      `${blocking.map((q) => q.id).join(", ")} ${blocking.length === 1 ? "is" : "are"} open`,
    ),
    check(
      "approve.dependencies",
      "Dependencies exist and form no cycle",
      unknownDeps.length === 0 && !cycle,
      unknownDeps.length > 0 ? `Unknown: ${unknownDeps.join(", ")}` : "depends_on forms a cycle",
    ),
    check(
      "approve.size",
      "Size is not XL",
      f.size !== "XL",
      "Split the feature before approving it",
    ),
  ];
  if (ctx.model.config.autonomy.strict) {
    // Nothing silences a hint and it goes away at approval, so counting one would block a spec
    // whose scaffolding task or decided offset is deliberate.
    const warnings = featureProblems(ctx, f, "warning").filter((p) => !isHint(p));
    checks.push(
      check(
        "approve.no-warnings",
        "No warnings in this feature",
        warnings.length === 0,
        plural(warnings.length, "warning"),
      ),
    );
  }
  return checks;
}

function startGate(ctx: GateContext, f: FeatureEntity): GateCheck[] {
  const info = ctx.derived.info.get(f.id);
  const changes = info?.approval_changes ?? [];
  const changedDetail =
    changes.length === 0
      ? "The spec changed after approval"
      : changes
          .map((c) => {
            const name = c.path.split("/").pop() ?? c.path;
            return c.commit
              ? `${name} changed on ${shortDate(c.at)} (commit ${c.commit})`
              : `${name} has uncommitted changes`;
          })
          .join("; ");
  const overridden = f.overrides.some((o) => o.gate === "start.dependencies-done");
  const notDone = f.depends_on.filter((d) => ctx.derived.features.get(d)?.status !== "done");
  return [
    check(
      "start.spec-unchanged",
      "Spec unchanged since approval",
      !info?.modified_since_approval,
      changedDetail,
    ),
    overridden && notDone.length > 0
      ? pass("start.dependencies-done", "Every dependency is done", "Overridden")
      : check(
          "start.dependencies-done",
          "Every dependency is done",
          notDone.length === 0,
          notDone
            .map((d) => `${d} is ${ctx.derived.features.get(d)?.status ?? "missing"}`)
            .join(", "),
        ),
  ];
}

function verifyGate(ctx: GateContext, f: FeatureEntity): GateCheck[] {
  const open = f.tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const blocking = blockingQuestions(ctx, f);
  return [
    check(
      "verify.tasks-done",
      "Every task is done or skipped",
      f.tasks.length > 0 && open.length === 0,
      `${open.length} of ${f.tasks.length} tasks still open`,
    ),
    check(
      "verify.no-blocking-questions",
      "No open blocking questions",
      blocking.length === 0,
      `${blocking.map((q) => q.id).join(", ")} ${blocking.length === 1 ? "is" : "are"} open`,
    ),
  ];
}

/**
 * Why a task's passing run isn't current, as the done gate words it; null when it is. A run at
 * HEAD is current, and so is one that no later commit touched within the task's scope outside
 * verify.ignore_paths.
 */
function staleRun(
  ctx: GateContext,
  f: FeatureEntity,
  task: TaskRaw,
  commit: string | null,
  head: string,
): string | null {
  if (commit === null) return `${task.id} last passed at an uncommitted tree`;
  if (sameCommit(commit, head)) return null;
  const { model } = ctx;
  const scope = runScope(
    task,
    f,
    model.knowledge.architecture.modules,
    model.config.verify.shared_paths,
  );
  const ignored = model.config.verify.ignore_paths.map(globToRegExp);
  const cause = staleCause(commit, ctx.facts, scope ? (p) => inScope(p, scope) : null, (p) =>
    matchesAny(p, ignored),
  );
  if (!cause) return null;
  const passed = `${task.id} last passed at ${commit}`;
  if (cause.kind === "changed") return `${passed}; ${cause.commit} changed ${cause.path}`;
  if (cause.kind === "unknown-files")
    return `${passed}; ${cause.commit}'s changed files are unknown`;
  // Outside the history the index read there is no commit or path to name.
  return passed;
}

/**
 * Counts a passing scenario only when one of the tests that count for it is committed: its marked
 * tests when it has any, else its mentions, so a committed mention can't stand in for a marked
 * test that is only in the working tree.
 */
function scenariosPassing(ctx: GateContext, f: FeatureEntity): GateCheck {
  const scenarios = f.stories.flatMap((s) => s.scenarios);
  const left: string[] = [];
  let counted = 0;
  for (const sc of scenarios) {
    const cov = ctx.derived.coverage.get(sc.id);
    if (cov?.status !== "passing") continue;
    const marked = cov.tests.filter((t) => t.confidence === "marker");
    const counting = marked.length > 0 ? marked : cov.tests;
    if (counting.some((t) => t.committed)) {
      counted++;
      continue;
    }
    const files = [...new Set(counting.map((t) => t.file))].sort();
    left.push(`; ${sc.id} only in uncommitted ${files.join(", ")}`);
  }
  const total = scenarios.length;
  return {
    id: "done.scenarios-passing",
    rule: "Every scenario has a passing test",
    ok: total > 0 && counted === total,
    detail: `${counted} of ${total}${left.join("")}`,
  };
}

/**
 * A generated as-built.md starts every deviation with an empty reason, so the file existing isn't
 * enough: each deviation must say why, and one that doesn't parse can't be read for reasons.
 */
function asBuiltCheck(f: FeatureEntity): GateCheck {
  const id = "done.as-built";
  const rule = "as-built.md written";
  if (f.files.asBuilt === null) return fail(id, rule);
  if (f.asBuilt === null)
    return fail(id, rule, `as-built.md has errors (see azimuth check ${f.id})`);
  const unexplained = f.asBuilt.deviations
    .filter((d) => d.reason.trim() === "")
    .map((d) => `${d.path} (${d.kind})`);
  if (unexplained.length === 0) return pass(id, rule);
  return fail(id, rule, `No reason for ${unexplained.join(", ")}`);
}

function doneGate(ctx: GateContext, f: FeatureEntity): GateCheck[] {
  const head = ctx.facts.git.head;
  const failed: string[] = [];
  const stale: string[] = [];
  for (const task of f.tasks) {
    if (task.status === "skipped") continue;
    const run = ctx.derived.lastRun.get(task.id);
    if (!run) stale.push(`${task.id} has no run`);
    else if (!run.ok) failed.push(`${task.id} failed at ${run.commit ?? "an uncommitted tree"}`);
    else if (head) {
      const why = staleRun(ctx, f, task, run.commit, head);
      if (why) stale.push(why);
    }
  }
  const verifyDetail = (failed.length > 0 ? failed : stale).join("; ");
  const reconciled = ctx.model.knowledge.architecture.reconciled_at;
  // The close-out commit (as-built, reconciliation) only changes records, so it doesn't count.
  const lastCommit =
    commitsFor(f.id, ctx.facts).find((c) => isCodeCommit(c.sha, ctx.facts)) ?? null;
  const behind = reconciled ? ctx.facts.git.commitsAfter(reconciled) : null;
  const lastCommitBehind = lastCommit ? ctx.facts.git.commitsAfter(lastCommit.sha) : null;
  const open = openPlaceholderScenarios(f.spec?.stories ?? "");
  const archOk =
    reconciled !== null &&
    (lastCommit === null ||
      (behind !== null && lastCommitBehind !== null && behind <= lastCommitBehind));
  return [
    check(
      "done.verify-passed",
      "Latest verify run of every task passed at HEAD",
      failed.length + stale.length === 0,
      verifyDetail,
    ),
    scenariosPassing(ctx, f),
    check(
      "done.placeholders-settled",
      "Every placeholder value settled",
      open.length === 0,
      open.join(", "),
    ),
    asBuiltCheck(f),
    check(
      "done.architecture-reconciled",
      "Architecture reconciled after the feature's last commit",
      archOk,
      reconciled === null
        ? "architecture.md has never been reconciled"
        : `Reconciled at ${reconciled}, ${behind ?? "?"} commits behind`,
    ),
  ];
}

/** Evaluates the gate for moving `f` to `to` (forward transitions only). */
export function evaluateGate(ctx: GateContext, f: FeatureEntity, to: FeatureStatus): Gate | null {
  switch (to) {
    case "draft":
      return f.status === "idea" || f.status === "deferred" ? { to, checks: draftGate(f) } : null;
    case "approved":
      return { to, checks: approveGate(ctx, f) };
    case "in-progress":
      return { to, checks: startGate(ctx, f) };
    case "verifying":
      return { to, checks: verifyGate(ctx, f) };
    case "done":
      return { to, checks: doneGate(ctx, f) };
    default:
      return null;
  }
}

export function nextGate(ctx: GateContext, f: FeatureEntity): Gate | null {
  const to = NEXT_STATUS[f.status];
  return to ? evaluateGate(ctx, f, to) : null;
}

export function gatePasses(gate: Gate | null): boolean {
  return gate !== null && gate.checks.every((c) => c.ok);
}
