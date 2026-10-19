import type { Index, LiveSession, TranscriptEntry } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { Eyebrow } from "../../components/primitives";
import { AgentStatusMark, StatusGlyph } from "../../components/Status";
import { agentDuration, agentRows, type AgentRow } from "../../data/agents";
import { scenarioById, taskById } from "../../data/selectors";
import { elapsed } from "../../lib/format";
import { AGENT_LOOK, COVERAGE_LOOK } from "../../lib/status";
import { touchedFiles } from "./transcript";

function AgentLink({
  row,
  shown,
  meta,
  twig = false,
}: {
  row: AgentRow;
  shown: boolean;
  meta: string;
  twig?: boolean;
}) {
  return (
    <a
      className={`tr-agent${twig ? " az-twig" : ""}${shown ? " shown" : ""}`}
      href={row.href}
      aria-current={shown ? "page" : undefined}
    >
      <AgentStatusMark status={row.status} hideLabel />
      <span className={row.agent_id ? "az-mono tr-agent-name" : "tr-agent-name"}>{row.name}</span>
      <span className="spacer" />
      <span className={`tr-agent-meta ${row.status}`}>{meta}</span>
    </a>
  );
}

/** The main agent with its duration, then its subagents with their status as a tree. */
function Agents({
  session,
  agentId,
  now,
}: {
  session: LiveSession;
  agentId: string | null;
  now: number;
}) {
  const [main, ...subagents] = agentRows(session);
  if (!main) return null;
  return (
    <section className="tr-group">
      <Eyebrow>Agents in this session</Eyebrow>
      <div className="az-tree tr-agents">
        <AgentLink row={main} shown={agentId === null} meta={elapsed(agentDuration(main, now))} />
        {subagents.length > 0 && (
          <div className="az-tree tr-subagents">
            {subagents.map((row) => (
              <AgentLink
                key={row.key}
                row={row}
                shown={row.agent_id === agentId}
                meta={AGENT_LOOK[row.status].short}
                twig
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** The scenarios the shown agent's task (else the session's) covers, with their coverage. */
function Covers({ index, task }: { index: Index; task: string | null }) {
  const covers = task ? (taskById(index, task)?.task.covers ?? []) : [];
  return (
    <section className="tr-group">
      <Eyebrow>Covers</Eyebrow>
      {task ? (
        <div className="tr-covers">
          {covers.map((id) => {
            const status = scenarioById(index, id)?.scenario.coverage.status;
            const look = status ? COVERAGE_LOOK[status] : null;
            return (
              <span key={id} className="tr-cover">
                {look && <StatusGlyph glyph={look.glyph} />}
                <IdChip id={id} />
                {look && <span className="muted">{look.label}</span>}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="muted">No task named</span>
      )}
    </section>
  );
}

function Files({ entries }: { entries: TranscriptEntry[] }) {
  const files = touchedFiles(entries);
  return (
    <section className="tr-group">
      <Eyebrow>Files</Eyebrow>
      {files.length > 0 ? (
        <div className="tr-files">
          {files.map((f) => (
            <span key={f.path} className={`tr-file ${f.how}`}>
              <span className="tr-how">{f.how}</span>
              <span className="az-mono tr-path">{f.path}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="muted">None yet</span>
      )}
    </section>
  );
}

function Commits({ index, ses }: { index: Index; ses: string | null }) {
  const commits = ses
    ? index.commits.filter((c) => c.session === ses).sort((a, b) => b.at.localeCompare(a.at))
    : [];
  return (
    <section className="tr-group">
      <Eyebrow>Commits</Eyebrow>
      {commits.length > 0 ? (
        <div className="tr-commits">
          {commits.map((c) => (
            <span key={c.sha} className="tr-commit">
              <span className="az-mono tr-sha">{c.sha}</span>
              <span className="tr-subject">{c.subject}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="muted">None yet in this session</span>
      )}
    </section>
  );
}

/** Agents in this session, Covers, Files (from the loaded entries) and Commits. */
export function TranscriptAside({
  index,
  session,
  agentId,
  entries,
  now,
}: {
  index: Index;
  session: LiveSession;
  agentId: string | null;
  entries: TranscriptEntry[];
  now: number;
}) {
  const agent = agentId ? session.agents.find((a) => a.agent_id === agentId) : undefined;
  return (
    <aside className="tr-aside" aria-label="Session details">
      <Agents session={session} agentId={agentId} now={now} />
      <Covers index={index} task={agent?.task ?? session.task} />
      <Files entries={entries} />
      <Commits index={index} ses={session.ses} />
    </aside>
  );
}
