import { useState } from "react";
import type { Commit, Feature, Index, Milestone } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { Button, EmptyState } from "../../components/primitives";
import { StatusGlyph, StatusPill } from "../../components/Status";
import { Dialog, useAction } from "../../components/Ui";
import { useIndexState } from "../../data/IndexProvider";
import { milestoneStart } from "../../data/selectors";
import { plural, shortDate } from "../../lib/format";
import { href } from "../../lib/router";
import { FEATURE_LOOK, LIFECYCLE, MILESTONE_LOOK } from "../../lib/status";
import { daysLeftLabel, isParked, sortFeatures } from "../features/model";
import { StatusMixBar } from "../features/parts";
import {
  MAX_LANE_COMMITS,
  milestoneCommits,
  releasedLabel,
  releaseLead,
  releaseOffer,
  releaseRequest,
  type ReleaseOffer,
} from "./release";
import "./roadmap.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toMs = (date: string) => Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);

interface Axis {
  start: number;
  end: number;
  months: { at: number; label: string }[];
}

/** Whole months covering every milestone's start, target and release, and today. */
function buildAxis(index: Index, now: number): Axis {
  const points = [now];
  for (const m of index.milestones) {
    const start = milestoneStart(index, m);
    for (const d of [start, m.target, m.released_at]) if (d) points.push(toMs(d));
  }
  const lo = new Date(Math.min(...points));
  const hi = new Date(Math.max(...points));
  const months: Axis["months"] = [];
  let year = lo.getUTCFullYear();
  let month = lo.getUTCMonth();
  for (;;) {
    const at = Date.UTC(year, month, 1);
    months.push({ at, label: MONTHS[month] ?? "" });
    if (year > hi.getUTCFullYear() || (year === hi.getUTCFullYear() && month >= hi.getUTCMonth()))
      break;
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  const end = Date.UTC(year, month + 1, 1);
  return { start: months[0]?.at ?? lo.getTime(), end, months };
}

const pct = (axis: Axis, ms: number) =>
  Math.min(100, Math.max(0, ((ms - axis.start) / (axis.end - axis.start)) * 100));

function rangeLabel(axis: Axis): string {
  const first = new Date(axis.start);
  const last = new Date(axis.end - 1);
  const year = (d: Date) => d.getUTCFullYear();
  const month = (d: Date) => MONTHS[d.getUTCMonth()] ?? "";
  if (year(first) === year(last)) return `${month(first)} – ${month(last)} ${year(last)}`;
  return `${month(first)} ${year(first)} – ${month(last)} ${year(last)}`;
}

/** Lanes run in calendar order of their target (or release) date. */
function laneOrder(milestones: Milestone[]): Milestone[] {
  const when = (m: Milestone) => m.target ?? m.released_at ?? "9999";
  return [...milestones].sort((a, b) => when(a).localeCompare(when(b)) || a.id.localeCompare(b.id));
}

export function RoadmapTimeline() {
  const { index, now } = useIndexState();
  const [showParked, setShowParked] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!index) return null;

  const axis = buildAxis(index, now);
  const lanes = laneOrder(index.milestones);
  const visible = (f: Feature) => showParked || !isParked(f);
  const known = new Set(index.milestones.map((m) => m.id));
  const loose = index.features.filter((f) => !f.milestone || !known.has(f.milestone));
  const todayPct = pct(axis, now);
  const step = axis.months.length > 12 ? 3 : 1;
  const empty = lanes.length === 0 && index.features.length === 0;

  return (
    <div className="rm-page">
      <div className="rm-heading">
        <h1 className="page-title">Roadmap</h1>
        <span className="rm-sub-title">
          {plural(index.milestones.length, "milestone")} · {rangeLabel(axis)}
        </span>
        <span className="spacer" />
        <label className="ft-ctl ft-check">
          <input
            type="checkbox"
            checked={showParked}
            onChange={(e) => setShowParked(e.target.checked)}
          />
          Show parked features
        </label>
      </div>

      {empty ? (
        <EmptyState title="Nothing on the roadmap yet">
          Features and the milestones that group them show up here. Run{" "}
          <code className="az-c">/azimuth:idea</code> in Claude Code to capture your first feature.
        </EmptyState>
      ) : (
        <div className="rm-timeline">
          <div className="rm-overlay" aria-hidden="true">
            {axis.months.slice(1).map((m) => (
              <div key={m.at} className="rm-gridline" style={{ left: `${pct(axis, m.at)}%` }} />
            ))}
            <div className="rm-today" style={{ left: `${todayPct}%` }} />
            <div className="rm-today-label" style={{ left: `${todayPct}%` }}>
              {shortDate(new Date(now).toISOString())}
            </div>
          </div>

          <div className="rm-lane rm-axis">
            <span className="az-eyebrow rm-axis-label">Milestone</span>
            <div className="rm-track rm-months">
              {axis.months.map((m, i) =>
                i % step === 0 ? (
                  <span key={m.at} style={{ left: `calc(${pct(axis, m.at)}% + 6px)` }}>
                    {m.label}
                  </span>
                ) : null,
              )}
            </div>
          </div>

          {lanes.map((m) => (
            <MilestoneLane
              key={m.id}
              milestone={m}
              commits={milestoneCommits(index.commits, m.id)}
              features={sortFeatures(
                index.features.filter((f) => f.milestone === m.id && visible(f)),
                "activity",
              )}
              start={milestoneStart(index, m)}
              axis={axis}
              now={now}
              expanded={open[m.id] ?? m.status !== "released"}
              onToggle={() =>
                setOpen({ ...open, [m.id]: !(open[m.id] ?? m.status !== "released") })
              }
            />
          ))}

          <UnscheduledLane
            features={sortFeatures(loose.filter(visible), "activity")}
            hidden={loose.filter((f) => !visible(f)).length}
            onShowParked={() => setShowParked(true)}
          />
        </div>
      )}

      {!empty && <Legend />}
    </div>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={expanded ? "M2 3.5L5 6.5L8 3.5" : "M3.5 2L6.5 5L3.5 8"} />
    </svg>
  );
}

