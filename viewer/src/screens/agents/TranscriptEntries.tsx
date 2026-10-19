import { useState } from "react";
import type {
  LiveAgent,
  LiveSession,
  TranscriptEntry,
  TranscriptText,
} from "../../../../src/core/types";
import { OutputTail } from "../../components/CodeBlock";
import { AgentStatusMark, StatusGlyph } from "../../components/Status";
import { agentDuration } from "../../data/agents";
import { clockSeconds, elapsed, liveAgo } from "../../lib/format";
import { Prose } from "../../lib/markdown";
import { href } from "../../lib/router";
import { AGENT_LOOK } from "../../lib/status";
import { diffLineClass, startsOpen, type NowLine } from "./transcript";

type ToolEntry = Extract<TranscriptEntry, { kind: "tool" }>;
type SpawnEntry = Extract<TranscriptEntry, { kind: "spawn" }>;

/** Output lines, with "…" where the server cut more than its cap (`at` the start for tails). */
function capped(text: TranscriptText, at: "start" | "end"): string[] {
  if (!text.truncated) return text.lines;
  return at === "start" ? ["…", ...text.lines] : [...text.lines, "…"];
}

function Time({ at }: { at: string | null }) {
  return <span className="az-mono tr-time">{clockSeconds(at)}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d={open ? "M2 3.5L5 6.5L8 3.5" : "M3.5 2L6.5 5L3.5 8"} />
    </svg>
  );
}

function Message({ entry }: { entry: Extract<TranscriptEntry, { kind: "message" }> }) {
  return (
    <li className={`tr-entry tr-message ${entry.role}`}>
      <Time at={entry.at} />
      <div className="tr-msg">
        {entry.role === "assistant" && (
          <span className="tr-avatar" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 20 20">
              <path d="M10 2 L13 10 L10 18 L7 10 Z" />
            </svg>
          </span>
        )}
        <Prose text={entry.text} className="tr-msg-text" />
      </div>
    </li>
  );
}

function CallStatus({ entry, now }: { entry: ToolEntry; now: number }) {
  if (entry.status === "running")
    return (
      <span className="tr-running">
        running {entry.at ? elapsed(now - Date.parse(entry.at)) : ""}
      </span>
    );
  return entry.status === "ok" ? (
    <StatusGlyph glyph="s-done" label="Succeeded" />
  ) : (
    <StatusGlyph glyph="s-failing" label="Failed" />
  );
}

function Diff({ diff }: { diff: NonNullable<ToolEntry["diff"]> }) {
  return (
    <pre className="az-code tr-diff">
      {capped(diff, "end").map((line, i) => {
        const cls = diffLineClass(line);
        return (
          <span key={i} className={cls ? `diff-${cls}` : undefined}>
            {line}
          </span>
        );
      })}
    </pre>
  );
}

function ToolRow({
  entry,
  now,
  open,
  onToggle,
}: {
  entry: ToolEntry;
  now: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="tr-entry tr-tool">
      <Time at={entry.at} />
      <div className={`tr-call ${open ? "open" : ""}`.trim()}>
        <button
          type="button"
          className="tr-call-head"
          aria-expanded={open}
          // The design's rows show the command only; its description is there on hover.
          title={entry.summary ?? undefined}
          onClick={onToggle}
        >
          <Chevron open={open} />
          <span className="az-mono tr-tool-name">{entry.name}</span>
          <span className="az-mono tr-target">{entry.target}</span>
          {entry.diff && (
            <span className="az-mono tr-sizes">
              <span className="add">+{entry.diff.added}</span>{" "}
              <span className="del">−{entry.diff.removed}</span>
            </span>
          )}
          <span className="spacer" />
          <CallStatus entry={entry} now={now} />
        </button>
        {open && entry.diff && <Diff diff={entry.diff} />}
        {open && entry.output && <OutputTail text={capped(entry.output, "start").join("\n")} />}
      </div>
    </li>
  );
}

