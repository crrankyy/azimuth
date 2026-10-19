import type { Index, LiveEvent, LiveSession } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { Tag } from "../../components/primitives";
import { AgentStatusMark } from "../../components/Status";
import {
  actionLabel,
  agentDuration,
  agentRows,
  sessionEnd,
  sessionLabel,
  type AgentRow,
} from "../../data/agents";
import { clock, elapsed, liveAgo } from "../../lib/format";
import { href } from "../../lib/router";
import { finishedSummary, treeOrder, workingOn } from "./model";

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" />
    </svg>
  );
}

/** "▸ Edit src/retry/policy.ts +4 −1 · 48s ago": the agent's latest tool event. */
function Action({ event, now }: { event: LiveEvent; now: number }) {
  return (
    <div className="agent-action az-mono">
      <span className="agent-action-mark">▸</span>
      {actionLabel(event)}
      {event.added !== null && event.removed !== null && (
        <>
          <span className="diff-add">{`+${event.added}`}</span>
          <span className="diff-del">{`−${event.removed}`}</span>
        </>
      )}
      {event.error && <span className="agent-failed">failed</span>}
      <span className="agent-age">{`· ${liveAgo(event.at, now)}`}</span>
    </div>
  );
}

/** A subagent in its session's tree: status, type, what it was asked, what it's doing, how long. */
function SubagentRow({ row, now }: { row: AgentRow; now: number }) {
  const waiting = row.status === "waiting" && row.waiting;
  return (
    <a className={`az-twig agent-twig ${row.status}`} href={row.href}>
      <AgentStatusMark status={row.status} />
      <span className="agent-twig-name az-mono">{row.name}</span>
      <span className="agent-twig-text">
        {row.description && <span className="agent-twig-desc">{row.description}</span>}
        {waiting ? (
          <span className="agent-twig-wait">{waiting.reason}</span>
        ) : (
          row.current && (
            <span className="agent-twig-action az-mono">{`▸ ${actionLabel(row.current)}`}</span>
          )
        )}
      </span>
      <span className="agent-twig-time">{elapsed(agentDuration(row, now))}</span>
      <Chevron />
    </a>
  );
}

/** A running or waiting session: its status, goal, work, latest action or wait, and subagents. */
export function AgentCard({
  index,
  session,
  now,
  selected,
}: {
  index: Index;
  session: LiveSession;
  now: number;
  selected: boolean;
}) {
  const [main, ...rest] = agentRows(session);
  const subagents = treeOrder(rest);
  const work = workingOn(index, session);
  const waiting = session.status === "waiting" && session.waiting;
  const classes = ["az-card", "agent-card", session.status, selected ? "az-focus" : ""];
  return (
    <article
      className={classes.join(" ").trim()}
      aria-label={sessionLabel(session)}
      data-agent={session.claude_session}
    >
      {/* The head isn't a link: its ID chips are links of their own. */}
      <div className="agent-card-head">
        <AgentStatusMark status={session.status} />
        <div className="agent-card-body">
          <div className="agent-meta">
            <span className="az-mono agent-id">{sessionLabel(session)}</span>
            {session.skill && <Tag>{session.skill}</Tag>}
            {main && (
              <span>{`started ${clock(main.started_at)} · ${elapsed(agentDuration(main, now))}`}</span>
            )}
          </div>
          <div className={session.goal ? "agent-goal" : "agent-goal none"}>
            {session.goal ?? "No goal recorded"}
          </div>
          {(work.features.length > 0 || work.task) && (
            <div className="agent-working">
              Working on
              {work.features.map((id) => (
                <IdChip key={id} id={id} />
              ))}
              {work.task && <IdChip id={work.task} />}
              {work.title && <span className="agent-working-title">{work.title}</span>}
            </div>
          )}
          {waiting ? (
            <div className="agent-wait">
              {waiting.reason}
              <span className="agent-age">{`· since ${clock(waiting.since)}`}</span>
            </div>
          ) : (
            main?.current && <Action event={main.current} now={now} />
          )}
        </div>
        <a className="agent-transcript-link" href={href("agents", session.claude_session)}>
          Transcript
          <Chevron />
        </a>
      </div>
      {subagents.length > 0 && (
        <div className="az-tree agent-tree">
          {subagents.map((row) => (
            <SubagentRow key={row.key} row={row} now={now} />
          ))}
        </div>
      )}
    </article>
  );
}

/** Where a finished session's row leads: the session in Activity, else its transcript. */
export function finishedHref(session: LiveSession): string {
  return session.ses ? href("activity", session.ses) : href("agents", session.claude_session);
}

/** A session that finished today, as one compact row. */
export function FinishedRow({
  index,
  session,
  selected,
}: {
  index: Index;
  session: LiveSession;
  selected: boolean;
}) {
  return (
    <a
      className={selected ? "agent-finished az-focus" : "agent-finished"}
      href={finishedHref(session)}
      data-agent={session.claude_session}
    >
      <AgentStatusMark status={session.status} />
      <span className="agent-id az-mono">{sessionLabel(session)}</span>
      <span className="agent-finished-summary">{finishedSummary(index, session)}</span>
      <span className="agent-finished-time">
        {`${clock(session.started_at)}–${clock(sessionEnd(session))}`}
      </span>
    </a>
  );
}
