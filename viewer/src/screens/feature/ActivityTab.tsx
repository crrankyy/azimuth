import { useState, type ReactNode } from "react";
import type { Commit, Feature, LogEntry, Session, VerifyRun } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { EmptyState, Tag } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { clock, dayHeading, duration, localDay, plural, shortDuration } from "../../lib/format";
import { Prose } from "../../lib/markdown";
import { FEATURE_LOOK } from "../../lib/status";
import { Chevron } from "./FeatureHeader";
import { activityFeed, transitionRest, type FeedItem } from "./featureData";

const LOG_LABEL: Record<LogEntry["type"], string> = {
  transition: "Transition",
  note: "Note",
  review: "Review",
  override: "Override",
};

function Actor({ entry }: { entry: { actor: string; auto?: boolean } }) {
  return (
    <span className="fd-feed-actor">
      {entry.actor === "you" ? "You" : "Agent"}
      {entry.auto && <span className="az-kind">auto</span>}
    </span>
  );
}

function LogItem({ entry }: { entry: LogEntry }) {
  const { index } = useIndexState();
  const options = { terms: index?.knowledge.glossary };
  // The row already shows "from → to"; keep only what the body adds.
  const body = entry.transition ? transitionRest(entry.body) : entry.body;
  return (
    <div className="fd-feed-body">
      <div className="row fd-feed-line">
        <span className="fd-feed-kind">{LOG_LABEL[entry.type]}</span>
        <Actor entry={entry} />
        {entry.transition && (
          <span className="fd-feed-move">
            {entry.transition.from} → {entry.transition.to}
          </span>
        )}
        {entry.session && <IdChip id={entry.session} />}
      </div>
      {body && (
        <Prose
          text={body}
          options={options}
          className={entry.type === "review" ? "fd-feed-prose fd-feed-review" : "fd-feed-prose"}
        />
      )}
    </div>
  );
}

function RunItem({ run }: { run: VerifyRun }) {
  return (
    <div className="row fd-feed-line fd-wrap">
      <span className="fd-feed-kind">Verify run</span>
      <IdChip id={run.id} />
      <span className={run.ok ? "fd-feed-pass" : "fd-feed-fail"}>
        {run.ok ? "passed" : `failed · exit ${run.exit_code}`}
      </span>
      <IdChip id={run.target} />
      <span className="az-mono fd-feed-cmd">{run.command}</span>
      <span className="fd-feed-dim">
        {shortDuration(run.duration_ms)}
        {run.commit && ` · ${run.commit}`}
      </span>
    </div>
  );
}

function CommitRow({ commit, showTime = false }: { commit: Commit; showTime?: boolean }) {
  return (
    <div className="fd-commit">
      <span className="az-mono fd-commit-sha">{commit.sha}</span>
      <span className="fd-commit-subject" title={commit.subject}>
        {commit.subject}
      </span>
      <span className="row fd-commit-refs">
        {commit.refs.map((id) => (
          <IdChip key={id} id={id} />
        ))}
      </span>
      <span className="fd-feed-dim">
        {showTime
          ? clock(commit.at)
          : `${commit.actor === "you" ? "You" : "Agent"} · ${plural(commit.files_changed, "file")}`}
      </span>
    </div>
  );
}

