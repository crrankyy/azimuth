import { codeChangedSince, commitsFor, type Derived } from "./derive";
import type { Facts } from "./facts";
import type { FeatureEntity, Model } from "./model";
import type { FeatureStatus, Gate, GateCheck, Problem } from "./types";

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
    const warnings = featureProblems(ctx, f, "warning");
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

/** A run at HEAD is current, and so is one followed only by commits to Azimuth's records. */
function runCurrent(commit: string | null, head: string, facts: Facts): boolean {
  if (commit === null) return false;
  if (commit === head) return true;
  return codeChangedSince(commit, facts) === false;
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
    else if (head && !runCurrent(run.commit, head, ctx.facts))
      stale.push(`${task.id} last passed at ${run.commit ?? "an uncommitted tree"}`);
  }
  const verifyDetail = (failed.length > 0 ? failed : stale).join("; ");
  const info = ctx.derived.info.get(f.id);
  const cov = info?.coverage;
  const reconciled = ctx.model.knowledge.architecture.reconciled_at;
  const lastCommit = commitsFor(f.id, ctx.facts)[0] ?? null;
  const behind = reconciled ? ctx.facts.git.commitsAfter(reconciled) : null;
  const lastCommitBehind = lastCommit ? ctx.facts.git.commitsAfter(lastCommit.sha) : null;
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
    {
      id: "done.scenarios-passing",
      rule: "Every scenario has a passing test",
      ok: cov !== undefined && cov.total > 0 && cov.passing === cov.total,
      detail: `${cov?.passing ?? 0} of ${cov?.total ?? 0}`,
    },
    check("done.as-built", "as-built.md written", f.files.asBuilt !== null),
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
