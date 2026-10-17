import { PRIORITIES, type Feature, type Index, type Task } from "./types";

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

const byPriority = (a: Feature, b: Feature) =>
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id);

function failingChecks(f: Feature): string {
  return (f.derived.next_gate?.checks ?? [])
    .filter((c) => !c.ok)
    .map((c) => `${c.rule}${c.detail ? ` (${c.detail})` : ""}`)
    .join("; ");
}

/** What to work on next for one feature. */
export function nextForFeature(index: Index, f: Feature): NextItem[] {
  const blockers = f.derived.blocked_by.map((b) => b.id).join(", ");
  switch (f.status) {
    case "idea":
      return [
        {
          ref: f.id,
          title: f.title,
          action: `/azimuth:spec ${f.id}`,
          reason: "Idea without a spec",
        },
      ];
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

/** Highest-value unblocked work across the project, best first. */
export function nextWork(index: Index): NextItem[] {
  const items: NextItem[] = [];
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
  return items;
}
