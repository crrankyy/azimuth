import type { ReactNode } from "react";
import type { Commit, Feature, LogEntry, VerifyRun } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { SessionCard } from "../../components/SessionCard";
import { StatusGlyph } from "../../components/Status";
import { clock, dateTime, dayHeading, plural, shortDuration } from "../../lib/format";
import { inline } from "../../lib/markdown";
import { routeForId } from "../../lib/router";
import { byPeriod, type FeedItem, type Period, type PeriodGroup } from "./feed";
import { LiveCards } from "./LiveCards";
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

/** Period groups; the cards come first under Today (a Today group is shown for them alone if needed). */
export function ActivityFeed({
  items,
  cards,
  state,
}: {
  items: FeedItem[];
  cards: ActivitySession[];
  state: FeedState;
}): ReactNode {
  return (
    <div className="feed">
      {withToday(byPeriod(items, state.now), cards, state.now).map((group) => {
        const [lead, rest] = splitHeading(group.heading);
        return (
          <section key={group.period} className="feed-period" aria-label={lead}>
            <h2 className="feed-period-title">
              {lead}
              {rest && <span> · {rest}</span>}
            </h2>
            {group.period === "today" && <LiveCards sessions={cards} now={state.now} />}
            {group.items.length > 0 && (
              <ol className="feed-list">
                {group.items.map((item) => (
                  <FeedRow
                    key={`${item.kind}-${item.key}`}
                    item={item}
                    period={group.period}
                    state={state}
                  />
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** The cards open Today, so they get a Today group of their own when nothing else happened today. */
function withToday(groups: PeriodGroup[], cards: ActivitySession[], now: number): PeriodGroup[] {
  if (cards.length === 0 || groups[0]?.period === "today") return groups;
  const heading = dayHeading(new Date(now).toISOString(), now);
  return [{ period: "today", heading, items: [] }, ...groups];
}

/** "Today · Sunday, Oct 18" → ["Today", "Sunday, Oct 18"]; "Earlier" stays whole. */
function splitHeading(heading: string): [string, string | null] {
  const at = heading.indexOf(" · ");
  return at < 0 ? [heading, null] : [heading.slice(0, at), heading.slice(at + 3)];
}

function FeedRow({ item, period, state }: { item: FeedItem; period: Period; state: FeedState }) {
  // Older items carry their date, since the Earlier heading names none.
  const dated = period === "earlier";
  if (item.kind === "session") {
    // sessionThreads has a thread for every persisted session, so this only guards the type.
    const thread = state.threads.get(item.session.id);
    if (!thread) return null;
    return (
      <li className="feed-item k-session">
        <SessionCard
          session={item.session}
          thread={thread}
          expanded={state.expanded.has(item.session.id)}
          onToggle={() => state.onToggle(item.session.id)}
          dated={dated}
          flash={state.changed.has(item.session.id)}
        />
      </li>
    );
  }
  return (
    <li className={`feed-item k-${item.kind}`}>
      <Marker item={item} />
      <FeedContent item={item} />
      <span className="feed-time">{dated ? dateTime(item.at) : clock(item.at)}</span>
    </li>
  );
}

/** A ring for commits, a pass or fail glyph for runs, a diamond for your actions. */
function Marker({ item }: { item: FeedItem }) {
  if (item.kind === "run")
    return (
      <StatusGlyph
        glyph={item.run.ok ? "s-done" : "s-failing"}
        label={item.run.ok ? "Passed" : "Failed"}
      />
    );
  return <span className={`feed-mark m-${item.kind}`} aria-hidden="true" />;
}

function FeedContent({ item }: { item: Exclude<FeedItem, { kind: "session" }> }) {
  switch (item.kind) {
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
