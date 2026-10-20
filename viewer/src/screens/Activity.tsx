import { useEffect, useMemo, useState } from "react";
import { Page } from "../components/AppShell";
import { EmptyState, FilterChip } from "../components/primitives";
import { useIndexState } from "../data/IndexProvider";
import { featureById } from "../data/selectors";
import { plural } from "../lib/format";
import { href, type Route } from "../lib/router";
import { ActivityFeed } from "./activity/ActivityFeed";
import { AgentTimeline } from "./activity/AgentTimeline";
import {
  buildFeed,
  featureCounts,
  matchesFeature,
  type ActivityKind,
  type FeatureFilter,
} from "./activity/feed";
import { liveCards } from "./activity/LiveCards";
import { activityData, sessionMatchesFeature } from "./activity/sessions";
import { sessionThreads } from "./activity/thread";
import { layoutTimeline, type TimelineRange } from "./activity/timeline";
import "./activity/activity.css";

const KINDS: { kind: ActivityKind; label: string }[] = [
  { kind: "session", label: "Sessions" },
  { kind: "subagent", label: "Subagents" },
  { kind: "commit", label: "Commits" },
  { kind: "run", label: "Verify runs" },
  { kind: "action", label: "Your actions" },
];

const sessionIdOf = (route: Route) => (route.id?.startsWith("SES-") ? route.id : null);

export function ActivityScreen({ route }: { route: Route }) {
  const { index, now, changed } = useIndexState();
  const data = useMemo(() => (index ? activityData(index, now) : null), [index, now]);
  const feed = useMemo(() => (index && data ? buildFeed(index, data) : []), [index, data]);
  const routed = sessionIdOf(route);
  const [kinds, setKinds] = useState<Set<ActivityKind>>(() => new Set(KINDS.map((k) => k.kind)));
  const [feature, setFeature] = useState<FeatureFilter>("all");
  const [range, setRange] = useState<TimelineRange>("75m");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = routed ?? feed.find((i) => i.kind === "session")?.key;
    return new Set(first ? [first] : []);
  });
  // Opening #/activity/SES-… while already on this screen expands that session too.
  const [seen, setSeen] = useState(routed);
  if (routed !== seen) {
    setSeen(routed);
    if (routed) setExpanded((prev) => new Set(prev).add(routed));
  }
  useEffect(() => {
    if (routed) document.getElementById(`ses-${routed}`)?.scrollIntoView({ block: "start" });
  }, [routed]);
  if (!index || !data) return null;

  const typed = feed.filter((i) => kinds.has(i.kind));
  const shown = typed.filter((i) => matchesFeature(i, feature));
  const untracked = typed.filter((i) => matchesFeature(i, "untracked")).length;
  const threads = sessionThreads(index, data, { now, kinds });
  const timeline = layoutTimeline(index, { now, range, kinds, feature }, data);
  // The header counts every running or waiting session; the filters narrow only what's listed.
  const active = liveCards(data);
  const cards = kinds.has("session") ? active.filter((s) => sessionMatchesFeature(s, feature)) : [];
  const anything = feed.length > 0 || active.length > 0;
  const toggleKind = (kind: ActivityKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });
  const toggleSession = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const crumbs = [
    { label: "Activity", href: href("activity") },
    ...(routed ? [{ label: <span className="az-mono">{routed}</span> }] : []),
  ];
  return (
    <Page crumbs={crumbs}>
      <div className="act">
        <div className="act-header">
          <h1 className="page-title">Activity</h1>
          {active.length > 0 && (
            <span className="act-active">
              <span className="az-live" />
              {`${plural(active.length, "session")} active`}
            </span>
          )}
          <span className="spacer" />
          {KINDS.map(({ kind, label }) => (
            <FilterChip key={kind} on={kinds.has(kind)} onClick={() => toggleKind(kind)}>
              {label}
            </FilterChip>
          ))}
        </div>
        <AgentTimeline layout={timeline} range={range} onRange={setRange} />
        <div className="act-layout">
          <div className="act-main">
            {shown.length > 0 || cards.length > 0 ? (
              <ActivityFeed
                items={shown}
                cards={cards}
                state={{ now, expanded, onToggle: toggleSession, changed, threads }}
              />
            ) : (
              <EmptyState title={anything ? "Nothing matches these filters" : "No activity yet"}>
                {anything
                  ? "Turn a type back on or pick another feature."
                  : "Sessions, commits and verify runs show up here as agents work."}
              </EmptyState>
            )}
          </div>
          <aside className="act-aside" aria-label="Filter by feature">
            <div className="az-eyebrow">Feature</div>
            <FeatureOption
              value="all"
              current={feature}
              onPick={setFeature}
              label="All features"
              count={typed.length}
            />
            {featureCounts(typed).map(({ id, count }) => (
              <FeatureOption
                key={id}
                value={id}
                current={feature}
                onPick={setFeature}
                id={id}
                label={featureById(index, id)?.title ?? ""}
                count={count}
              />
            ))}
            {untracked > 0 && (
              <FeatureOption
                value="untracked"
                current={feature}
                onPick={setFeature}
                label="Untracked"
                count={untracked}
              />
            )}
          </aside>
        </div>
      </div>
    </Page>
  );
}

function FeatureOption({
  value,
  current,
  onPick,
  id,
  label,
  count,
}: {
  value: FeatureFilter;
  current: FeatureFilter;
  onPick: (value: FeatureFilter) => void;
  id?: string;
  label: string;
  count: number;
}) {
  return (
    <label className={`act-option ${value === current ? "on" : ""}`.trim()}>
      <input
        type="radio"
        name="activity-feature"
        checked={value === current}
        onChange={() => onPick(value)}
      />
      {id && <span className="az-mono act-option-id">{id}</span>}
      <span className="act-option-label">{label}</span>
      <span className="act-option-count">{count}</span>
    </label>
  );
}
