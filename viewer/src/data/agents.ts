import type {
  AgentStatus,
  LiveEdit,
  LiveEvent,
  LiveSession,
  LiveWait,
  LiveWaitSpan,
} from "../../../src/core/types";

/** One agent of a live session (its main agent or a subagent), flattened for lists and timelines. */
export interface AgentRow {
  /** "<claude_session>" for the main agent, "<claude_session>/<agent_id>" for a subagent. */
  key: string;
  claude_session: string;
  /** Null for the main agent. */
  agent_id: string | null;
  /** "Main session" for the main agent; else the subagent's agent_type, else "subagent". */
  name: string;
  /** The session's goal for the main agent; the subagent's description otherwise. */
  description: string | null;
  status: AgentStatus;
  waiting: LiveWait | null;
  current: LiveEvent | null;
  started_at: string;
  ended_at: string | null;
  last_seen_at: string;
  edits: LiveEdit[];
  waits: LiveWaitSpan[];
  /** The session's task and feature for the main agent; the subagent's own otherwise. */
  task: string | null;
  feature: string | null;
  transcript: boolean;
  /** href("agents", claude_session) or href("agents", claude_session, agent_id). */
  href: string;
}

/** F-014's IDLE_REASON, kept here because src/core/live-agents.ts isn't import-safe for the viewer. */
export const IDLE_REASON = "Waiting for your next prompt";

/** The main agent's row (from session.main), then one per subagent in `agents` order. */
export function agentRows(_session: LiveSession): AgentRow[] {
  return [];
}

/** Sessions whose status isn't "done", in the given order. */
export function activeSessions(_live: LiveSession[]): LiveSession[] {
  return [];
}

/** The SES ID, else the Claude Code session ID's first 8 characters. */
export function sessionLabel(_session: LiveSession): string {
  return "";
}

/** "…" + the SES ID after "SES-YYYYMMDD-" ("…1201"), else sessionLabel. */
export function shortLabel(_session: LiveSession): string {
  return "";
}

/** Null unless the session is done; then main.ended_at ?? ended_at ?? last_seen_at. */
export function sessionEnd(_session: LiveSession): string | null {
  return null;
}

/** Milliseconds from started_at to ended_at, or to `now` while it hasn't ended. */
export function agentDuration(
  _row: Pick<AgentRow, "started_at" | "ended_at">,
  _now: number,
): number {
  return 0;
}

/** A wait that isn't the idle main agent's (reason !== IDLE_REASON); false for null. */
export function isPermissionWait(_wait: LiveWait | null): boolean {
  return false;
}

/** "<tool> <file>" when the event has a file, else its summary. */
export function actionLabel(_event: LiveEvent): string {
  return "";
}
