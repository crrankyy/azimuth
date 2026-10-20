import type {
  DecisionStatus,
  FeatureStatus,
  IssueStatus,
  Milestone,
  MilestoneStatus,
  TaskStatus,
} from "./types";

/*
 * Lifecycle tables: which status each entity can move to next. Pure data with no Node imports,
 * so the viewer offers exactly the moves the server allows.
 */

/** Statuses whose features are being specified or built. */
export const ACTIVE_STATUSES: FeatureStatus[] = ["approved", "in-progress", "verifying"];

export const FEATURE_FLOW: Record<FeatureStatus, FeatureStatus[]> = {
  idea: ["draft", "deferred", "cancelled"],
  draft: ["approved", "deferred", "cancelled", "superseded"],
  approved: ["in-progress", "draft", "deferred", "cancelled", "superseded"],
  "in-progress": ["verifying", "draft", "deferred", "cancelled"],
  verifying: ["done", "in-progress"],
  deferred: ["idea", "draft"],
  done: [],
  cancelled: [],
  superseded: [],
};

export const TASK_FLOW: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in-progress", "done", "blocked", "skipped"],
  "in-progress": ["done", "blocked", "skipped", "todo"],
  blocked: ["todo", "in-progress", "skipped"],
  done: ["in-progress"],
  skipped: ["todo"],
};

export const DECISION_FLOW: Record<DecisionStatus, DecisionStatus[]> = {
  proposed: ["accepted", "rejected"],
  accepted: ["superseded", "proposed"],
  rejected: ["proposed"],
  superseded: [],
};

export const MILESTONE_FLOW: Record<MilestoneStatus, MilestoneStatus[]> = {
  planned: ["active"],
  active: ["released", "planned"],
  released: [],
};

/**
 * A planned or active milestone with at least one counted feature, every one of them done.
 * Counting follows milestoneProgress (derive.ts): cancelled and superseded features don't count;
 * a deferred feature counts and isn't done. Here rather than in derive.ts so that next.ts, which
 * the viewer can use, stays free of Node imports.
 */
export function milestoneReady(m: Pick<Milestone, "status" | "progress">): boolean {
  if (m.status !== "planned" && m.status !== "active") return false;
  return m.progress.total > 0 && m.progress.done === m.progress.total;
}

export const ISSUE_FLOW: Record<IssueStatus, IssueStatus[]> = {
  open: ["in-progress", "resolved", "wontfix"],
  "in-progress": ["resolved", "wontfix", "open"],
  resolved: ["open"],
  wontfix: ["open"],
};
