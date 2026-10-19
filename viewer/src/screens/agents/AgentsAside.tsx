import type { Index } from "../../../../src/core/types";
import { Eyebrow, FlagBadge } from "../../components/primitives";
import { AgentStatusMark, StatusGlyph } from "../../components/Status";
import { sessionLabel } from "../../data/agents";
import { elapsed } from "../../lib/format";
import { AGENT_LOOK } from "../../lib/status";
import {
  countLine,
  editedFiles,
  needsYou,
  plannedOverlaps,
  rightNow,
  type StatusCount,
} from "./model";

/** "a", "a and b", "a, b and c". */
function joinAnd(parts: string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function CountRow({ mark, label, count }: { mark: string; label: string; count: StatusCount }) {
  return (
    <>
      <span className="agents-now-label">
        <span className={mark} aria-hidden="true" />
        {label}
      </span>
      <span className="agents-now-count">{countLine(count)}</span>
    </>
  );
}

/** Right now, Files being edited, Planned overlaps, Needs you. Read-only: prompts are answered in Claude Code. */
export function AgentsAside({ index, now }: { index: Index; now: number }) {
  const counts = rightNow(index.live, now);
  const { files, conflicts } = editedFiles(index.live, index.project.shared_files);
  const conflicted = new Set(conflicts.map((f) => f.path));
  const overlaps = plannedOverlaps(index);
  const waits = needsYou(index.live);
  return (
    <aside aria-label="Agent summary" className="agents-aside">
      <section className="az-card agents-now" aria-label="Right now">
        <Eyebrow>Right now</Eyebrow>
        <div className="agents-now-grid">
          <CountRow mark={AGENT_LOOK.running.mark} label="Running" count={counts.running} />
          <CountRow mark={AGENT_LOOK.waiting.mark} label="Waiting on you" count={counts.waiting} />
          <CountRow mark={AGENT_LOOK.done.mark} label="Done today" count={counts.doneToday} />
        </div>
      </section>
      <section className="agents-panel" aria-label="Files being edited">
        <Eyebrow>Files being edited</Eyebrow>
        {files.length > 0 && (
          <ul className="agents-files">
            {files.map((f) => (
              <li key={f.path} className={conflicted.has(f.path) ? "conflict" : undefined}>
                <span className="az-mono agents-file">{f.path}</span>
                {f.editors.map((e) => (
                  <a key={e.key} className="az-mono agents-editor" href={e.href}>
                    {e.label}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        )}
        {conflicts.length === 0 ? (
          <div className="agents-ok">
            <StatusGlyph glyph="s-done" />
            No two agents are editing the same file
          </div>
        ) : (
          conflicts.map((f) => (
            <FlagBadge key={f.path} tone="danger">
              {`${joinAnd(f.editors.map((e) => e.label))} are editing ${f.path}`}
            </FlagBadge>
          ))
        )}
      </section>
      <section className="agents-panel" aria-label="Planned overlaps">
        <Eyebrow>Planned overlaps</Eyebrow>
        {overlaps.length === 0 ? (
          <div className="agents-none">No in-flight features plan changes to the same file</div>
        ) : (
          overlaps.map((o) => (
            <FlagBadge key={`${o.path} ${o.features.join(" ")}`}>
              {`${o.features[0]} and ${o.features[1]} both plan changes to ${o.path}`}
            </FlagBadge>
          ))
        )}
      </section>
      <section className="agents-panel" aria-label="Needs you">
        <Eyebrow>Needs you</Eyebrow>
        {waits.length === 0 ? (
          <div className="agents-none">Nothing is waiting on you</div>
        ) : (
          waits.map(({ session, row, wait }) => (
            <a key={row.key} className="agents-needs" href={row.href}>
              <span className="agents-needs-head">
                <AgentStatusMark status="waiting" hideLabel />
                {`${sessionLabel(session)} · ${elapsed(now - Date.parse(wait.since))}`}
              </span>
              <span className="agents-needs-reason">
                {row.agent_id ? `${row.name} · ${wait.reason}` : wait.reason}
              </span>
              <span className="agents-needs-hint">
                Answer it in the Claude Code terminal running this session
              </span>
            </a>
          ))
        )}
      </section>
    </aside>
  );
}
