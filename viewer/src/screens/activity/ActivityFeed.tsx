import type { Commit, Feature, LogEntry, VerifyRun } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { SessionCard } from "../../components/SessionCard";
import { StatusGlyph } from "../../components/Status";
import { clock, dayHeading, plural, shortDuration } from "../../lib/format";
import { inline } from "../../lib/markdown";
import { routeForId } from "../../lib/router";
import { byDay, type FeedItem } from "./feed";
import type { ActivitySession } from "./sessions";
import type { SessionThread } from "./thread";

export interface FeedState {
  now: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  changed: Set<string>;
  /** Each persisted session's thread (sessionThreads), by SES ID. */
  threads: Map<string, SessionThread>;
}

/** The project timeline, grouped by day: sessions, commits, verify runs and your actions. */
export function ActivityFeed({
  items,
  state,
}: {
  items: FeedItem[];
  cards: ActivitySession[];
  state: FeedState;
}) {
  return (
    <div className="feed">
      {byDay(items).map((group) => {
        const [lead, rest] = splitHeading(dayHeading(group.items[0]?.at ?? group.day, state.now));
        return (
          <section key={group.day} className="feed-day" aria-label={lead}>
            <h2 className="feed-day-title">
              {lead}
              {rest && <span> · {rest}</span>}
            </h2>
            <ol className="feed-list">
              {group.items.map((item) => (
                <FeedRow key={`${item.kind}-${item.key}`} item={item} state={state} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** "Today · Sunday, Oct 18" → ["Today", "Sunday, Oct 18"]; plain dates stay whole. */
function splitHeading(heading: string): [string, string | null] {
  const at = heading.indexOf(" · ");
  return at < 0 ? [heading, null] : [heading.slice(0, at), heading.slice(at + 3)];
}

function FeedRow({ item, state }: { item: FeedItem; state: FeedState }) {
  const open = item.kind === "session" && state.expanded.has(item.session.id);
  return (
    <li className={`feed-item k-${item.kind} ${open ? "open" : ""}`.trim()}>
      <span className="feed-time">{clock(item.at)}</span>
      <span className="feed-rail">
        <Marker item={item} open={open} />
        <span className="feed-line" />
      </span>
      <div className="feed-body">
        <FeedContent item={item} state={state} />
      </div>
    </li>
  );
}

function Marker({ item, open }: { item: FeedItem; open: boolean }) {
  if (item.kind === "run")
    return (
      <StatusGlyph
        glyph={item.run.ok ? "s-done" : "s-failing"}
        label={item.run.ok ? "Passed" : "Failed"}
      />
    );
  return <span className={`feed-mark m-${item.kind} ${open ? "open" : ""}`.trim()} />;
}

function FeedContent({ item, state }: { item: FeedItem; state: FeedState }) {
  switch (item.kind) {
    case "session": {
      // sessionThreads has a thread for every persisted session, so this only guards the type.
      const thread = state.threads.get(item.session.id);
      if (!thread) return null;
      return (
        <SessionCard
          session={item.session}
          thread={thread}
          expanded={state.expanded.has(item.session.id)}
          onToggle={() => state.onToggle(item.session.id)}
          flash={state.changed.has(item.session.id)}
        />
      );
    }
    case "commit":
      return <CommitRow commit={item.commit} />;
    case "run":
      return <RunRow run={item.run} />;
    case "action":
      return <ActionRow entry={item.entry} feature={item.feature} />;
  }
}

/** A commit outside any recorded session; commits without refs are marked untracked. */
export function CommitRow({ commit }: { commit: Commit }) {
  return (
    <div className="feed-row">
      <span className="feed-kind">Commit by {commit.actor === "you" ? "you" : "an agent"}</span>
      <span className="az-mono feed-sha">{commit.sha}</span>
      <span className="feed-text">{commit.subject}</span>
      {commit.refs.length > 0 ? (
        commit.refs.map((id) => <IdChip key={id} id={id} />)
      ) : (
        <span className="feed-untracked">untracked · no refs</span>
      )}
      {commit.session && <IdChip id={commit.session} />}
      <span className="feed-dim">{plural(commit.files_changed, "file")}</span>
    </div>
  );
}

function runOutcome(run: VerifyRun): string {
  if (run.ok) return "passed ·";
  const failures = run.junit ? run.junit.failures + run.junit.errors : 0;
  return failures > 0
    ? `failed · ${plural(failures, "failure")}`
    : `failed · exit ${run.exit_code}`;
}

function RunRow({ run }: { run: VerifyRun }) {
  return (
    <div className="feed-row">
      <span className="feed-kind">Verify run</span>
      <IdChip id={run.id} />
      <span className={run.ok ? "run-ok" : "run-fail"}>{runOutcome(run)}</span>
      <span className="feed-text">
        <a className="feed-ref" href={routeForId(run.target)}>
          {run.target}
        </a>
        {!run.ok && ` · ${run.command}`}
      </span>
      <span className="feed-dim">
        {shortDuration(run.duration_ms)}
        {run.commit ? ` · ${run.commit}` : ""}
      </span>
    </div>
  );
}

const ACTION_VERB: Record<LogEntry["type"], string> = {
  transition: "moved",
  review: "requested changes on",
  note: "noted on",
  override: "overrode a gate on",
};

/** Your own log entries (approvals, review comments, notes). */
function ActionRow({ entry, feature }: { entry: LogEntry; feature: Feature }) {
  const firstLine = entry.body.split("\n").find((l) => l.trim()) ?? "";
  return (
    <div className="feed-row">
      <span className="feed-kind">You</span>
      <span className="feed-verb">{ACTION_VERB[entry.type]}</span>
      <IdChip id={feature.id} />
      <span className="feed-text">
        {entry.transition ? `${entry.transition.from} → ${entry.transition.to}` : inline(firstLine)}
      </span>
    </div>
  );
}
