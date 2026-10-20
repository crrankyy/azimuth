import type { ReactNode } from "react";
import type { LiveSession } from "../../../../src/core/types";
import { AgentStatusMark } from "../../components/Status";
import { actionLabel } from "../../data/agents";
import { elapsed, plural } from "../../lib/format";
import { href } from "../../lib/router";
import { shortSessionId, type ActivityData, type ActivitySession } from "./sessions";
import "./live-cards.css";

/** Activity sessions whose status is running or waiting: running first, each group oldest first. */
export function liveCards(data: ActivityData): ActivitySession[] {
  // data.sessions is already oldest first.
  const withStatus = (status: ActivitySession["status"]) =>
    data.sessions.filter((s) => s.status === status && s.live);
  return [...withStatus("running"), ...withStatus("waiting")];
}

/** The card grid; renders nothing for an empty list. Each card links to "#/agents/<claude-session>" and has id "ses-<SES>" when it has a SES. */
export function LiveCards({
  sessions,
  now,
}: {
  sessions: ActivitySession[];
  now: number;
}): ReactNode {
  if (sessions.length === 0) return null;
  return (
    <div className="live-cards">
      {sessions.map((s) => s.live && <LiveCard key={s.key} session={s} live={s.live} now={now} />)}
    </div>
  );
}

/** "F-005 · T-005.4 · 2 subagents": the live features (else `feature`), the task and the subagents. */
function facts(live: LiveSession): string {
  const features = live.features.length > 0 ? live.features : [live.feature];
  const subagents = live.agents.length > 0 ? plural(live.agents.length, "subagent") : null;
  return [...features, live.task, subagents].filter(Boolean).join(" · ");
}

/** The session's latest action, prefixed with the subagent's type when a subagent made it. */
function latestAction(live: LiveSession): string | null {
  const { current } = live;
  if (!current) return null;
  if (!current.agent_id) return actionLabel(current);
  const agent = live.agents.find((a) => a.agent_id === current.agent_id);
  return `${agent?.agent_type ?? "subagent"}: ${actionLabel(current)}`;
}

/** A running or waiting session: status, how long, goal, work, and its latest action or wait. */
function LiveCard({
  session: s,
  live,
  now,
}: {
  session: ActivitySession;
  live: LiveSession;
  now: number;
}) {
  const waiting = live.status === "waiting" ? live.waiting : null;
  // A waiting card counts from when the wait began, a running one from the session's start.
  const since = Date.parse(waiting?.since ?? s.start);
  const work = facts(live);
  const action = waiting ? null : latestAction(live);
  return (
    <a
      className={`az-card live-card s-${live.status}`}
      id={s.ses ? `ses-${s.ses}` : undefined}
      href={href("agents", live.claude_session)}
    >
      <span className="live-card-head">
        <AgentStatusMark status={live.status} />
        <span className="live-card-id az-mono" title={s.key}>
          {shortSessionId(s)}
        </span>
        <span className="live-card-time">{elapsed(now - since)}</span>
      </span>
      <span className={s.goal ? "live-card-goal" : "live-card-goal none"}>
        {s.goal ?? "No goal recorded"}
      </span>
      {work && <span className="live-card-facts">{work}</span>}
      {waiting && <span className="live-card-wait">{waiting.reason}</span>}
      {action && <span className="live-card-action az-mono">{`▸ ${action}`}</span>}
    </a>
  );
}
