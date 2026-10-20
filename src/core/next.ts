import { milestoneReady } from "./derive";
import { globToRegExp, matchesAny } from "./glob";
import {
  PRIORITIES,
  SEVERITIES,
  type Feature,
  type Id,
  type Index,
  type Issue,
  type Question,
  type Task,
} from "./types";

export interface NextItem {
  ref: string;
  title: string;
  /** The concrete next step, usually a command. */
  action: string;
  reason: string;
}

/** Tasks whose prerequisites are finished, in-progress ones first, in plan order. */
export function readyTasks(f: Feature): Task[] {
  const tasks = f.detail?.tasks ?? [];
  const finished = new Set(
    tasks.filter((t) => t.status === "done" || t.status === "skipped").map((t) => t.id),
  );
  const ready = tasks.filter(
    (t) =>
      (t.status === "todo" || t.status === "in-progress") && t.after.every((a) => finished.has(a)),
  );
  return [
    ...ready.filter((t) => t.status === "in-progress"),
    ...ready.filter((t) => t.status === "todo"),
  ];
}

/** Ready tasks that can be built at the same time. */
export interface TaskGroup {
  /** Task IDs, in the order next lists them. */
  tasks: Id[];
  /** Files matching parallel.shared_files that two or more of the tasks list, sorted. */
  shared: string[];
}

interface FormingGroup {
  tasks: Task[];
  /** Files outside the shared list that its tasks list. */
  claimed: Set<string>;
  /** It holds a task without files: nothing says what that task changes, so no other joins. */
  closed: boolean;
}

/** Shared files that two or more of the tasks list, sorted. */
function sharedIn(tasks: Task[], shared: RegExp[]): string[] {
  const listedBy = new Map<string, number>();
  for (const t of tasks) {
    for (const path of new Set(t.files)) {
      if (matchesAny(path, shared)) listedBy.set(path, (listedBy.get(path) ?? 0) + 1);
    }
  }
  return [...listedBy]
    .filter(([, n]) => n >= 2)
    .map(([path]) => path)
    .sort();
}

/**
 * Groups tasks greedily, in the order given: each task joins the first group in which no task
 * lists one of its files, files matching `sharedFiles` aside; otherwise it starts a new group.
 * A task without files starts a group of its own that no later task joins. Paths compare as
 * written; the globs are compiled with globToRegExp.
 */
export function parallelGroups(tasks: Task[], sharedFiles: string[]): TaskGroup[] {
  const shared = sharedFiles.map(globToRegExp);
  const groups: FormingGroup[] = [];
  for (const t of tasks) {
    const own = t.files.filter((path) => !matchesAny(path, shared));
    const closed = t.files.length === 0;
    const group = closed
      ? undefined
      : groups.find((g) => !g.closed && own.every((path) => !g.claimed.has(path)));
    if (!group) {
      groups.push({ tasks: [t], claimed: new Set(own), closed });
      continue;
    }
    group.tasks.push(t);
    for (const path of own) group.claimed.add(path);
  }
  return groups.map((g) => ({
    tasks: g.tasks.map((t) => t.id),
    shared: sharedIn(g.tasks, shared),
  }));
}

/**
 * The groups of a feature's ready tasks, in readyTasks order (in-progress first, then todo,
 * each in plan order), using index.project.shared_files. [] unless the feature is in progress.
 */
export function taskGroups(index: Index, f: Feature): TaskGroup[] {
  if (f.status !== "in-progress") return [];
  return parallelGroups(readyTasks(f), index.project.shared_files);
}

const byPriority = (a: Feature, b: Feature) =>
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id);

function failingChecks(f: Feature): string {
  return (f.derived.next_gate?.checks ?? [])
    .filter((c) => !c.ok)
    .map((c) => `${c.rule}${c.detail ? ` (${c.detail})` : ""}`)
    .join("; ");
}

/**
 * Questions you answered (answer.by: you) that no agent has applied yet (`azimuth resolve` not
 * run). An agent's own answer is not the user's decision, so it is left out.
 */
export function pendingAnswers(index: Index): Question[] {
  return index.questions.filter(
    (q) => q.status === "answered" && q.answer?.by === "you" && !q.resolution,
  );
}

/** The user's answer in words: the chosen option's label and their note. */
export function answerText(q: Question): string {
  const option = q.options.find((o) => o.key === q.answer?.option);
  return [option?.label, q.answer?.text].filter(Boolean).join(" — ") || "(no answer text)";
}

/**
 * What to work on next for one feature. The user's unapplied answers come first; a draft isn't
 * offered for approval until they are applied, since its spec may have to change.
 */
export function nextForFeature(index: Index, f: Feature): NextItem[] {
  const apply = pendingAnswers(index)
    .filter((q) => q.feature === f.id)
    .map((q) => ({
      ref: q.id,
      title: q.title,
      action: `Apply the user's answer to ${f.id}, then azimuth resolve ${q.id} --assumption ${f.id} (or --adr ADR-…)`,
      reason: `The user answered: ${answerText(q)}`,
    }));
  if (apply.length > 0 && f.status === "draft") return apply;
  return [...apply, ...stepsForFeature(index, f)];
}

