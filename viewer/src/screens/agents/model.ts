import { globToRegExp, matchesAny } from "../../../../src/core/glob";
import type { AgentStatus, Index, LiveSession, LiveWait } from "../../../../src/core/types";
import {
  activeSessions,
  agentRows,
  isPermissionWait,
  sessionEnd,
  shortLabel,
  type AgentRow,
} from "../../data/agents";
import { featureById, sessionById, taskById } from "../../data/selectors";
import { localDay, plural } from "../../lib/format";

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

export function agentGroups(live: LiveSession[], now: number): AgentGroups {
  const today = localDay(new Date(now).toISOString());
  const finished = live
    .flatMap((session) => {
      const end = sessionEnd(session);
      return end && localDay(end) === today ? [{ session, end: Date.parse(end) }] : [];
    })
    .sort((a, b) => b.end - a.end)
    .map(({ session }) => session);
  return {
    running: live.filter((s) => s.status === "running"),
    waiting: live.filter((s) => s.status === "waiting"),
    finished,
  };
}

/** active = running + waiting sessions; the others count their group. */
export function filterCounts(groups: AgentGroups): Record<AgentsFilter, number> {
  return {
    active: groups.running.length + groups.waiting.length,
    running: groups.running.length,
    waiting: groups.waiting.length,
    finished: groups.finished.length,
  };
}

/** active: every group; running, waiting, finished: that group only (the others empty). */
export function shownGroups(groups: AgentGroups, filter: AgentsFilter): AgentGroups {
  if (filter === "active") return groups;
  return {
    running: filter === "running" ? groups.running : [],
    waiting: filter === "waiting" ? groups.waiting : [],
    finished: filter === "finished" ? groups.finished : [],
  };
}

/** Sessions that aren't done and the number of their subagents (all statuses). */
export function headerCounts(live: LiveSession[]): StatusCount {
  const active = activeSessions(live);
  return { sessions: active.length, subagents: active.reduce((n, s) => n + s.agents.length, 0) };
}

/**
 * running/waiting: sessions and subagents (in any session) with that status; doneToday: the
 * finished group and subagents that are done with ended_at on the local day of `now`.
 */
export function rightNow(
  live: LiveSession[],
  now: number,
): { running: StatusCount; waiting: StatusCount; doneToday: StatusCount } {
  const today = localDay(new Date(now).toISOString());
  const subagents = live.flatMap((s) => s.agents);
  const count = (status: AgentStatus): StatusCount => ({
    sessions: live.filter((s) => s.status === status).length,
    subagents: subagents.filter((a) => a.status === status).length,
  });
  return {
    running: count("running"),
    waiting: count("waiting"),
    doneToday: {
      sessions: agentGroups(live, now).finished.length,
      subagents: subagents.filter(
        (a) => a.status === "done" && a.ended_at !== null && localDay(a.ended_at) === today,
      ).length,
    },
  };
}

/** "2 sessions · 2 subagents", "1 session", "3 subagents"; "None" when both are 0. */
export function countLine(count: StatusCount): string {
  const parts = [
    count.sessions > 0 ? plural(count.sessions, "session") : null,
    count.subagents > 0 ? plural(count.subagents, "subagent") : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

/**
 * Files in the edits of agents that aren't done, first seen first, each with its editors;
 * conflicts: those with two or more editors whose path matches no `sharedFiles` glob.
 */
export function editedFiles(
  live: LiveSession[],
  sharedFiles: string[],
): { files: EditedFile[]; conflicts: EditedFile[] } {
  const byPath = new Map<string, EditedFile>();
  for (const session of live) {
    for (const row of agentRows(session)) {
      if (row.status === "done") continue;
      const editor: Editor = {
        key: row.key,
        label: row.agent_id ? `${shortLabel(session)} ${row.name}` : shortLabel(session),
        href: row.href,
      };
      for (const edit of row.edits) {
        const file = byPath.get(edit.file) ?? { path: edit.file, editors: [] };
        byPath.set(edit.file, file);
        if (!file.editors.some((e) => e.key === editor.key)) file.editors.push(editor);
      }
    }
  }
  const files = [...byPath.values()];
  const shared = sharedFiles.map(globToRegExp);
  const conflicts = files.filter((f) => f.editors.length > 1 && !matchesAny(f.path, shared));
  return { files, conflicts };
}

/** The features a session works on: `features`, else its single `feature`. */
function sessionFeatures(session: Pick<LiveSession, "features" | "feature">): string[] {
  if (session.features.length > 0) return session.features;
  return session.feature ? [session.feature] : [];
}

/** Pairs of derived.file_conflicts whose features are both in flight in a session that isn't done, sorted by path then features. */
export function plannedOverlaps(index: Index): Overlap[] {
  const inFlight = new Set(activeSessions(index.live).flatMap(sessionFeatures));
  const pairs = new Map<string, Overlap>();
  for (const feature of index.features) {
    if (!inFlight.has(feature.id)) continue;
    for (const conflict of feature.derived.file_conflicts) {
      if (!inFlight.has(conflict.with)) continue;
      const features = [feature.id, conflict.with].sort() as [string, string];
      pairs.set(`${conflict.path}\n${features.join("\n")}`, { path: conflict.path, features });
    }
  }
  return [...pairs.values()].sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.features[0].localeCompare(b.features[0]) ||
      a.features[1].localeCompare(b.features[1]),
  );
}

const TREE_RANK: Record<AgentStatus, number> = { running: 0, waiting: 1, done: 2 };

/** A card's subagent rows: running, then waiting, then done, each status in first-seen order. */
export function treeOrder(rows: AgentRow[]): AgentRow[] {
  return [...rows].sort((a, b) => TREE_RANK[a.status] - TREE_RANK[b.status]);
}

/** Open permission waits of every agent of every session that isn't done, oldest first. */
export function needsYou(live: LiveSession[]): WaitingAgent[] {
  return activeSessions(live)
    .flatMap((session) =>
      agentRows(session).flatMap((row) =>
        row.waiting && isPermissionWait(row.waiting) ? [{ session, row, wait: row.waiting }] : [],
      ),
    )
    .sort((a, b) => Date.parse(a.wait.since) - Date.parse(b.wait.since));
}

/** "<goal or No goal recorded>[ · N subagents][ · left a handoff]" (handoff: the SES's non-blank handoff). */
export function finishedSummary(index: Index, session: LiveSession): string {
  const handoff = session.ses ? sessionById(index, session.ses)?.handoff.trim() : "";
  return [
    session.goal ?? "No goal recorded",
    session.agents.length > 0 ? plural(session.agents.length, "subagent") : null,
    handoff ? "left a handoff" : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** Chips and title for "Working on": features (else [feature]), task, and the task's title, else the only feature's title. */
export function workingOn(
  index: Index,
  session: Pick<LiveSession, "features" | "feature" | "task">,
): { features: string[]; task: string | null; title: string | null } {
  const features = sessionFeatures(session);
  const taskTitle = session.task ? taskById(index, session.task)?.task.title : undefined;
  const only = features.length === 1 && features[0] ? featureById(index, features[0]) : undefined;
  return { features, task: session.task, title: taskTitle ?? only?.title ?? null };
}