function SessionCard({
  session,
  commits,
  initiallyOpen,
}: {
  session: Session;
  commits: Commit[];
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const span = session.ended_at
    ? `${clock(session.started_at)}–${clock(session.ended_at)} · ${duration(Date.parse(session.ended_at) - Date.parse(session.started_at))}`
    : `since ${clock(session.started_at)}`;
  const bodyId = `fd-ses-${session.id}`;
  return (
    <article className={`az-card fd-session ${open ? "open" : ""}`.trim()}>
      <button
        type="button"
        className="fd-session-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className="fd-feed-kind">Session</span>
        <span className="az-mono fd-session-id">{session.id}</span>
        {session.skill && <Tag>{session.skill}</Tag>}
        {!open && <span className="fd-session-goal">{session.goal}</span>}
        {open && <span className="fd-feed-dim">{`${session.agent} · ${span}`}</span>}
        <span className="spacer" />
        {!open && <span className="fd-feed-dim">{plural(commits.length, "commit")}</span>}
        <Chevron up={open} />
      </button>
      {open && (
        <div className="fd-session-body" id={bodyId}>
          <div className="fd-session-title">{session.goal}</div>
          {session.handoff.trim() && (
            <div className="fd-handoff">
              <div className="fd-handoff-head">Handoff to the next session</div>
              <Prose text={session.handoff} className="fd-feed-prose" />
            </div>
          )}
          {session.summary.trim() && <Prose text={session.summary} className="fd-feed-prose" />}
          <dl className="fd-session-facts">
            {session.touched.length > 0 && <Facts label="Touched" ids={session.touched} />}
            {session.raised.length > 0 && <Facts label="Raised" ids={session.raised} />}
            {commits.length > 0 && (
              <>
                <dt>Commits</dt>
                <dd className="stack">
                  {commits.map((c) => (
                    <CommitRow key={c.sha} commit={c} showTime />
                  ))}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </article>
  );
}

function Facts({ label, ids }: { label: string; ids: string[] }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="row fd-wrap">
        {ids.map((id) => (
          <IdChip key={id} id={id} />
        ))}
      </dd>
    </>
  );
}

function marker(item: FeedItem): ReactNode {
  if (item.kind === "run") return <StatusGlyph glyph={item.run.ok ? "s-done" : "s-failing"} />;
  if (item.kind === "session") return <span className="fd-mark square" />;
  if (item.kind === "log" && item.entry.transition) {
    const to = item.entry.transition.to as Feature["status"];
    return <StatusGlyph glyph={FEATURE_LOOK[to]?.glyph ?? ""} />;
  }
  if (item.kind === "log" && item.entry.type === "review")
    return <span className="fd-mark square muted" />;
  return <span className="fd-mark dot" />;
}

function itemKey(item: FeedItem): string {
  if (item.kind === "log") return `log-${item.at}-${item.entry.type}`;
  if (item.kind === "session") return item.session.id;
  if (item.kind === "commit") return item.commit.sha;
  return item.run.id;
}

function FeedRow({ item, firstSession }: { item: FeedItem; firstSession: boolean }) {
  return (
    <li className={`fd-feed-item ${item.kind}`}>
      <span className="fd-feed-time">{clock(item.at)}</span>
      <span className="fd-feed-rail">
        <span className="fd-feed-mark">{marker(item)}</span>
        <span className="fd-feed-line-v" />
      </span>
      <div className="fd-feed-content">
        {item.kind === "log" && <LogItem entry={item.entry} />}
        {item.kind === "run" && <RunItem run={item.run} />}
        {item.kind === "commit" && (
          <div className="row fd-feed-line">
            <span className="fd-feed-kind">Commit</span>
            <CommitRow commit={item.commit} />
          </div>
        )}
        {item.kind === "session" && (
          <SessionCard session={item.session} commits={item.commits} initiallyOpen={firstSession} />
        )}
      </div>
    </li>
  );
}

function byDay(feed: FeedItem[]): [string, FeedItem[]][] {
  const days = new Map<string, FeedItem[]>();
  for (const item of feed) {
    const day = localDay(item.at);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days.entries()];
}

/** This feature's log, sessions, commits and verify runs as one time-ordered feed. */
export function ActivityTab({ f }: { f: Feature }) {
  const { index, now } = useIndexState();
  if (!index) return null;
  const feed = activityFeed(index, f);
  if (feed.length === 0) {
    return <EmptyState title="No activity yet">Nothing has happened on {f.id} so far.</EmptyState>;
  }
  const firstSession = feed.find((i) => i.kind === "session");
  return (
    <div className="fd-feed">
      {byDay(feed).map(([day, items]) => {
        const [head, rest] = dayHeading(items[0]?.at ?? day, now).split(" · ");
        return (
          <section key={day} aria-label={head}>
            <h2 className="fd-day">
              {head}
              {rest && <span> · {rest}</span>}
            </h2>
            <ol className="fd-feed-list">
              {items.map((item) => (
                <FeedRow key={itemKey(item)} item={item} firstSession={item === firstSession} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
