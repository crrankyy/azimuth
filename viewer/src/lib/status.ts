import type {
  CoverageStatus,
  DecisionStatus,
  FeatureStatus,
  IssueStatus,
  MilestoneStatus,
  QuestionStatus,
  TaskStatus,
} from "../../../src/core/types";

/**
 * Status glyph classes (`.az-g.s-*` in azimuth.css) and labels. Shape and fill carry the status
 * alongside color, so every glyph is paired with a text label.
 */
export interface StatusLook {
  glyph: string;
  label: string;
  /** Coverage-bar segment class (`.c-*`). */
  segment: string;
}

export const FEATURE_LOOK: Record<FeatureStatus, StatusLook> = {
  idea: { glyph: "s-idea", label: "Idea", segment: "c-idea" },
  draft: { glyph: "s-draft", label: "Draft", segment: "c-draft" },
  approved: { glyph: "s-approved", label: "Approved", segment: "c-approved" },
  "in-progress": { glyph: "s-active", label: "In progress", segment: "c-active" },
  verifying: { glyph: "s-verifying", label: "Verifying", segment: "c-verifying" },
  done: { glyph: "s-done", label: "Done", segment: "c-pass" },
  deferred: { glyph: "s-muted", label: "Deferred", segment: "c-muted" },
  cancelled: { glyph: "s-muted", label: "Cancelled", segment: "c-muted" },
  superseded: { glyph: "s-muted", label: "Superseded", segment: "c-muted" },
};

export const TASK_LOOK: Record<TaskStatus, StatusLook> = {
  todo: { glyph: "", label: "Todo", segment: "c-idea" },
  "in-progress": { glyph: "s-active", label: "In progress", segment: "c-active" },
  done: { glyph: "s-done", label: "Done", segment: "c-pass" },
  blocked: { glyph: "s-blocked", label: "Blocked", segment: "c-fail" },
  skipped: { glyph: "s-muted", label: "Skipped", segment: "c-muted" },
};

export const COVERAGE_LOOK: Record<CoverageStatus, StatusLook> = {
  passing: { glyph: "s-done", label: "passing", segment: "c-pass" },
  failing: { glyph: "s-failing", label: "failing", segment: "c-fail" },
  "not-run": { glyph: "s-notrun", label: "not run", segment: "c-notrun" },
  untested: { glyph: "s-untested", label: "untested", segment: "c-untested" },
};

export const QUESTION_LOOK: Record<QuestionStatus | "blocking" | "applied", StatusLook> = {
  open: { glyph: "s-open", label: "Open", segment: "c-active" },
  blocking: { glyph: "s-blocked", label: "Blocking", segment: "c-fail" },
  answered: { glyph: "s-verifying", label: "Answered", segment: "c-verifying" },
  applied: { glyph: "s-done", label: "Answered", segment: "c-pass" },
  obsolete: { glyph: "s-muted", label: "Obsolete", segment: "c-muted" },
};

export const DECISION_LOOK: Record<DecisionStatus, StatusLook> = {
  proposed: { glyph: "s-proposed", label: "Proposed", segment: "c-draft" },
  accepted: { glyph: "s-done", label: "Accepted", segment: "c-pass" },
  rejected: { glyph: "s-muted", label: "Rejected", segment: "c-muted" },
  superseded: { glyph: "s-muted", label: "Superseded", segment: "c-muted" },
};

export const MILESTONE_LOOK: Record<MilestoneStatus, StatusLook> = {
  planned: { glyph: "s-idea", label: "Planned", segment: "c-idea" },
  active: { glyph: "s-active", label: "Active", segment: "c-active" },
  released: { glyph: "s-done", label: "Released", segment: "c-pass" },
};

export const ISSUE_LOOK: Record<IssueStatus, StatusLook> = {
  open: { glyph: "s-open", label: "Open", segment: "c-active" },
  "in-progress": { glyph: "s-active", label: "In progress", segment: "c-active" },
  resolved: { glyph: "s-done", label: "Resolved", segment: "c-pass" },
  wontfix: { glyph: "s-muted", label: "Won't fix", segment: "c-muted" },
};

/** The six lifecycle steps; side statuses (deferred, cancelled, superseded) sit outside them. */
export const LIFECYCLE: FeatureStatus[] = [
  "idea",
  "draft",
  "approved",
  "in-progress",
  "verifying",
  "done",
];
export const PARKED: FeatureStatus[] = ["deferred", "cancelled", "superseded"];
