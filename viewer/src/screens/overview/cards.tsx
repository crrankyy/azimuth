import type { ReactNode } from "react";
import type {
  Feature,
  FeatureStatus,
  Index,
  Issue,
  Level,
  Severity,
} from "../../../../src/core/types";
import { Icon } from "../../components/Icon";
import { IdChip } from "../../components/IdChip";
import { Button, Card, Eyebrow, FlagBadge } from "../../components/primitives";
import { StatusGlyph, StatusPill } from "../../components/Status";
import { useUi } from "../../components/Ui";
import { questionLook } from "../../data/selectors";
import {
  age,
  clock,
  daysUntil,
  localDay,
  plural,
  shortDate,
  shortDuration,
} from "../../lib/format";
import { href, routeForId } from "../../lib/router";
import { FEATURE_LOOK, LIFECYCLE, MILESTONE_LOOK, PARKED } from "../../lib/status";
import { isRetired, orderedMilestones } from "../features/model";
import { CoverageMini, StatusMixBar } from "../features/parts";
import { recentActivity } from "./activity";

/** Card heading: eyebrow, optional count, optional link on the right. */
function CardHead({ title, meta, link }: { title: string; meta?: ReactNode; link?: ReactNode }) {
  return (
    <div className="ov-head">
      <Eyebrow>{title}</Eyebrow>
      {meta !== undefined && <span className="ov-meta">{meta}</span>}
      <span className="spacer" />
      {link}
    </div>
  );
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="ov-link" href={to}>
      {children}
    </a>
  );
}

/** A mono ID that links to its screen, without the chip box (dense rows). */
function IdLink({ id }: { id: string }) {
  return (
    <a className="az-mono ov-idlink" href={routeForId(id)}>
      {id}
    </a>
  );
}

/** Reverse lifecycle (done first), then parked, as the handoff's status bar reads. */
const STATUS_BAR: (FeatureStatus | "parked")[] = [...[...LIFECYCLE].reverse(), "parked"];

