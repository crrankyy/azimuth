import { ACTIVE_STATUSES } from "../../../../src/core/flows";
import type { Feature, Id, Index, Issue, Task, TaskStatus } from "../../../../src/core/types";
import { describe } from "../../data/selectors";
import { routeForId } from "../../lib/router";
import { FEATURE_LOOK, ISSUE_LOOK, TASK_LOOK, type StatusLook } from "../../lib/status";
import { featuresChanging, issuePageHref } from "./model";

export interface RelatedItem {
  id: Id;
  /** task: changes an issue file; feature: plans to; link: in `links`; shared-file: a risk listing the same file. */
  kind: "task" | "feature" | "link" | "shared-file";
  /** The item's title, or "Not in the index". */
  title: string;
  /** "Changes src/worker/deliver.ts · covers S-005.3.1, S-005.3.2", "Plans to change …", "Linked from RISK-0001", "Shares src/store/db.ts". */
  reason: string;
  look: StatusLook | null;
  /** Issues link to their page (issuePageHref); everything else to routeForId(id). */
  href: string;
}

/** The muted line under "Related work". */
export const RELATED_RULE =
  "Open tasks of active features that change this issue's files, and the decisions, risks and issues it links to or shares a file with. Matched by file and ID, not decided by anyone.";

const OPEN_TASK: TaskStatus[] = ["todo", "in-progress", "blocked"];

const isIssueId = (id: Id) => /^(BUG|DEBT|RISK)-/.test(id);

/** An active feature's open tasks whose `files` include one of the issue's files. */
function openTasksTouching(f: Feature, issue: Issue): Task[] {
  if (!ACTIVE_STATUSES.includes(f.status)) return [];
  return (f.detail?.tasks ?? []).filter(
    (t) => OPEN_TASK.includes(t.status) && t.files.some((p) => issue.files.includes(p)),
  );
}

function taskRow(t: Task, issue: Issue): RelatedItem {
  const paths = issue.files.filter((p) => t.files.includes(p));
  const covers = t.covers.length > 0 ? ` · covers ${t.covers.join(", ")}` : "";
  return {
    id: t.id,
    kind: "task",
    title: t.title,
    reason: `Changes ${paths.join(", ")}${covers}`,
    look: TASK_LOOK[t.status],
    href: routeForId(t.id),
  };
}

/** Features that plan to change one of the issue's files (featuresChanging), in index order. */
function featureRows(index: Index, issue: Issue): RelatedItem[] {
  const planned = issue.files.map((path) => ({
    path,
    ids: featuresChanging(index, path).map((f) => f.id),
  }));
  return index.features.flatMap((f) => {
    const paths = planned.filter((p) => p.ids.includes(f.id)).map((p) => p.path);
    if (paths.length === 0) return [];
    return [
      {
        id: f.id,
        kind: "feature" as const,
        title: f.title,
        reason: `Plans to change ${paths.join(", ")}`,
        look: FEATURE_LOOK[f.status],
        href: routeForId(f.id),
      },
    ];
  });
}

/** IDs in `links` other than features, which the aside shows instead. */
function linkRows(index: Index, issue: Issue): RelatedItem[] {
  return issue.links
    .filter((id) => !id.startsWith("F-"))
    .map((id) => {
      const summary = describe(index, id);
      return {
        id,
        kind: "link" as const,
        title: summary?.title ?? "Not in the index",
        reason: `Linked from ${issue.id}`,
        look: summary?.look ?? null,
        href: isIssueId(id) ? issuePageHref(id) : routeForId(id),
      };
    });
}

/** Other risks that list one of the issue's files. */
function sharedRiskRows(index: Index, issue: Issue): RelatedItem[] {
  return index.issues.flatMap((other) => {
    const paths = issue.files.filter((p) => other.files.includes(p));
    if (other.type !== "risk" || other.id === issue.id || paths.length === 0) return [];
    return [
      {
        id: other.id,
        kind: "shared-file" as const,
        title: other.title,
        reason: `Shares ${paths.join(", ")}`,
        look: ISSUE_LOOK[other.status],
        href: issuePageHref(other.id),
      },
    ];
  });
}

/** Tasks, then feature plans, then links, then risks sharing a file; no duplicates, first reason wins. */
export function relatedWork(index: Index, issue: Issue): RelatedItem[] {
  const touching = index.features.map((f) => ({ id: f.id, tasks: openTasksTouching(f, issue) }));
  const tasks = touching.flatMap((x) => x.tasks.map((t) => taskRow(t, issue)));
  // A feature with task rows is already represented by them.
  const tasked = new Set(touching.filter((x) => x.tasks.length > 0).map((x) => x.id));
  const features = featureRows(index, issue).filter((f) => !tasked.has(f.id));
  const seen = new Set<Id>([issue.id]);
  return [...tasks, ...features, ...linkRows(index, issue), ...sharedRiskRows(index, issue)].filter(
    (item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    },
  );
}
