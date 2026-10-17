import type {
  Decision,
  Feature,
  Index,
  Issue,
  Milestone,
  Question,
  Scenario,
  Session,
  Story,
  Task,
  VerifyRun,
} from "../../../src/core/types";
import {
  COVERAGE_LOOK,
  DECISION_LOOK,
  FEATURE_LOOK,
  ISSUE_LOOK,
  MILESTONE_LOOK,
  QUESTION_LOOK,
  TASK_LOOK,
  type StatusLook,
} from "../lib/status";

/** Lookups and derived bits the screens share. Everything the client can compute stays here. */

export const featureById = (index: Index, id: string): Feature | undefined =>
  index.features.find((f) => f.id === id);
export const decisionById = (index: Index, id: string): Decision | undefined =>
  index.decisions.find((d) => d.id === id);
export const questionById = (index: Index, id: string): Question | undefined =>
  index.questions.find((q) => q.id === id);
export const issueById = (index: Index, id: string): Issue | undefined =>
  index.issues.find((i) => i.id === id);
export const sessionById = (index: Index, id: string): Session | undefined =>
  index.sessions.find((s) => s.id === id);
export const milestoneById = (index: Index, id: string): Milestone | undefined =>
  index.milestones.find((m) => m.id === id);
export const runById = (index: Index, id: string): VerifyRun | undefined =>
  index.runs.find((r) => r.id === id);

export function taskById(index: Index, id: string): { task: Task; feature: Feature } | undefined {
  for (const feature of index.features) {
    const task = feature.detail?.tasks.find((t) => t.id === id);
    if (task) return { task, feature };
  }
  return undefined;
}

export function scenarioById(
  index: Index,
  id: string,
): { scenario: Scenario; story: Story; feature: Feature } | undefined {
  for (const feature of index.features) {
    for (const story of feature.detail?.stories ?? []) {
      const scenario = story.scenarios.find((s) => s.id === id);
      if (scenario) return { scenario, story, feature };
    }
  }
  return undefined;
}

export function questionLook(q: Question): StatusLook {
  if (q.status === "open") return q.blocking ? QUESTION_LOOK.blocking : QUESTION_LOOK.open;
  if (q.status === "answered") return q.resolution ? QUESTION_LOOK.applied : QUESTION_LOOK.answered;
  return QUESTION_LOOK.obsolete;
}

/** Lifecycle step dates from transition log entries (idea = created). */
export function stepDates(f: Feature): Record<string, { at: string; actor: string } | undefined> {
  const out: Record<string, { at: string; actor: string } | undefined> = {
    idea: { at: f.created, actor: "" },
  };
  for (const entry of f.detail?.log ?? []) {
    if (entry.transition) out[entry.transition.to] = { at: entry.at, actor: entry.actor };
  }
  return out;
}

/** Earliest `created` among a milestone's counted features (its lane start on the roadmap). */
export function milestoneStart(index: Index, m: Milestone): string | null {
  const dates = index.features
    .filter((f) => f.milestone === m.id && f.status !== "cancelled" && f.status !== "superseded")
    .map((f) => f.created)
    .sort();
  return dates[0] ?? null;
}

export function openErrors(index: Index): number {
  return index.problems.filter((p) => p.severity === "error").length;
}

export interface EntitySummary {
  id: string;
  title: string;
  look: StatusLook | null;
  facts: string[];
}

/** One-line summaries for hover cards and the command palette. */
export function describe(index: Index, id: string): EntitySummary | null {
  const f = featureById(index, id);
  if (f) {
    const facts = [
      `Tasks ${f.derived.progress.done}/${f.derived.progress.total} · ${f.derived.coverage.passing}/${f.derived.coverage.total} scenarios passing`,
    ];
    if (f.derived.blocked_by.length)
      facts.push(`Blocked by ${f.derived.blocked_by.map((b) => b.id).join(", ")}`);
    return { id, title: f.title, look: FEATURE_LOOK[f.status], facts };
  }
  const q = questionById(index, id);
  if (q) {
    const facts = [
      q.blocking && q.status === "open" ? `Blocks ${q.feature ?? "work"}` : "Not blocking",
    ];
    if (q.answer)
      facts.push(
        `Answered: ${q.options.find((o) => o.key === q.answer?.option)?.label ?? q.answer.text}`,
      );
    return { id, title: q.title, look: questionLook(q), facts };
  }
  const d = decisionById(index, id);
  if (d)
    return {
      id,
      title: d.title,
      look: DECISION_LOOK[d.status],
      facts: d.supersedes ? [`Supersedes ${d.supersedes}`] : [],
    };
  const i = issueById(index, id);
  if (i) {
    const facts = [
      i.type === "risk"
        ? `Likelihood ${i.likelihood} · impact ${i.impact}`
        : `Severity ${i.severity}`,
    ];
    return { id, title: i.title, look: ISSUE_LOOK[i.status], facts };
  }
  const t = taskById(index, id);
  if (t) {
    const run = t.task.last_run;
    return {
      id,
      title: t.task.title,
      look: TASK_LOOK[t.task.status],
      facts: [
        `In ${t.feature.id}`,
        run ? `Last run ${run.run} ${run.ok ? "passed" : "failed"}` : "Never run",
      ],
    };
  }
  const sc = scenarioById(index, id);
  if (sc)
    return {
      id,
      title: sc.scenario.title,
      look: COVERAGE_LOOK[sc.scenario.coverage.status],
      facts: [`${sc.story.id} · ${sc.scenario.kind}`],
    };
  const s = sessionById(index, id);
  if (s)
    return {
      id,
      title: s.goal,
      look: null,
      facts: [`${s.agent}${s.skill ? ` · ${s.skill}` : ""}`],
    };
  const m = milestoneById(index, id);
  if (m)
    return {
      id,
      title: m.title,
      look: MILESTONE_LOOK[m.status],
      facts: [`${m.progress.done} of ${m.progress.total} done`],
    };
  const r = runById(index, id);
  if (r)
    return {
      id,
      title: r.command,
      look: r.ok ? COVERAGE_LOOK.passing : COVERAGE_LOOK.failing,
      facts: [`${r.target} · exit ${r.exit_code}`],
    };
  return null;
}
