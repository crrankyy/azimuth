import type {
  AgentStatus,
  LiveAgent,
  LiveEdit,
  LiveEvent,
  LiveSession,
  LiveWait,
  LiveWaitSpan,
} from "../../../src/core/types";
import { href } from "../lib/router";

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
export function agentRows(session: LiveSession): AgentRow[] {
  const { main, claude_session } = session;
  const mainRow: AgentRow = {
    key: claude_session,
    claude_session,
    agent_id: null,
    name: "Main session",
    description: session.goal,
    status: main.status,
    waiting: main.waiting,
    current: main.current,
    started_at: main.started_at,
    ended_at: main.ended_at,
    last_seen_at: session.last_seen_at,
    edits: main.edits,
    waits: main.waits,
    task: session.task,
    feature: session.feature,
    transcript: main.transcript,
    href: href("agents", claude_session),
  };
  return [mainRow, ...session.agents.map((a) => subagentRow(claude_session, a))];
}

function subagentRow(claudeSession: string, agent: LiveAgent): AgentRow {
  return {
    key: `${claudeSession}/${agent.agent_id}`,
    claude_session: claudeSession,
    agent_id: agent.agent_id,
    name: agent.agent_type ?? "subagent",
    description: agent.description,
    status: agent.status,
    waiting: agent.waiting,
    current: agent.current,
    started_at: agent.started_at,
    ended_at: agent.ended_at,
    last_seen_at: agent.last_seen_at,
    edits: agent.edits,
    waits: agent.waits,
    task: agent.task,
    feature: agent.feature,
    transcript: agent.transcript,
    href: href("agents", claudeSession, agent.agent_id),
  };
}

/** Sessions whose status isn't "done", in the given order. */
export function activeSessions(live: LiveSession[]): LiveSession[] {
  return live.filter((s) => s.status !== "done");
}

/** The SES ID, else the Claude Code session ID's first 8 characters. */
export function sessionLabel(session: LiveSession): string {
  return session.ses ?? session.claude_session.slice(0, 8);
}

/** "…" + the SES ID after "SES-YYYYMMDD-" ("…1201"), else sessionLabel. */
export function shortLabel(session: LiveSession): string {
  const time = session.ses ? /^SES-\d{8}-(.+)$/.exec(session.ses)?.[1] : undefined;
  return time ? `…${time}` : sessionLabel(session);
}

/** Null unless the session is done; then main.ended_at ?? ended_at ?? last_seen_at. */
export function sessionEnd(session: LiveSession): string | null {
  if (session.status !== "done") return null;
  return session.main.ended_at ?? session.ended_at ?? session.last_seen_at;
}

/** Milliseconds from started_at to ended_at, or to `now` while it hasn't ended. */
export function agentDuration(row: Pick<AgentRow, "started_at" | "ended_at">, now: number): number {
  const end = row.ended_at ? Date.parse(row.ended_at) : now;
  return end - Date.parse(row.started_at);
}

/** A wait that isn't the idle main agent's (reason !== IDLE_REASON); false for null. */
export function isPermissionWait(wait: LiveWait | null): boolean {
  return wait !== null && wait.reason !== IDLE_REASON;
}

/** "<tool> <file>" when the event has a file, else its summary. */
export function actionLabel(event: LiveEvent): string {
  return event.file ? `${event.tool} ${event.file}` : event.summary;
}