function stepsForFeature(index: Index, f: Feature): NextItem[] {
  const blockers = f.derived.blocked_by.map((b) => b.id).join(", ");
  switch (f.status) {
    case "idea": {
      // Once the spec files exist the draft gate passes; the spec's content is judged at approval.
      const written = f.derived.next_gate?.checks.every((c) => c.ok) ?? false;
      return [
        written
          ? {
              ref: f.id,
              title: f.title,
              action: `azimuth move ${f.id} draft`,
              reason: "Spec written; ready for draft",
            }
          : {
              ref: f.id,
              title: f.title,
              action: `/azimuth:spec ${f.id}`,
              reason: "Idea without a spec",
            },
      ];
    }
    case "draft": {
      const gate = f.derived.next_gate;
      if (gate?.checks.every((c) => c.ok)) {
        const auto = index.project.autonomy.approve_specs === "auto";
        return [
          {
            ref: f.id,
            title: f.title,
            action: auto
              ? `azimuth move ${f.id} approved`
              : "Ask the user to approve it in the viewer",
            reason: "Every approval check passes",
          },
        ];
      }
      return [
        {
          ref: f.id,
          title: f.title,
          action: `/azimuth:spec ${f.id}`,
          reason: `Spec incomplete: ${failingChecks(f)}`,
        },
      ];
    }
    case "approved":
      if (blockers)
        return [{ ref: f.id, title: f.title, action: "Wait", reason: `Blocked by ${blockers}` }];
      return [
        {
          ref: f.id,
          title: f.title,
          action: `/azimuth:build ${f.id}`,
          reason: "Approved and unblocked",
        },
      ];
    case "in-progress": {
      const ready = readyTasks(f);
      if (ready.length > 0) {
        return ready.map((t) => ({
          ref: t.id,
          title: t.title,
          action:
            t.status === "in-progress" ? `Continue ${t.id}` : `azimuth move ${t.id} in-progress`,
          reason: `${f.id}${t.covers.length ? `, covers ${t.covers.join(", ")}` : ""}`,
        }));
      }
      const open = (f.detail?.tasks ?? []).filter(
        (t) => t.status !== "done" && t.status !== "skipped",
      );
      if (open.length === 0) {
        return [
          {
            ref: f.id,
            title: f.title,
            action: `azimuth move ${f.id} verifying`,
            reason: "Every task is done",
          },
        ];
      }
      return [
        {
          ref: f.id,
          title: f.title,
          action: "Unblock a task",
          reason: `Blocked tasks: ${open.map((t) => t.id).join(", ")}`,
        },
      ];
    }
    case "verifying":
      return [
        {
          ref: f.id,
          title: f.title,
          action: `/azimuth:verify ${f.id}`,
          reason: failingChecks(f) || "Ready to close",
        },
      ];
    default:
      return [];
  }
}

const GROUPS: Feature["status"][] = ["in-progress", "verifying", "approved", "draft", "idea"];

/** Open critical and high-severity bugs and debt: in-progress first, then most severe, then by ID. */
export function urgentIssues(index: Index): Issue[] {
  const rank = (i: Issue) => SEVERITIES.indexOf(i.severity ?? "low");
  return index.issues
    .filter(
      (i) =>
        (i.status === "open" || i.status === "in-progress") &&
        (i.severity === "critical" || i.severity === "high"),
    )
    .sort(
      (a, b) =>
        Number(b.status === "in-progress") - Number(a.status === "in-progress") ||
        rank(b) - rank(a) ||
        a.id.localeCompare(b.id),
    );
}

function issueItem(i: Issue): NextItem {
  return {
    ref: i.id,
    title: i.title,
    action: i.status === "in-progress" ? `Continue ${i.id}` : `azimuth move ${i.id} in-progress`,
    reason: `${i.severity} ${i.type}`,
  };
}

/**
 * One item per index milestone that milestoneReady accepts, in index order: only the user
 * releases a milestone, so the agent's step is to ask.
 */
export function releaseItems(index: Index): NextItem[] {
  return index.milestones.filter(milestoneReady).map((m) => ({
    ref: m.id,
    title: m.title,
    action: `Ask the user to release ${m.id} in the viewer`,
    reason: "Every feature is done; only the user releases a milestone",
  }));
}

/**
 * Highest-value unblocked work across the project, best first: critical issues, milestones ready
 * for release (releaseItems), feature work, then high-severity issues.
 */
export function nextWork(index: Index): NextItem[] {
  const urgent = urgentIssues(index);
  const items: NextItem[] = urgent.filter((i) => i.severity === "critical").map(issueItem);
  // Ahead of feature work: status --brief shows only the first five items, and a release costs
  // the agent one sentence to the user.
  items.push(...releaseItems(index));
  for (const status of GROUPS) {
    const features = index.features.filter((f) => f.status === status).sort(byPriority);
    for (const f of features) {
      const blockedByQuestion = f.derived.blocked_by.some((b) => b.kind === "question");
      if (blockedByQuestion) continue;
      for (const item of nextForFeature(index, f)) {
        if (item.action !== "Wait") items.push(item);
      }
    }
  }
  items.push(...urgent.filter((i) => i.severity === "high").map(issueItem));
  return items;
}
