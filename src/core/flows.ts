import type {
  DecisionStatus,
  FeatureStatus,
  IssueStatus,
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

export const ISSUE_FLOW: Record<IssueStatus, IssueStatus[]> = {
  open: ["in-progress", "resolved", "wontfix"],
  "in-progress": ["resolved", "wontfix", "open"],
  resolved: ["open"],
  wontfix: ["open"],
};
