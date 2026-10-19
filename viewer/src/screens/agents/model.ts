import type { Index, LiveSession, LiveWait } from "../../../../src/core/types";
import type { AgentRow } from "../../data/agents";

export type AgentsFilter = "active" | "running" | "waiting" | "finished";

export interface AgentGroups {
  /** Sessions with status running, in index.live order. */
  running: LiveSession[];
  /** Sessions with status waiting, in index.live order. */
  waiting: LiveSession[];
  /** Done sessions whose sessionEnd is on the local day of `now`, latest end first. */
  finished: LiveSession[];
}

export interface StatusCount {
  sessions: number;
  subagents: number;
}

export interface Editor {
  /** AgentRow.key. */
  key: string;
  /** shortLabel(session), then " <name>" for a subagent: "…1201", "…1202 code-reviewer". */
  label: string;
  href: string;
}

export interface EditedFile {
  path: string;
  /** Distinct agents, in index.live order, main agent before its subagents. */
  editors: Editor[];
}

export interface Overlap {
  path: string;
  /** Sorted by ID. */
  features: [string, string];
}

export interface WaitingAgent {
  session: LiveSession;
  row: AgentRow;
  wait: LiveWait;
}

export function agentGroups(_live: LiveSession[], _now: number): AgentGroups {
  return { running: [], waiting: [], finished: [] };
}

/** active = running + waiting sessions; the others count their group. */
export function filterCounts(_groups: AgentGroups): Record<AgentsFilter, number> {
  return { active: 0, running: 0, waiting: 0, finished: 0 };
}

/** active: every group; running, waiting, finished: that group only (the others empty). */
export function shownGroups(_groups: AgentGroups, _filter: AgentsFilter): AgentGroups {
  return { running: [], waiting: [], finished: [] };
}

/** Sessions that aren't done and the number of their subagents (all statuses). */
export function headerCounts(_live: LiveSession[]): StatusCount {
  return { sessions: 0, subagents: 0 };
}

/**
 * running/waiting: sessions and subagents (in any session) with that status; doneToday: the
 * finished group and subagents that are done with ended_at on the local day of `now`.
 */
export function rightNow(
  _live: LiveSession[],
  _now: number,
): { running: StatusCount; waiting: StatusCount; doneToday: StatusCount } {
  return {
    running: { sessions: 0, subagents: 0 },
    waiting: { sessions: 0, subagents: 0 },
    doneToday: { sessions: 0, subagents: 0 },
  };
}

/** "2 sessions · 2 subagents", "1 session", "3 subagents"; "None" when both are 0. */
export function countLine(_count: StatusCount): string {
  return "";
}

/**
 * Files in the edits of agents that aren't done, first seen first, each with its editors;
 * conflicts: those with two or more editors whose path matches no `sharedFiles` glob.
 */
export function editedFiles(
  _live: LiveSession[],
  _sharedFiles: string[],
): { files: EditedFile[]; conflicts: EditedFile[] } {
  return { files: [], conflicts: [] };
}

/** Pairs of derived.file_conflicts whose features are both in flight in a session that isn't done, sorted by path then features. */
export function plannedOverlaps(_index: Index): Overlap[] {
  return [];
}

/** Open permission waits of every agent of every session that isn't done, oldest first. */
export function needsYou(_live: LiveSession[]): WaitingAgent[] {
  return [];
}

/** "<goal or No goal recorded>[ · N subagents][ · left a handoff]" (handoff: the SES's non-blank handoff). */
export function finishedSummary(_index: Index, _session: LiveSession): string {
  return "";
}

/** Chips and title for "Working on": features (else [feature]), task, and the task's title, else the only feature's title. */
export function workingOn(
  _index: Index,
  _session: Pick<LiveSession, "features" | "feature" | "task">,
): { features: string[]; task: string | null; title: string | null } {
  return { features: [], task: null, title: null };
}
