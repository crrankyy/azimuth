import { useEffect, useState } from "react";
import type { Index, LiveSession } from "../../../../src/core/types";
import { Hint, Page } from "../../components/AppShell";
import { copyText } from "../../components/CodeBlock";
import { IdChip } from "../../components/IdChip";
import { Button, EmptyState, Tag } from "../../components/primitives";
import { AgentStatusMark } from "../../components/Status";
import { agentDuration, agentRows, sessionLabel, type AgentRow } from "../../data/agents";
import { pageToken, useIndexState, type Connection } from "../../data/IndexProvider";
import { useTranscript, type TranscriptState } from "../../data/transcript";
import { clockSeconds, elapsed, plural } from "../../lib/format";
import { useScreenKeys } from "../../lib/keys";
import { href, navigate } from "../../lib/router";
import { AGENT_LOOK } from "../../lib/status";
import { workingOn } from "./model";
import { nowLine, stepAgent, toolCalls, TRANSCRIPT_KEYS, type TranscriptKey } from "./transcript";
import { TranscriptAside } from "./TranscriptAside";
import { TranscriptEntries } from "./TranscriptEntries";
import "./transcript.css";

export interface AgentTranscriptProps {
  index: Index;
  session: LiveSession;
  /** Null: the main agent's tab. */
  agentId: string | null;
  transcript: TranscriptState;
  now: number;
  /** "Following live": keep the newest entry in view. */
  follow: boolean;
  onFollow: (on: boolean) => void;
  /** "Show all tool output". */
  showAll: boolean;
  onShowAll: (on: boolean) => void;
}

const LIVE_ONLY = "Transcripts are only available in the live viewer";
const SNAPSHOT = {
  title: LIVE_ONLY,
  body: "This is a read-only snapshot. Run azimuth view to follow agents live.",
};

/** Why there is no transcript to show, checked in feature.md's order; null when there is one. */
function emptyState(
  connection: Connection,
  claudeSession: string,
  agentId: string | null,
  session: LiveSession | undefined,
  row: AgentRow | undefined,
  token: string | null,
): { title: string; body: string | null } | null {
  if (connection === "export") return SNAPSHOT;
  if (!session) return { title: `No live session ${claudeSession}`, body: null };
  if (!row) return { title: `No subagent ${agentId} in this session`, body: null };
  if (!row.transcript)
    return { title: LIVE_ONLY, body: "No transcript was recorded for this agent." };
  // The Vite dev server serves no token, so it can't ask for transcripts either.
  if (!token) return SNAPSHOT;
  return null;
}

/** Empty states (feature.md order), then AgentTranscript with useTranscript, keys and local follow/showAll state. */
export function AgentTranscriptScreen({
  claudeSession,
  agentId,
}: {
  claudeSession: string;
  agentId: string | null;
}) {
  const { index, connection, now } = useIndexState();
  const session = index?.live.find((s) => s.claude_session === claudeSession);
  const rows = session ? agentRows(session) : [];
  const row = rows.find((r) => r.agent_id === agentId);
  const empty = emptyState(connection, claudeSession, agentId, session, row, pageToken());
  const transcript = useTranscript(claudeSession, agentId, empty === null);
  // Both stay as they are while you switch tabs: the screen stays mounted across its routes.
  const [follow, setFollow] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const step = (delta: -1 | 1) => {
    const to = stepAgent(rows, agentId, delta);
    if (to) navigate(to.href);
  };
  const actions: Record<TranscriptKey, () => void> = {
    prev: () => step(-1),
    next: () => step(1),
    follow: () => setFollow((on) => !on),
    back: () => navigate(href("agents")),
  };
  useScreenKeys(
    Object.fromEntries(
      Object.entries(TRANSCRIPT_KEYS).map(([key, action]) => [key, actions[action]]),
    ),
  );

  useEffect(() => {
    if (!follow) return;
    document.querySelector(".tr-entries > li:last-child")?.scrollIntoView({ block: "end" });
  }, [follow, transcript.entries]);

  const crumbs = [
    { label: "Agents", href: href("agents") },
    { label: <span className="az-mono">{session ? sessionLabel(session) : claudeSession}</span> },
  ];
  const hints = (
    <span className="tr-hints">
      <Hint keys={["[", "]"]} label="switch agent" />
      <Hint keys={["f"]} label="follow" />
      <Hint keys={["esc"]} label="back" />
    </span>
  );
  if (!index || !session || empty) {
    return (
      <Page crumbs={crumbs} hints={hints}>
        <EmptyState title={empty?.title ?? `No live session ${claudeSession}`}>
          {empty?.body}
        </EmptyState>
      </Page>
    );
  }
  return (
    <Page crumbs={crumbs} hints={hints}>
      <AgentTranscript
        index={index}
        session={session}
        agentId={agentId}
        transcript={transcript}
        now={now}
        follow={follow}
        onFollow={setFollow}
        showAll={showAll}
        onShowAll={setShowAll}
      />
    </Page>
  );
}

function CopySessionId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const copy = () =>
    copyText(id).then(
      () => {
        setDone(true);
        window.setTimeout(() => setDone(false), 1_500);
      },
      () => undefined,
    );
  return <Button onClick={() => void copy()}>{done ? "Copied" : "Copy session ID"}</Button>;
}

