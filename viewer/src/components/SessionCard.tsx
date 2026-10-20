import type { MouseEvent, ReactNode } from "react";
import type { Index, Session } from "../../../src/core/types";
import { useIndexState } from "../data/IndexProvider";
import { clock, duration, plural, shortDate } from "../lib/format";
import { Prose } from "../lib/markdown";
import type { SessionStatus } from "../screens/activity/sessions";
import type { SessionThread, ThreadEntry } from "../screens/activity/thread";
import { IdChip } from "./IdChip";
import { FlagBadge, Tag } from "./primitives";
import { AgentStatusMark, StatusGlyph } from "./Status";
import "./session-card.css";

/** True when this session edited a spec after it was approved. */
function changedApprovedSpec(index: Index, id: string): boolean {
  return index.features.some((f) => f.derived.approval_changes.some((c) => c.session === id));
}

/** "11:00–11:58", or "started 11:50" while the session is open. */
function clockRange(s: Session): string {
  if (!s.ended_at) return `started ${clock(s.started_at)}`;
  return `${clock(s.started_at)}–${clock(s.ended_at)}`;
}

/** The expanded header's "11:00–11:58 · 58m · 1 subagent". */
function timeSpan(s: Session, subagents: number): string {
  const ms = s.ended_at ? Date.parse(s.ended_at) - Date.parse(s.started_at) : null;
  return [
    clockRange(s),
    ms === null ? null : duration(ms),
    subagents > 0 ? plural(subagents, "subagent") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The collapsed card's "11:00–11:58 · 3 commits · 3 runs (1 failed) · raised". The counts are
 * the session's, so the kind chips don't change them.
 */
function tally(s: Session, thread: SessionThread, dated: boolean): string {
  const { total, failed } = thread.runs;
  return [
    dated ? `${shortDate(s.started_at)}, ${clockRange(s)}` : clockRange(s),
    plural(s.commits.length, "commit"),
    total > 0 ? `${plural(total, "run")}${failed > 0 ? ` (${failed} failed)` : ""}` : null,
    s.raised.length > 0 ? "raised" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Clicks on the header toggle the card, except clicks on links inside it. */
function onHeaderClick(toggle: () => void) {
  return (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    toggle();
  };
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d={up ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
    </svg>
  );
}

/** Done and open sessions as glyphs; a session still at work as its live mark. */
function SessionMark({ status }: { status: SessionStatus }) {
  if (status === "done") return <StatusGlyph glyph="s-done" label="Done" />;
  if (status === "open") return <StatusGlyph glyph="s-open" label="Open" />;
  return <AgentStatusMark status={status} hideLabel />;
}

/**
 * One agent work session. Collapsed, it is a single line with its tally; expanded, it shows the
 * goal, the handoff (the most prominent part: it is what the next session starts from) and who
 * picked it up, the summary, the goals added and notes written while it was reused, what it
 * touched, and its thread of subagents, commits, runs and raised items.
 */
export function SessionCard({
  session: s,
  thread,
  expanded,
  onToggle,
  dated = false,
  flash = false,
}: {
  session: Session;
  thread: SessionThread;
  expanded: boolean;
  onToggle: () => void;
  /** Prefix the collapsed times with the date (the feed's Earlier group). */
  dated?: boolean;
  flash?: boolean;
}) {
  const { index } = useIndexState();
  if (!index) return null;
  const changedSpec = changedApprovedSpec(index, s.id);
  const toggle = (
    <button
      type="button"
      className="ses-toggle"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} session ${s.id}`}
      onClick={onToggle}
    >
      <Chevron up={expanded} />
    </button>
  );
  const identity = (
    <>
      <SessionMark status={thread.status} />
      <span className="ses-kind">Session</span>
      <span className="az-mono ses-id">{s.id}</span>
      {s.skill && <Tag>{s.skill}</Tag>}
    </>
  );
  const cls = `ses-card ${expanded ? "az-card expanded" : "collapsed"} ${flash ? "az-flash" : ""}`;

  if (!expanded) {
    return (
      <div id={`ses-${s.id}`} className={cls.trim()} onClick={onHeaderClick(onToggle)}>
        {identity}
        <span className="ses-goal-inline">{s.goal}</span>
        <span className="spacer" />
        {changedSpec && <FlagBadge>Changed an approved spec</FlagBadge>}
        <span className="ses-tally">{tally(s, thread, dated)}</span>
        {s.raised.map((id) => (
          <IdChip key={id} id={id} />
        ))}
        {toggle}
      </div>
    );
  }

  return (
    <article id={`ses-${s.id}`} className={cls.trim()} aria-label={`Session ${s.id}`}>
      <div className="ses-head" onClick={onHeaderClick(onToggle)}>
        {identity}
        <span className="ses-when">{timeSpan(s, thread.subagents)}</span>
        <span className="spacer" />
        {changedSpec && <FlagBadge>Changed an approved spec</FlagBadge>}
        {thread.transcript && (
          <a className="ses-transcript" href={thread.transcript}>
            Transcript
          </a>
        )}
        {toggle}
      </div>
      <div className="ses-body">
        <div className="ses-goal">{s.goal}</div>
        {s.handoff.trim() && <Handoff text={s.handoff} pickedUp={thread.pickedUp} />}
        {s.summary.trim() && <Prose text={s.summary} className="ses-summary" />}
        {s.goals.trim() && <Bullets label="Goals" text={s.goals} startedAt={s.started_at} />}
        {s.notes.trim() && <Bullets label="Notes" text={s.notes} startedAt={s.started_at} />}
        <dl className="ses-facts">
          <Fact label="Touched" ids={s.touched} />
          <Thread entries={thread.entries} />
        </dl>
      </div>
    </article>
  );
}

function Handoff({ text, pickedUp }: { text: string; pickedUp: SessionThread["pickedUp"] }) {
  return (
    <section className="ses-handoff" aria-label="Handoff to the next session">
      <div className="ses-handoff-title">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 8h10M8.5 4.5L12 8l-3.5 3.5" />
          <path d="M14 3v10" />
        </svg>
        Handoff
        {pickedUp && (
          <span className="ses-picked-up">
            · picked up by <span className="az-mono">{pickedUp.id}</span>
            {` at ${clock(pickedUp.at)}`}
          </span>
        )}
      </div>
      <Prose text={text} className="ses-handoff-prose" />
    </section>
  );
}

const MINUTE = 60_000;

/**
 * Bullets as written (`- HH:MM · …`, in UTC) with their times in the viewer's local time, like
 * the card header. A bullet has no date: it falls on the start's UTC day, or on the next one when
 * its time is earlier than the start's.
 */
function localBullets(text: string, startedAt: string): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return text;
  const startMinute = Math.floor(start / MINUTE) * MINUTE;
  return text.replace(
    /^(\s*- )(\d{2}):(\d{2})(?= · )/gm,
    (_, lead: string, h: string, m: string) => {
      const at = new Date(startMinute);
      at.setUTCHours(Number(h), Number(m));
      if (at.getTime() < startMinute) at.setUTCDate(at.getUTCDate() + 1);
      return `${lead}${clock(at.toISOString())}`;
    },
  );
}

/** A session's timestamped bullets: the goals of later starts, or its running notes. */
function Bullets({ label, text, startedAt }: { label: string; text: string; startedAt: string }) {
  return (
    <section className="ses-bullets" aria-label={label}>
      <div className="ses-bullets-title">{label}</div>
      <Prose text={localBullets(text, startedAt)} className="ses-bullets-prose" />
    </section>
  );
}

function Fact({ label, ids }: { label: string; ids: string[] }): ReactNode {
  if (ids.length === 0) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd className="ses-chips">
        {ids.map((id) => (
          <IdChip key={id} id={id} />
        ))}
      </dd>
    </>
  );
}

/** The session's thread, oldest first; untimed entries (no time shown) close it. */
function Thread({ entries }: { entries: ThreadEntry[] }): ReactNode {
  if (entries.length === 0) return null;
  return (
    <>
      <dt className="ses-thread-label">Thread</dt>
      <dd>
        <ol className="ses-thread">
          {entries.map((entry) => (
            <li key={`${entry.kind}:${entryId(entry)}`} className={`ses-entry e-${entry.kind}`}>
              <span className="ses-entry-time">{clock(entry.at)}</span>
              <EntryMark entry={entry} />
              <span className="ses-entry-text">
                <EntryText entry={entry} />
              </span>
              <span className="ses-entry-end">
                <EntryEnd entry={entry} />
              </span>
            </li>
          ))}
        </ol>
      </dd>
    </>
  );
}

function entryId(entry: ThreadEntry): string {
  if (entry.kind === "subagent") return entry.href;
  if (entry.kind === "commit") return entry.sha;
  return entry.id;
}

/** "└" for subagents, a ring for commits, a pass or fail glyph for runs, a diamond for raised items. */
function EntryMark({ entry }: { entry: ThreadEntry }) {
  switch (entry.kind) {
    case "subagent":
      return (
        <span className="ses-mark m-subagent" aria-hidden="true">
          └
        </span>
      );
    case "commit":
      return <span className="ses-mark m-commit" role="img" aria-label="Commit" title="Commit" />;
    case "run":
      return entry.ok ? (
        <StatusGlyph glyph="s-done" label="Passed" />
      ) : (
        <StatusGlyph glyph="s-failing" label="Failed" />
      );
    default:
      return <span className="ses-mark m-raised" role="img" aria-label="Raised" title="Raised" />;
  }
}

const RAISED_VERB = { question: "Raised", adr: "Proposed", issue: "Filed" } as const;

function EntryText({ entry }: { entry: ThreadEntry }) {
  switch (entry.kind) {
    case "subagent":
      return (
        <>
          <a className="az-mono ses-agent" href={entry.href}>
            {entry.agent}
          </a>{" "}
          {entry.text}
        </>
      );
    case "commit":
      return (
        <>
          <span className="az-mono ses-sha">{entry.sha}</span> {entry.subject}
        </>
      );
    case "run":
      return <>{entry.text}</>;
    default:
      return (
        <>
          {RAISED_VERB[entry.kind]} <IdChip id={entry.id} /> {entry.title}
        </>
      );
  }
}

/** A subagent's duration, a commit's refs and a run's target. */
function EntryEnd({ entry }: { entry: ThreadEntry }): ReactNode {
  switch (entry.kind) {
    case "subagent":
      return entry.duration ?? "running";
    case "commit":
      // An untimed commit is one the index doesn't have, so whether it had refs is unknown.
      if (entry.at !== null && entry.refs.length === 0)
        return <span className="ses-untracked">untracked</span>;
      return entry.refs.map((id) => <IdChip key={id} id={id} />);
    case "run":
      return entry.target ? <IdChip id={entry.target} /> : null;
    default:
      return null;
  }
}