export function FeaturesByStatus({ features }: { features: Feature[] }) {
  const countOf = (s: FeatureStatus | "parked") =>
    features.filter((f) => (s === "parked" ? PARKED.includes(f.status) : f.status === s)).length;
  const runs = STATUS_BAR.map((s) => ({ s, n: countOf(s) })).filter((r) => r.n > 0);
  const look = (s: FeatureStatus | "parked") =>
    s === "parked" ? { glyph: "s-muted", label: "Parked", segment: "c-muted" } : FEATURE_LOOK[s];
  const label = runs.map((r) => `${r.n} ${look(r.s).label.toLowerCase()}`).join(", ");
  return (
    <Card className="ov-card ov-status">
      <CardHead
        title="Features by status"
        meta={plural(features.length, "feature")}
        link={<CardLink to={href("features")}>Open Features</CardLink>}
      />
      <span className="az-cov ov-status-bar" role="img" aria-label={label}>
        {runs.map((r) => (
          <span key={r.s} className={look(r.s).segment} style={{ flexGrow: r.n }} />
        ))}
      </span>
      <div className="ov-legend">
        {STATUS_BAR.map((s) => (
          <span key={s} className="ov-legend-item">
            <StatusGlyph glyph={look(s).glyph} />
            {look(s).label} <b>{countOf(s)}</b>
            {s === "parked" && <span className="ov-faint">deferred, cancelled, superseded</span>}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** Work in flight leads a milestone's list; finished and parked work trails. */
const MILESTONE_LIST: FeatureStatus[] = [
  "verifying",
  "in-progress",
  "approved",
  "draft",
  "idea",
  "done",
  ...PARKED,
];

export function ActiveMilestone({ index, now }: { index: Index; now: number }) {
  const m = orderedMilestones(index.milestones).find((x) => x.status !== "released");
  if (!m) {
    return (
      <Card className="ov-card ov-raised">
        <CardHead title="Active milestone" />
        <p className="ov-empty">
          No active or planned milestone. Released work shows on the Roadmap.
        </p>
      </Card>
    );
  }
  const members = index.features.filter((f) => f.milestone === m.id && !isRetired(f));
  const days = daysUntil(m.target, now);
  const listed = [...members].sort(
    (a, b) => MILESTONE_LIST.indexOf(a.status) - MILESTONE_LIST.indexOf(b.status),
  );
  return (
    <Card className="ov-card ov-raised">
      <CardHead
        title={m.status === "active" ? "Active milestone" : "Next milestone"}
        link={
          <span className="ov-pill">
            <StatusPill look={MILESTONE_LOOK[m.status]} />
          </span>
        }
      />
      <div className="ov-stack-4">
        <div className="row">
          <IdChip id={m.id} />
          <span className="ov-ms-title">{m.title}</span>
        </div>
        {m.goal && <p className="ov-goal">{m.goal}</p>}
      </div>
      <div className="ov-figures">
        <div>
          <div className="ov-big">{days === null ? "—" : Math.abs(days)}</div>
          <div className="ov-caption">
            {days === null
              ? "no target date"
              : `${days >= 0 ? "days left" : "days overdue"} · ${shortDate(m.target)}`}
          </div>
        </div>
        <div>
          <div className="ov-big">
            {m.progress.done}
            <span className="ov-big-of"> / {m.progress.total}</span>
          </div>
          <div className="ov-caption">features done</div>
        </div>
      </div>
      <StatusMixBar statuses={members.map((f) => f.status)} height={6} />
      <div className="ov-rows">
        {listed.slice(0, 6).map((f) => (
          <div key={f.id} className="ov-ms-row">
            <StatusGlyph glyph={FEATURE_LOOK[f.status].glyph} />
            <IdChip id={f.id} />
            <span className="ov-ellipsis">{f.title}</span>
            {f.derived.blocked_by.length > 0 ? (
              <span className="ov-danger-text">Blocked</span>
            ) : (
              <span className="ov-small">{FEATURE_LOOK[f.status].label}</span>
            )}
          </div>
        ))}
        {listed.length > 6 && (
          <span className="ov-faint">{listed.length - 6} more on the Roadmap</span>
        )}
      </div>
    </Card>
  );
}

export function ScenarioCoverage({ features }: { features: Feature[] }) {
  const counted = features.filter((f) => !isRetired(f));
  const sum = (pick: (f: Feature) => number) => counted.reduce((n, f) => n + pick(f), 0);
  const total = {
    passing: sum((f) => f.derived.coverage.passing),
    failing: sum((f) => f.derived.coverage.failing),
    not_run: sum((f) => f.derived.coverage.not_run),
    untested: sum((f) => f.derived.coverage.untested),
    total: sum((f) => f.derived.coverage.total),
  };
  const open = counted
    .filter((f) => f.status !== "done" && f.derived.coverage.total > 0)
    .sort((a, b) => {
      const x = a.derived.coverage;
      const y = b.derived.coverage;
      return y.failing - x.failing || y.passing - x.passing || y.total - x.total;
    });
  const done = counted.filter((f) => f.status === "done");
  const donePassing = done.reduce((n, f) => n + f.derived.coverage.passing, 0);
  const doneTotal = done.reduce((n, f) => n + f.derived.coverage.total, 0);
  const MAX = 6;
  return (
    <Card className="ov-card">
      <CardHead
        title="Scenario coverage"
        link={<CardLink to={href("verification")}>Verification</CardLink>}
      />
      <div className="ov-baseline">
        <span className="ov-big">{total.passing}</span>
        <span className="ov-sub">of {plural(total.total, "scenario")} passing</span>
      </div>
      <CoverageMini coverage={total} height={10} />
      <div className="ov-cov-legend">
        <span>
          <StatusGlyph glyph="s-done" />
          {total.passing} passing
        </span>
        <span>
          <StatusGlyph glyph="s-failing" />
          {total.failing} failing
        </span>
        <span>
          <StatusGlyph glyph="s-untested" />
          {total.untested} untested
        </span>
        <span>
          <StatusGlyph glyph="s-notrun" />
          {total.not_run} not run
        </span>
      </div>
      {open.length > 0 && (
        <div className="ov-cov-rows">
          {open.slice(0, MAX).map((f) => {
            const c = f.derived.coverage;
            return (
              <div key={f.id} className="ov-cov-row">
                <IdChip id={f.id} />
                <CoverageMini coverage={c} height={6} />
                <span className="ov-cov-num">
                  {c.passing} / {c.total}
                  {c.failing > 0 && ` · ${c.failing} failing`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="ov-faint">
        {open.length > MAX && `${open.length - MAX} more not done · `}
        {done.length > 0 &&
          `${plural(done.length, "done feature")}: ${donePassing} of ${doneTotal} passing`}
      </div>
    </Card>
  );
}

export function OpenQuestions({ index, now }: { index: Index; now: number }) {
  const open = index.questions
    .filter((q) => q.status === "open")
    .sort(
      (a, b) => Number(b.blocking) - Number(a.blocking) || b.raised_at.localeCompare(a.raised_at),
    );
  const applied = index.questions.filter((q) => q.status === "answered" && q.resolution);
  const waiting = index.questions.filter((q) => q.status === "answered" && !q.resolution);
  const MAX = 3;
  return (
    <Card className="ov-card">
      <CardHead
        title="Open questions"
        meta={open.length}
        link={<CardLink to={href("questions")}>Questions</CardLink>}
      />
      {open.length === 0 && (
        <p className="ov-empty">No open questions. Agents aren't waiting on you.</p>
      )}
      {open.slice(0, MAX).map((q) => (
        <a
          key={q.id}
          className={`ov-q ${q.blocking ? "blocking" : ""}`.trim()}
          href={href("questions", q.id)}
        >
          <span className="ov-q-top">
            <StatusGlyph glyph={questionLook(q).glyph} />
            <span className="az-id">{q.id}</span>
            {q.blocking ? (
              <span className="ov-danger-text">Blocking {q.feature ?? "work"}</span>
            ) : (
              <span className="ov-small">
                {q.feature ? `${q.feature} · not blocking` : "Not blocking"}
              </span>
            )}
            <span className="spacer" />
            <span className="ov-faint">{age(q.raised_at, now)}</span>
          </span>
          <span className="ov-q-title">{q.title}</span>
        </a>
      ))}
      {open.length > MAX && <span className="ov-faint">{open.length - MAX} more open</span>}
      {applied.length > 0 && (
        <div className="ov-faint">
          {applied.length} answered and applied (
          {applied
            .slice(0, 2)
            .map((q) => `${q.id} → ${q.resolution?.ref}`)
            .join(", ")}
          {applied.length > 2 && ", …"})
        </div>
      )}
      {waiting.length > 0 && (
        <div className="ov-faint">
          {plural(waiting.length, "answer")} waiting for an agent to apply
        </div>
      )}
    </Card>
  );
}

const SEVERITY_ROWS: { severity: Severity; label: string; tone: string }[] = [
  { severity: "critical", label: "Critical", tone: "danger" },
  { severity: "high", label: "High", tone: "danger" },
  { severity: "medium", label: "Medium", tone: "warning" },
  { severity: "low", label: "Low", tone: "neutral" },
];
const LEVEL: Record<Level, number> = { low: 1, medium: 2, high: 3 };
const riskScore = (i: Issue) => LEVEL[i.likelihood ?? "low"] * LEVEL[i.impact ?? "low"];
const isOpenIssue = (i: Issue) => i.status === "open" || i.status === "in-progress";

export function OpenIssues({ index }: { index: Index }) {
  const open = index.issues.filter(isOpenIssue);
  const issues = open.filter((i) => i.type !== "risk");
  const risks = open.filter((i) => i.type === "risk").sort((a, b) => riskScore(b) - riskScore(a));
  const bySeverity = (s: Severity) => issues.filter((i) => i.severity === s).length;
  const rows = SEVERITY_ROWS.filter((r) => r.severity !== "critical" || bySeverity("critical") > 0);
  const severe = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const notable = [...severe, ...risks].slice(0, 4);
  return (
    <Card className="ov-card">
      <CardHead
        title="Open issues"
        meta={`${issues.length} · ${plural(risks.length, "risk")}`}
        link={<CardLink to={href("issues")}>Issues</CardLink>}
      />
      <div className="ov-sev">
        {rows.map((r) => {
          const n = bySeverity(r.severity);
          const pct = issues.length ? (n / issues.length) * 100 : 0;
          return (
            <div key={r.severity} className="ov-sev-row">
              <span className="ov-sev-label">{r.label}</span>
              <span className="az-prog ov-sev-bar">
                <span className={`ov-tone-${r.tone}`} style={{ width: `${pct}%` }} />
              </span>
              <span className={`ov-sev-n ${n === 0 ? "zero" : ""}`.trim()}>{n}</span>
            </div>
          );
        })}
      </div>
      <div className="ov-issue-list">
        {notable.length === 0 && (
          <span className="ov-faint">No high-severity issues or open risks.</span>
        )}
        {notable.map((i) => (
          <div key={i.id} className="ov-issue">
            <StatusGlyph glyph={i.type === "risk" ? "s-open ov-risk-glyph" : "s-blocked"} />
            <IdChip id={i.id} />
            <span className="ov-issue-title">
              {i.title}
              {i.type === "risk" && (
                <span className="ov-sub-inline">
                  {" "}
                  · {i.likelihood ?? "?"} × {i.impact ?? "?"}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RecentRuns({ index, now }: { index: Index; now: number }) {
  const runs = [...index.runs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  return (
    <Card className="ov-card">
      <CardHead
        title="Recent verify runs"
        link={<CardLink to={href("verification")}>All runs</CardLink>}
      />
      {runs.length === 0 && <p className="ov-empty">No verify runs yet.</p>}
      <div className="ov-runs">
        {runs.map((r) => (
          <div key={r.id} className="ov-run">
            <StatusGlyph glyph={r.ok ? "s-done" : "s-failing"} label={r.ok ? "Passed" : "Failed"} />
            <IdLink id={r.id} />
            <IdLink id={r.target} />
            <span className={r.ok ? "ov-run-ok" : "ov-danger-text"}>
              {r.ok ? `passed · ${shortDuration(r.duration_ms)}` : `failed · exit ${r.exit_code}`}
            </span>
            <span className="ov-faint">{age(r.at, now)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ArchitectureFreshness({ index }: { index: Index }) {
  const arch = index.knowledge.architecture;
  const behind = arch.commits_since_reconciled;
  const stale = index.problems.some((p) => p.code === "W-ARCH-STALE");
  const file = arch.file.split("/").pop() ?? arch.file;
  const commits = plural(behind, "commit");
  return (
    <Card className="ov-card">
      <Eyebrow>Architecture freshness</Eyebrow>
      <span className="ov-flag">
        {stale ? (
          <FlagBadge>
            <Icon name="issues" size={13} />
            Stale · {commits} since last reconciled
          </FlagBadge>
        ) : (
          <FlagBadge tone="info">
            {behind > 0 ? `${commits} since last reconciled` : "Up to date"}
          </FlagBadge>
        )}
      </span>
      <div className="ov-text">
        {arch.reconciled_at ? (
          <>
            {file} reconciled at <span className="az-mono ov-sha">{arch.reconciled_at}</span>
            {arch.updated && ` on ${shortDate(arch.updated)}`}.
          </>
        ) : (
          `${file} hasn't been reconciled with the code yet.`
        )}
      </div>
      <CardLink to={href("knowledge", "architecture")}>Open Architecture</CardLink>
    </Card>
  );
}

export function ProblemsCard({ index }: { index: Index }) {
  const { setProblemsOpen } = useUi();
  const errors = index.problems.filter((p) => p.severity === "error").length;
  const warnings = index.problems.length - errors;
  return (
    <Card className="ov-card">
      <Eyebrow>Problems</Eyebrow>
      <div className="ov-problems">
        <span>
          <StatusGlyph glyph={errors > 0 ? "s-failing" : "s-done"} />
          {plural(errors, "error")}
        </span>
        <span>
          <span className="ov-warn" aria-hidden="true" />
          {plural(warnings, "warning")}
        </span>
      </div>
      <Button className="ov-self-start" onClick={() => setProblemsOpen(true)}>
        Open problems
      </Button>
    </Card>
  );
}

export function RecentActivity({ index, now }: { index: Index; now: number }) {
  const today = localDay(new Date(now).toISOString());
  const lines = recentActivity(index, 6);
  return (
    <Card className="ov-card">
      <CardHead
        title="Recent activity"
        link={<CardLink to={href("activity")}>Activity</CardLink>}
      />
      {lines.length === 0 && <p className="ov-empty">Nothing has happened yet.</p>}
      <div className="ov-activity">
        {lines.map((l) => (
          <div key={`${l.kind}-${l.id}-${l.at}`} className="ov-act-row">
            <span className="ov-act-time">
              {localDay(l.at) === today ? clock(l.at) : shortDate(l.at)}
            </span>
            {l.glyph === "commit" ? (
              <span className="ov-commit" aria-hidden="true">
                <span />
              </span>
            ) : (
              <StatusGlyph glyph={l.glyph} />
            )}
            <span className="ov-act-text">
              {l.lead && `${l.lead} `}
              <IdLink id={l.id} /> {l.rest}
            </span>
            <span className="ov-faint">{l.kind}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