function Header({
  index,
  session,
  calls,
  now,
  follow,
  onFollow,
}: {
  index: Index;
  session: LiveSession;
  calls: number;
  now: number;
  follow: boolean;
  onFollow: (on: boolean) => void;
}) {
  const work = workingOn(index, session);
  const started = session.main.started_at;
  const duration = agentDuration({ started_at: started, ended_at: session.main.ended_at }, now);
  return (
    <header className="tr-head">
      <div className="tr-head-main">
        <div className="tr-meta">
          <span className="tr-status">
            <AgentStatusMark status={session.status} />
          </span>
          {session.ses && <span className="az-mono tr-ses">{session.ses}</span>}
          <span className="az-mono tr-cc" title={session.claude_session}>
            {session.claude_session.slice(0, 8)}
          </span>
          {session.skill && <Tag>{session.skill}</Tag>}
          <span>
            started {clockSeconds(started)} · {elapsed(duration)} · {plural(calls, "tool call")}
          </span>
        </div>
        <h1 className="tr-title">{session.goal ?? "No goal recorded"}</h1>
        {(work.features.length > 0 || work.task) && (
          <div className="tr-working">
            Working on
            {work.features.map((id) => (
              <IdChip key={id} id={id} />
            ))}
            {work.task && <IdChip id={work.task} />}
            {work.title && <span>{work.title}</span>}
          </div>
        )}
      </div>
      <div className="tr-head-tools">
        <button
          type="button"
          className="tr-follow"
          aria-pressed={follow}
          onClick={() => onFollow(!follow)}
        >
          {follow && <span className="az-live" />}
          {follow ? "Following live" : "Follow live"}
        </button>
        <CopySessionId id={session.claude_session} />
      </div>
    </header>
  );
}

function AgentTab({ row, shown, now }: { row: AgentRow; shown: boolean; now: number }) {
  // A running subagent shows how long it has run; the others their status.
  const meta =
    row.agent_id === null
      ? null
      : row.status === "running"
        ? elapsed(agentDuration(row, now))
        : AGENT_LOOK[row.status].short;
  return (
    <a role="tab" className="az-tab" aria-selected={shown} href={row.href}>
      <AgentStatusMark status={row.status} hideLabel />
      <span className={row.agent_id ? "az-mono tr-tab-name" : undefined}>{row.name}</span>
      {meta && <span className="n">{meta}</span>}
    </a>
  );
}

function AgentTabs({
  rows,
  agentId,
  now,
  showAll,
  onShowAll,
}: {
  rows: AgentRow[];
  agentId: string | null;
  now: number;
  showAll: boolean;
  onShowAll: (on: boolean) => void;
}) {
  const [main, ...subagents] = rows;
  return (
    <div className="az-tabs tr-tabs">
      <div className="tr-tablist" role="tablist" aria-label="Agents in this session">
        {main && <AgentTab row={main} shown={agentId === null} now={now} />}
        {subagents.length > 0 && (
          <span className="tr-branch" aria-hidden="true">
            └
          </span>
        )}
        {subagents.map((row) => (
          <AgentTab key={row.key} row={row} shown={row.agent_id === agentId} now={now} />
        ))}
      </div>
      <span className="spacer" />
      <button
        type="button"
        className="tr-show-all"
        aria-pressed={showAll}
        onClick={() => onShowAll(!showAll)}
      >
        Show <span className="tr-show-all-link">all tool output</span>
      </button>
    </div>
  );
}

function FollowPill({ follow, onFollow }: { follow: boolean; onFollow: (on: boolean) => void }) {
  return (
    <div className={`tr-pill${follow ? "" : " paused"}`} role="status">
      {follow && <span className="az-live" />}
      {follow ? "Live · new output appears at the bottom" : "Paused"}
      <button type="button" onClick={() => onFollow(!follow)}>
        {follow ? "Pause" : "Resume"}
      </button>
    </div>
  );
}

/** One agent's live transcript: header, agent tabs, entries and the side panel. */
export function AgentTranscript({
  index,
  session,
  agentId,
  transcript,
  now,
  follow,
  onFollow,
  showAll,
  onShowAll,
}: AgentTranscriptProps) {
  const rows = agentRows(session);
  const row = rows.find((r) => r.agent_id === agentId);
  const { entries, error } = transcript;
  return (
    <div className="tr">
      <Header
        index={index}
        session={session}
        calls={toolCalls(entries)}
        now={now}
        follow={follow}
        onFollow={onFollow}
      />
      <AgentTabs rows={rows} agentId={agentId} now={now} showAll={showAll} onShowAll={onShowAll} />
      {error !== null && (
        <div className="tr-alert" role="alert">
          Couldn't load the transcript: {error}
        </div>
      )}
      <div className="tr-body">
        <div className="tr-main">
          {transcript.skipped && (
            <p className="tr-note">
              Earlier entries aren't shown: this view starts in the transcript's last 512 KiB.
            </p>
          )}
          {transcript.next === null && error === null && (
            <p className="tr-note">Loading the transcript…</p>
          )}
          <TranscriptEntries
            session={session}
            entries={entries}
            now={now}
            showAll={showAll}
            nowLine={row ? nowLine(row, entries) : null}
          />
        </div>
        <TranscriptAside
          index={index}
          session={session}
          agentId={agentId}
          entries={entries}
          now={now}
        />
      </div>
      <FollowPill follow={follow} onFollow={onFollow} />
    </div>
  );
}