/** The live subagent's status and duration when known, else the call's own status. */
function SpawnStatus({
  entry,
  agent,
  now,
}: {
  entry: SpawnEntry;
  agent: LiveAgent | undefined;
  now: number;
}) {
  if (agent)
    return (
      <span className={`tr-spawn-status ${agent.status}`}>
        <AgentStatusMark status={agent.status} /> · {elapsed(agentDuration(agent, now))}
      </span>
    );
  if (entry.status === "error")
    return (
      <span className="tr-spawn-status failed">
        <StatusGlyph glyph="s-failing" />
        Failed
      </span>
    );
  const status = entry.status === "running" ? "running" : "done";
  return (
    <span className={`tr-spawn-status ${status}`}>
      <AgentStatusMark status={status} />
    </span>
  );
}

function SpawnCard({
  session,
  entry,
  now,
}: {
  session: LiveSession;
  entry: SpawnEntry;
  now: number;
}) {
  const agent = session.agents.find((a) => a.agent_id === entry.agent_id);
  const current = agent && agent.status !== "done" ? agent.current : null;
  const running = (agent?.status ?? entry.status) === "running";
  return (
    <li className="tr-entry tr-spawn-entry">
      <Time at={entry.at} />
      <div className={`tr-spawn ${running ? "running" : ""}`.trim()}>
        <div className="tr-spawn-head">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 2v6a3 3 0 0 0 3 3h7M10 8l3 3-3 3" />
          </svg>
          <span className="tr-spawn-label">Spawned subagent</span>
          <span className="az-mono tr-spawn-type">{entry.agent_type ?? "subagent"}</span>
          <span className="spacer" />
          <SpawnStatus entry={entry} agent={agent} now={now} />
        </div>
        <div className="tr-spawn-desc">{entry.description}</div>
        {current && (
          <div className="tr-spawn-now">
            <span className="az-mono tr-tool-name">{current.tool}</span>
            <span className="az-mono tr-target">{current.file ?? current.summary}</span>
            <span className="spacer" />
            <span className="tr-ago">{liveAgo(current.at, now)}</span>
          </div>
        )}
        {entry.output && (
          <div className="tr-spawn-out">{capped(entry.output, "end").join("\n")}</div>
        )}
        {entry.agent_id && (
          <a
            className="tr-spawn-link"
            href={href("agents", session.claude_session, entry.agent_id)}
          >
            Open its transcript →
          </a>
        )}
      </div>
    </li>
  );
}

function Now({ line }: { line: NowLine }) {
  return (
    <li className="tr-entry tr-now">
      <span className="az-mono tr-time">now</span>
      <div className={`tr-now-text ${line.status}`}>
        <span className={AGENT_LOOK[line.status].mark} aria-hidden="true" />
        {line.text}
      </div>
    </li>
  );
}

const callId = (entry: TranscriptEntry) => ("tool_use_id" in entry ? entry.tool_use_id : null);

/**
 * Timestamped messages, tool rows (open by default with a diff or when not ok, all open with
 * showAll; a click toggles one), subagent cards and the now line.
 */
export function TranscriptEntries({
  session,
  entries,
  now,
  showAll,
  nowLine,
}: {
  session: LiveSession;
  entries: TranscriptEntry[];
  now: number;
  showAll: boolean;
  nowLine: NowLine | null;
}) {
  // Clicks override the default per row until "Show all tool output" changes.
  const [toggled, setToggled] = useState({ showAll, open: {} as Record<string, boolean> });
  const overrides = toggled.showAll === showAll ? toggled.open : {};
  const isOpen = (entry: ToolEntry) =>
    overrides[entry.tool_use_id] ?? (showAll || startsOpen(entry));
  const toggle = (entry: ToolEntry) =>
    setToggled({ showAll, open: { ...overrides, [entry.tool_use_id]: !isOpen(entry) } });

  return (
    <ol className="tr-entries" aria-label="Transcript">
      {entries.map((entry, i) => {
        const key = callId(entry) ?? `m${i}`;
        if (entry.kind === "message") return <Message key={key} entry={entry} />;
        if (entry.kind === "tool")
          return (
            <ToolRow
              key={key}
              entry={entry}
              now={now}
              open={isOpen(entry)}
              onToggle={() => toggle(entry)}
            />
          );
        if (entry.kind === "spawn")
          return <SpawnCard key={key} session={session} entry={entry} now={now} />;
        // applyTranscript folds results into their calls; one never reaches the list.
        return null;
      })}
      {nowLine && <Now line={nowLine} />}
    </ol>
  );
}
