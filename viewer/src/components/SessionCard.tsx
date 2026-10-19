import type { MouseEvent, ReactNode } from "react";
import type { Commit, Index, Session } from "../../../src/core/types";
import { useIndexState } from "../data/IndexProvider";
import { clock, duration, plural } from "../lib/format";
import { Prose } from "../lib/markdown";
import { IdChip } from "./IdChip";
import { FlagBadge, Tag } from "./primitives";
import "./session-card.css";

/** True when this session edited a spec after it was approved. */
function changedApprovedSpec(index: Index, id: string): boolean {
  return index.features.some((f) => f.derived.approval_changes.some((c) => c.session === id));
}

/** A session's commits as recorded, newest first; SHAs missing from the index sort last. */
function newestFirst(index: Index, shas: string[]): { sha: string; commit?: Commit }[] {
  return shas
    .map((sha) => ({ sha, commit: index.commits.find((c) => c.sha === sha) }))
    .sort((a, b) => (b.commit?.at ?? "").localeCompare(a.commit?.at ?? ""));
}

function timeSpan(s: Session): string {
  if (!s.ended_at) return `started ${clock(s.started_at)}`;
  const ms = Date.parse(s.ended_at) - Date.parse(s.started_at);
  return `${clock(s.started_at)}–${clock(s.ended_at)} · ${duration(ms)}`;
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

/**
 * One agent work session. Collapsed, it is a single line; expanded, it shows the goal, the
 * handoff (the most prominent part: it is what the next session starts from), the summary, the
 * goals added and notes written while it was reused, and what it touched, raised and committed.
 */
export function SessionCard({
  session: s,
  expanded,
  onToggle,
  live = false,
  flash = false,
}: {
  session: Session;
  expanded: boolean;
  onToggle: () => void;
  /** An agent is working in this session right now. */
  live?: boolean;
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
      <span className="ses-kind">Session</span>
      <span className="az-mono ses-id">{s.id}</span>
      {s.skill && <Tag>{s.skill}</Tag>}
      {live && <span className="az-live" role="img" aria-label="Live now" />}
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
        <span className="ses-tally">
          {plural(s.commits.length, "commit")}
          {s.raised.length > 0 ? " · raised" : ""}
        </span>
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
        <span className="ses-when">
          {s.agent} · {timeSpan(s)}
        </span>
        <span className="spacer" />
        {changedSpec && <FlagBadge>Changed an approved spec</FlagBadge>}
        {toggle}
      </div>
      <div className="ses-body">
        <div className="ses-goal">{s.goal}</div>
        {s.handoff.trim() && <Handoff text={s.handoff} />}
        {s.summary.trim() && <Prose text={s.summary} className="ses-summary" />}
        {s.goals.trim() && <Bullets label="Goals" text={s.goals} startedAt={s.started_at} />}
        {s.notes.trim() && <Bullets label="Notes" text={s.notes} startedAt={s.started_at} />}
        <dl className="ses-facts">
          <Fact label="Touched" ids={s.touched} />
          <Fact label="Raised" ids={s.raised} />
          {s.commits.length > 0 && (
            <>
              <dt className="ses-commits-label">Commits</dt>
              <dd className="ses-commits">
                {newestFirst(index, s.commits).map(({ sha, commit }) => (
                  <SessionCommit key={sha} sha={sha} commit={commit} />
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
    </article>
  );
}

function Handoff({ text }: { text: string }) {
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
        Handoff to the next session
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

function SessionCommit({ sha, commit }: { sha: string; commit: Commit | undefined }) {
  return (
    <span className="ses-commit">
      <span className="az-mono ses-sha">{sha}</span>
      <span className="ses-subject">{commit?.subject ?? "Not in the index"}</span>
      <span className="ses-refs">
        {commit?.refs.map((id) => (
          <IdChip key={id} id={id} />
        ))}
        {commit && commit.refs.length === 0 && <span className="ses-untracked">untracked</span>}
      </span>
      <span className="ses-time">{clock(commit?.at)}</span>
    </span>
  );
}
