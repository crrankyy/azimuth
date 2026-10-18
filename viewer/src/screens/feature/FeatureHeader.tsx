import type { ReactNode } from "react";
import { PRIORITIES, type Feature, type Index } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { Icon } from "../../components/Icon";
import {
  CoverageBar,
  coverageSummary,
  FlagBadge,
  ProgressBar,
  Tag,
} from "../../components/primitives";
import { FeatureStatusPill, StatusGlyph } from "../../components/Status";
import { useAction } from "../../components/Ui";
import { useIndexState } from "../../data/IndexProvider";
import { featureById, milestoneById } from "../../data/selectors";
import { ago, shortDate } from "../../lib/format";
import { FEATURE_LOOK } from "../../lib/status";

export function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={up ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
    </svg>
  );
}

/** A tag-styled control with a native select laid over it, so it stays keyboard-accessible. */
function Picker({
  className,
  label,
  value,
  options,
  onPick,
  children,
}: {
  className: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  children: ReactNode;
}) {
  const { canAct, reason } = useCanAct();
  return (
    <span className={`fd-pick ${className}`} title={canAct ? label : (reason ?? undefined)}>
      {children}
      {canAct && <Chevron />}
      <select
        aria-label={label}
        value={value}
        disabled={!canAct}
        onChange={(e) => onPick(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function PriorityPicker({ f }: { f: Feature }) {
  const run = useAction();
  return (
    <Picker
      className={`az-prio ${f.priority === "P0" ? "p0" : ""}`}
      label={`Priority ${f.priority}, change`}
      value={f.priority}
      options={PRIORITIES.map((p) => ({ value: p, label: p }))}
      onPick={(value) => void run("set", f.id, { field: "priority", value })}
    >
      {f.priority}
    </Picker>
  );
}

function MilestonePicker({ f, index }: { f: Feature; index: Index }) {
  const run = useAction();
  const m = f.milestone ? milestoneById(index, f.milestone) : undefined;
  const options = [
    { value: "", label: "No milestone" },
    ...index.milestones.map((x) => ({ value: x.id, label: `${x.id} ${x.title}` })),
  ];
  return (
    <Picker
      className="fd-ms"
      label={`Milestone ${f.milestone ?? "none"}, change`}
      value={f.milestone ?? ""}
      options={options}
      onPick={(value) => void run("set", f.id, { field: "milestone", value: value || null })}
    >
      {f.milestone ? (
        <>
          <span className="az-mono fd-ms-id">{f.milestone}</span>
          {m?.title}
        </>
      ) : (
        <span className="fd-ms-none">No milestone</span>
      )}
    </Picker>
  );
}

function WarnIcon() {
  return <Icon name="issues" size={13} />;
}

/** Derived flags, each stating its reason. */
function FeatureFlags({ f, index, now }: { f: Feature; index: Index; now: number }) {
  const d = f.derived;
  const flags: ReactNode[] = [];
  const questions = d.blocked_by.filter((b) => b.kind === "question").map((b) => b.id);
  const deps = d.blocked_by.filter((b) => b.kind === "dependency").map((b) => b.id);
  if (questions.length) {
    flags.push(
      <FlagBadge key="bq" tone="danger">
        <StatusGlyph glyph="s-blocked" />
        <span>
          <b>Blocked:</b> open blocking {questions.length === 1 ? "question" : "questions"}{" "}
          <Chips ids={questions} />
        </span>
      </FlagBadge>,
    );
  }
  if (deps.length) {
    flags.push(
      <FlagBadge key="bd" tone="danger">
        <StatusGlyph glyph="s-blocked" />
        <span>
          <b>Blocked:</b> waiting on{" "}
          {deps.map((id, i) => {
            const dep = featureById(index, id);
            return (
              <span key={id}>
                {i > 0 && ", "}
                <IdChip id={id} className="fd-flag-id" />
                {dep && ` (${FEATURE_LOOK[dep.status].label.toLowerCase()})`}
              </span>
            );
          })}
        </span>
      </FlagBadge>,
    );
  }
  if (d.modified_since_approval) {
    const files = [...new Set(d.approval_changes.map((c) => c.path.split("/").pop()))];
    const last = d.approval_changes
      .map((c) => c.at)
      .filter(Boolean)
      .sort()
      .pop();
    flags.push(
      <FlagBadge key="mod">
        <WarnIcon />
        <span>
          <b>Modified since approval{files.length ? ":" : ""}</b>{" "}
          {[files.join(", "), shortDate(last)].filter(Boolean).join(", ")}
        </span>
      </FlagBadge>,
    );
  }
  if (d.stale) {
    flags.push(
      <FlagBadge key="stale">
        <WarnIcon />
        <span>
          <b>Stale:</b> no activity for {ago(d.last_activity, now).replace(" ago", "")}
        </span>
      </FlagBadge>,
    );
  }
  for (const c of d.file_conflicts) {
    flags.push(
      <FlagBadge key={`fc-${c.path}-${c.with}`}>
        <WarnIcon />
        <span>
          <b>File conflict:</b> <span className="az-c">{c.path}</span> is also changed by{" "}
          <IdChip id={c.with} className="fd-flag-id" />
        </span>
      </FlagBadge>,
    );
  }
  if (f.approved_by === "agent" && !f.review_ack_at) {
    flags.push(
      <FlagBadge key="auto" tone="info">
        <Icon name="checkCircle" size={13} />
        <span>
          <b>Approved automatically</b> by an agent · not reviewed yet
        </span>
      </FlagBadge>,
    );
  }
  if (f.superseded_by) {
    flags.push(
      <FlagBadge key="sup" tone="info">
        <StatusGlyph glyph="s-muted" />
        <span>
          <b>Superseded by</b> <IdChip id={f.superseded_by} className="fd-flag-id" />
        </span>
      </FlagBadge>,
    );
  }
  return <>{flags}</>;
}

function Chips({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          <IdChip id={id} className="fd-flag-id" />
        </span>
      ))}
    </>
  );
}

function Metrics({ f }: { f: Feature }) {
  const { progress, coverage } = f.derived;
  return (
    <>
      <div className="fd-metric">
        <span className="fd-metric-label">Tasks</span>
        {progress.total > 0 ? (
          <>
            <ProgressBar done={progress.done} total={progress.total} width={96} />
            <span className="fd-metric-value">
              {progress.done} / {progress.total}
            </span>
          </>
        ) : (
          <span className="fd-metric-none">No plan yet</span>
        )}
      </div>
      <div className="fd-metric">
        <span className="fd-metric-label">Scenarios</span>
        {coverage.total > 0 ? (
          <>
            <CoverageBar coverage={coverage} width={136} />
            <span className="fd-metric-cov">{coverageSummary(coverage)}</span>
          </>
        ) : (
          <span className="fd-metric-none">No scenarios yet</span>
        )}
      </div>
    </>
  );
}

function headerMeta(f: Feature, now: number): string {
  const when = f.approved_at
    ? `Approved ${shortDate(f.approved_at)}${f.approved_by === "agent" ? " by an agent" : ""}`
    : `Created ${shortDate(f.created)}`;
  const activity = f.derived.last_activity
    ? `last activity ${ago(f.derived.last_activity, now)}`
    : "";
  return [when, activity].filter(Boolean).join(" · ");
}

/** ID, status, priority, size, milestone and tags; then title, summary, flags and progress. */
export function FeatureHeader({ f }: { f: Feature }) {
  const { index, now, changed } = useIndexState();
  if (!index) return null;
  return (
    <div className={`fd-head ${changed.has(f.id) ? "az-flash" : ""}`.trim()}>
      <div className="fd-chips">
        <span className="az-id lg fd-head-id">{f.id}</span>
        <FeatureStatusPill status={f.status} />
        <PriorityPicker f={f} />
        {f.size && (
          <span className="az-prio" title="Size">
            Size {f.size}
          </span>
        )}
        <MilestonePicker f={f} index={index} />
        {f.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <span className="spacer" />
        <span className="fd-meta">{headerMeta(f, now)}</span>
      </div>
      <h1 className="fd-title">{f.title}</h1>
      {f.summary && <p className="fd-summary">{f.summary}</p>}
      <div className="fd-metrics">
        <FeatureFlags f={f} index={index} now={now} />
        <Metrics f={f} />
      </div>
    </div>
  );
}