/** A milestone's span on the axis: first feature captured until its target (or release). */
function span(m: Milestone, start: string | null, axis: Axis): { left: number; right: number } {
  const endDate = m.status === "released" ? (m.released_at ?? m.target) : m.target;
  const end = endDate ? toMs(endDate) : axis.end;
  const begin = start ? toMs(start) : Math.min(end, axis.end);
  const [a, b] = begin <= end ? [begin, end] : [end, begin];
  return { left: pct(axis, a), right: pct(axis, b) };
}

function dateLine(m: Milestone, now: number): string {
  const released = releasedLabel(m);
  if (released !== null) return released;
  if (!m.target) return "No target date";
  return [shortDate(m.target), daysLeftLabel(m.target, now)].filter(Boolean).join(" · ");
}

function MilestoneLane({
  milestone: m,
  commits,
  features,
  start,
  axis,
  now,
  expanded,
  onToggle,
}: {
  milestone: Milestone;
  commits: Commit[];
  features: Feature[];
  start: string | null;
  axis: Axis;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { changed } = useIndexState();
  const { left, right } = span(m, start, axis);
  const counted = features.filter((f) => f.status !== "cancelled" && f.status !== "superseded");
  const toggle = (
    <button
      type="button"
      className="rm-toggle"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${m.id}`}
      onClick={onToggle}
    >
      <Chevron expanded={expanded} />
    </button>
  );
  const done = `${m.progress.done} of ${m.progress.total} done`;
  const offer = releaseOffer(m);

  if (!expanded) {
    const textLeft = right > 70;
    return (
      <div className={`rm-lane rm-lane-closed ${changed.has(m.id) ? "az-flash" : ""}`.trim()}>
        <div className="rm-label rm-label-closed">
          {toggle}
          <IdChip id={m.id} />
          <span className="rm-name-closed">{m.title}</span>
          <span className="rm-pill">
            <StatusPill look={MILESTONE_LOOK[m.status]} />
          </span>
        </div>
        <div className="rm-track rm-track-closed">
          <div
            className={`rm-bar ${m.status}`}
            style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%` }}
          />
          <span
            className="rm-bar-text"
            style={
              textLeft
                ? { right: `calc(${100 - left}% + 10px)` }
                : { left: `calc(${right}% + 10px)` }
            }
          >
            {dateLine(m, now)} · {done}
          </span>
        </div>
      </div>
    );
  }

  const target = m.target ? pct(axis, toMs(m.target)) : null;
  return (
    <div className={`rm-lane ${changed.has(m.id) ? "az-flash" : ""}`.trim()}>
      <div className="rm-label">
        <div className="rm-name-row">
          {toggle}
          <IdChip id={m.id} />
          <span className="rm-name">{m.title}</span>
        </div>
        <div className="rm-sub">
          <span className="rm-pill">
            <StatusPill look={MILESTONE_LOOK[m.status]} />
          </span>
          <span>{dateLine(m, now)}</span>
        </div>
        <div className="rm-sub">
          <StatusMixBar statuses={counted.map((f) => f.status)} width={100} height={5} />
          <span>{done}</span>
        </div>
        {offer && <ReleaseControl milestone={m} offer={offer} />}
        <LaneCommits commits={commits} />
      </div>
      <div className="rm-track rm-track-open">
        {target !== null && (
          <>
            <span className={`rm-diamond ${m.status}`} style={{ left: `${target}%` }} />
            <span
              className="rm-target"
              style={
                target > 80
                  ? { right: `calc(${100 - target}% + 12px)` }
                  : { left: `calc(${target}% + 12px)` }
              }
            >
              Target {shortDate(m.target)}
            </span>
          </>
        )}
        <div
          className={`rm-box ${m.status}`}
          style={{
            marginLeft: `min(${left}%, calc(100% - 220px))`,
            width: `${right - left}%`,
          }}
        >
          {features.map((f) => (
            <FeatureChip key={f.id} f={f} changed={changed.has(f.id)} />
          ))}
          {features.length === 0 && <span className="rm-empty">No features yet</span>}
        </div>
      </div>
    </div>
  );
}

