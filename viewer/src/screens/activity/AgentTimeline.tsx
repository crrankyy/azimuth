import { Fragment, type ReactNode } from "react";
import { Segmented, Tag } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { AGENT_LOOK } from "../../lib/status";
import {
  RANGES,
  type TimelineLayout,
  type TimelineMarker,
  type TimelineRange,
  type TimelineRow,
  type TimelineSpan,
} from "./timeline";
import "./timeline.css";

/** The Agent timeline section: range toggle, ticks, now line, rows, legend and the earlier line. */
export function AgentTimeline({
  layout,
  range,
  onRange,
}: {
  layout: TimelineLayout;
  range: TimelineRange;
  onRange: (range: TimelineRange) => void;
}): ReactNode {
  const { window, rows, earlier } = layout;
  return (
    <section className="az-card tl" aria-label="Agent timeline">
      <div className="tl-head">
        <span className="az-eyebrow">Agent timeline</span>
        <span className="tl-range-label">
          {`${window.label} · each row is a session, indented rows are its subagents`}
        </span>
        <span className="spacer" />
        <Segmented options={RANGES} value={range} onChange={onRange} label="Range" />
      </div>
      <div className="tl-chart">
        <div className="tl-grid" aria-hidden="true">
          {window.ticks
            .filter((t) => t.left > 0)
            .map((t) => (
              <div key={t.label} className="tl-gridline" style={{ left: `${t.left}%` }} />
            ))}
          <div className="tl-now" style={{ left: `${layout.now}%` }}>
            <span>now</span>
          </div>
        </div>
        <div className="tl-axis" aria-hidden="true">
          <span />
          <div className="tl-ticks">
            {window.ticks.map((t) => (
              <span
                key={t.label}
                className="tl-tick"
                style={{
                  left: t.left > 0 ? `calc(${t.left}% + 4px)` : 0,
                  maxWidth: tickRoom(t.left, layout.now),
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        {rows.length > 0 ? (
          groupClasses(rows).map(({ row, group }) => <Row key={row.key} row={row} group={group} />)
        ) : (
          <p className="tl-empty">No agent sessions in this range.</p>
        )}
      </div>
      <div className="tl-legend">
        <Legend rows={rows} />
        <span className="spacer" />
        {earlier.length > 0 && (
          <span className="tl-earlier">
            Earlier today:{" "}
            {earlier.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 && ", "}
                <a className="az-mono" href={e.href}>
                  {e.id}
                </a>
                {` · ${e.label}`}
              </Fragment>
            ))}
          </span>
        )}
      </div>
    </section>
  );
}

/** Each row with its session's status, so a running session's subagent rows share its tint. */
function groupClasses(rows: TimelineRow[]): { row: TimelineRow; group: string }[] {
  let group = "";
  return rows.map((row) => {
    if (row.depth === 0) group = row.status;
    return { row, group };
  });
}

/**
 * How wide a tick label may be so the now label (20 px either side of the line) never covers it.
 * Before the line, the room runs from the label (4 px past its tick) to 2 px short of the now
 * label. After it, a label that would start under the now label gets none: calc() can't branch,
 * so the gap is scaled up, which a negative max-width clamps to 0 and any clearance makes ample. A
 * label without room wraps out of sight (timeline.css) instead of being cut.
 */
function tickRoom(left: number, now: number): string {
  const gap = Math.round((now - left) * 100) / 100;
  if (gap > 0) return `calc(${gap}% - 26px)`;
  return `calc((${-gap}% - 18px) * 1000)`;
}

function Row({ row, group }: { row: TimelineRow; group: string }) {
  const base = row.spans[0];
  const end = base ? base.left + base.width : 0;
  return (
    <a className={`tl-row d${row.depth} s-${row.status} g-${group}`} href={row.href} title={row.id}>
      <span className="tl-label">
        {row.depth === 0 ? <SessionLabel row={row} /> : <SubagentLabel row={row} />}
      </span>
      <span className="tl-track">
        {row.spans.map((span, i) => (
          <Span key={i} span={span} />
        ))}
        {row.markers.map((marker) => (
          <Marker key={`${marker.kind}-${marker.id}`} marker={marker} />
        ))}
        {row.action && (
          <span
            className="tl-action"
            title={row.actionTitle ?? undefined}
            style={{ left: `calc(${end}% + 8px)`, maxWidth: `calc(${100 - end}% - 8px)` }}
          >
            {row.action}
          </span>
        )}
      </span>
    </a>
  );
}

/** The mark is decorative: the status words beside it say the same. */
function SessionLabel({ row }: { row: TimelineRow }) {
  return (
    <>
      {row.status === "open" ? (
        <StatusGlyph glyph="s-open" label="Open" />
      ) : (
        <span className={AGENT_LOOK[row.status].mark} aria-hidden="true" />
      )}
      <span className="az-mono tl-name">{row.name}</span>
      {row.skill && <Tag>{row.skill}</Tag>}
      {row.feature && <span className="az-id">{row.feature}</span>}
      <span className="tl-status">{row.statusLabel}</span>
    </>
  );
}

function SubagentLabel({ row }: { row: TimelineRow }) {
  return (
    <>
      <span className="tl-twig" aria-hidden="true">
        └
      </span>
      <span className="az-mono tl-name">{row.name}</span>
      {row.detail && <span className="tl-detail">{row.detail}</span>}
      <span className="tl-status">{row.statusLabel}</span>
    </>
  );
}

function Span({ span }: { span: TimelineSpan }) {
  return (
    <span
      className={`tl-span k-${span.kind}${span.kind === "waiting" ? " az-stripe" : ""}`}
      style={{ left: `${span.left}%`, width: `${span.width}%` }}
      role="img"
      aria-label={span.title}
      title={span.title}
    />
  );
}

function Marker({ marker }: { marker: TimelineMarker }) {
  return (
    <>
      <span
        className={`tl-mark m-${marker.kind}`}
        style={{ left: `${marker.left}%` }}
        role="img"
        aria-label={marker.title}
        title={marker.title}
      />
      {marker.kind === "run-fail" && (
        // The ✕ shows a failure without colour; the marker's label already says it.
        <span
          className="tl-mark-label"
          style={{ left: `calc(${marker.left}% + 8px)` }}
          aria-hidden="true"
        >
          {`${marker.id} ✕`}
        </span>
      )}
    </>
  );
}

/** Every colour and shape on the timeline, named; Open only when an open row is shown. */
function Legend({ rows }: { rows: TimelineRow[] }) {
  const open = rows.some((r) => r.status === "open");
  return (
    <>
      <LegendItem swatch="k-running">Running</LegendItem>
      <LegendItem swatch="k-waiting az-stripe">Waiting on you</LegendItem>
      <LegendItem swatch="k-done">Finished</LegendItem>
      {open && <LegendItem swatch="k-open">Open, no live data</LegendItem>}
      <LegendItem swatch="m-commit">Commit</LegendItem>
      <LegendItem swatch="m-run-pass">Run passed</LegendItem>
      <LegendItem swatch="m-run-fail">Run failed</LegendItem>
      <LegendItem swatch="m-question">Raised a question or ADR</LegendItem>
    </>
  );
}

function LegendItem({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="tl-legend-item">
      <span className={`tl-swatch ${swatch}`} aria-hidden="true" />
      {children}
    </span>
  );
}