/** The newest commits naming the milestone; the rest only counted, to keep lanes short. */
function LaneCommits({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) return null;
  const more = commits.length - MAX_LANE_COMMITS;
  return (
    <div className="rm-commits">
      {commits.slice(0, MAX_LANE_COMMITS).map((c) => (
        <span key={c.sha} className="rm-commit" title={c.subject}>
          <span className="az-mono rm-commit-sha">{c.sha}</span>{" "}
          <span className="rm-commit-subject">{c.subject}</span>
        </span>
      ))}
      {more > 0 && <span className="rm-commit-more">and {more} more</span>}
    </div>
  );
}

function UnscheduledLane({
  features,
  hidden,
  onShowParked,
}: {
  features: Feature[];
  hidden: number;
  onShowParked: () => void;
}) {
  const { changed } = useIndexState();
  if (features.length === 0 && hidden === 0) return null;
  return (
    <div className="rm-lane rm-lane-none">
      <div className="rm-label rm-label-none">
        <span className="rm-none-name">No milestone</span>
        <span className="ft-n">{features.length}</span>
      </div>
      <div className="rm-none-chips">
        {features.map((f) => (
          <FeatureChip key={f.id} f={f} changed={changed.has(f.id)} />
        ))}
        {features.length === 0 && (
          <span className="rm-empty">
            {plural(hidden, "parked feature")} hidden.{" "}
            <button type="button" className="rm-link-btn" onClick={onShowParked}>
              Show parked
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

const chipTone = (f: Feature) => (isParked(f) ? "parked" : f.status);

function FeatureChip({ f, changed }: { f: Feature; changed: boolean }) {
  const look = FEATURE_LOOK[f.status];
  const blocked = f.derived.blocked_by.length > 0;
  const className = ["rm-chip", `tone-${chipTone(f)}`, changed ? "az-flash" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <a
      className={className}
      href={href("features", f.id)}
      title={`${f.id} ${f.title} · ${look.label}`}
    >
      <StatusGlyph glyph={look.glyph} />
      <span className="az-mono rm-chip-id">{f.id}</span>
      <span className="rm-chip-title">{f.title}</span>
      {blocked && !isParked(f) && <span className="rm-chip-blocked">blocked</span>}
      {isParked(f) && <span className="rm-chip-parked">{look.label.toLowerCase()}</span>}
    </a>
  );
}

function ReleaseControl({ milestone: m, offer }: { milestone: Milestone; offer: ReleaseOffer }) {
  const { canAct, reason } = useCanAct();
  const run = useAction();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { why } = offer;
  const lead = releaseLead(m);

  const release = async () => {
    setBusy(true);
    const { action, ref, payload, expect } = releaseRequest(m);
    const result = await run(action, ref, payload, expect);
    setBusy(false);
    if (result.ok) setConfirming(false);
  };
  return (
    <div className="rm-release">
      <Button
        disabled={!canAct || !offer.enabled}
        title={why ?? reason ?? `Release ${m.id}`}
        onClick={() => setConfirming(true)}
      >
        Release…
      </Button>
      {why && <span className="rm-release-why">{why}</span>}
      {confirming && (
        <Dialog
          title={`Release ${m.id} ${m.title}?`}
          subtitle={`All ${plural(m.progress.total, "feature")} are done.`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="primary" disabled={busy} onClick={() => void release()}>
                Release milestone
              </Button>
            </>
          }
        >
          {lead && <p>{lead}</p>}
          Marks the milestone released today and records the date and the current commit in{" "}
          <code className="az-c">{m.file}</code>. Released milestones can't be reopened.
        </Dialog>
      )}
    </div>
  );
}

const LEGEND = [
  ...LIFECYCLE.map((s) => FEATURE_LOOK[s]),
  { glyph: FEATURE_LOOK.deferred.glyph, label: "Parked" },
];

function Legend() {
  return (
    <div className="rm-legend">
      <span className="rm-legend-item">
        <span className="rm-legend-diamond" aria-hidden="true" />
        Target date
      </span>
      <span className="rm-legend-item">
        <span className="rm-legend-today" aria-hidden="true" />
        Today
      </span>
      {LEGEND.map((look) => (
        <span key={look.label} className="rm-legend-item">
          <StatusGlyph glyph={look.glyph} />
          {look.label}
        </span>
      ))}
    </div>
  );
}
