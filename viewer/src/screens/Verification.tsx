import { Fragment, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type {
  Coverage,
  CoverageStatus,
  Feature,
  Index,
  Scenario,
  VerifyRun,
} from "../../../src/core/types";
import { Page } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { IdChip } from "../components/IdChip";
import {
  coverageSummary,
  EmptyState,
  Eyebrow,
  KindTag,
  SegmentBar,
  Segmented,
} from "../components/primitives";
import { RunResult, runFeature } from "../components/RunResult";
import { StatusGlyph } from "../components/Status";
import { useIndexState } from "../data/IndexProvider";
import { age, plural, shortDuration } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { href, navigate, routeForId, type Route } from "../lib/router";
import { COVERAGE_LOOK, FEATURE_LOOK, PARKED } from "../lib/status";
import { UNCOMMITTED_TITLE } from "./feature/StoriesTab";
import "./verification.css";

type Filter = "all" | "gaps";

const byNewest = (a: VerifyRun, b: VerifyRun) => Date.parse(b.at) - Date.parse(a.at);
const gaps = (c: Coverage) => c.total - c.passing;
const basename = (path: string) => path.split("/").pop() ?? path;

/** The newest run of a feature or any of its tasks (`runs` is newest first). */
function latestRun(runs: VerifyRun[], featureId: string): VerifyRun | undefined {
  return runs.find((r) => runFeature(r.target) === featureId);
}

/** Failing scenarios first, then a failing run, then the most gaps; fully passing last. */
function attention(f: Feature, runs: VerifyRun[]): number {
  const c = f.derived.coverage;
  if (c.failing > 0) return 0;
  if (latestRun(runs, f.id)?.ok === false) return 1;
  return gaps(c) > 0 ? 2 : 3;
}

/** Features with scenarios that still count (parked features are left out of the totals). */
function verifiable(index: Index, runs: VerifyRun[]): Feature[] {
  return index.features
    .filter((f) => !PARKED.includes(f.status) && f.derived.coverage.total > 0)
    .map((f) => ({ f, rank: attention(f, runs) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        gaps(b.f.derived.coverage) - gaps(a.f.derived.coverage) ||
        a.f.id.localeCompare(b.f.id),
    )
    .map((x) => x.f);
}

function sumCoverage(features: Feature[]): Coverage {
  const total: Coverage = { passing: 0, failing: 0, not_run: 0, untested: 0, total: 0 };
  for (const { derived: d } of features) {
    total.passing += d.coverage.passing;
    total.failing += d.coverage.failing;
    total.not_run += d.coverage.not_run;
    total.untested += d.coverage.untested;
    total.total += d.coverage.total;
  }
  return total;
}

function headline(c: Coverage): string {
  const parts = [
    `${c.passing} of ${plural(c.total, "scenario")} passing`,
    c.failing ? `${c.failing} failing` : null,
    c.not_run ? `${c.not_run} not run` : null,
    c.untested ? `${c.untested} untested` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** One segment per scenario, or a single bar when every scenario shares a status. */
function cardSegments(c: Coverage): string[] {
  const counts: [CoverageStatus, number][] = [
    ["passing", c.passing],
    ["failing", c.failing],
    ["not-run", c.not_run],
    ["untested", c.untested],
  ];
  const present = counts.filter(([, n]) => n > 0);
  if (present.length === 1) return [COVERAGE_LOOK[present[0]?.[0] ?? "untested"].segment];
  return present.flatMap(([s, n]) => Array<string>(n).fill(COVERAGE_LOOK[s].segment));
}

function coverageGlyph(c: Coverage): { glyph: string; label: string } {
  if (c.failing > 0) return { glyph: "s-failing", label: "Failing" };
  if (c.passing === c.total) return { glyph: "s-done", label: "Passing" };
  if (c.untested > 0) return { glyph: "s-untested", label: "Untested scenarios" };
  return { glyph: "s-notrun", label: "Not run" };
}

function cardText(f: Feature, run: VerifyRun | undefined): ReactNode {
  const c = f.derived.coverage;
  if (c.failing > 0) return `${c.passing} / ${c.total} passing · ${c.failing} failing`;
  if (run && !run.ok) {
    return (
      <>
        {c.passing} / {c.total} · <span className="vf-red">last run failed</span>
      </>
    );
  }
  return `${c.passing} / ${c.total} · ${FEATURE_LOOK[f.status].label.toLowerCase()}`;
}

function FeatureCard({
  feature,
  run,
  flash,
}: {
  feature: Feature;
  run?: VerifyRun;
  flash: boolean;
}) {
  const c = feature.derived.coverage;
  const g = coverageGlyph(c);
  const cls = `az-card vf-card ${c.failing ? "failing" : ""} ${flash ? "az-flash" : ""}`;
  return (
    <a className={cls.trim()} href={href("features", feature.id, "stories")} title={feature.title}>
      <span className="row">
        <span className="az-id">{feature.id}</span>
        <span className="spacer" />
        <StatusGlyph glyph={g.glyph} label={g.label} />
      </span>
      <SegmentBar segments={cardSegments(c)} height={6} />
      <span className="vf-card-text">{cardText(feature, run)}</span>
    </a>
  );
}

/** Done features that pass everything share one card, so the row stays about active work. */
function DoneCard({ features }: { features: Feature[] }) {
  const c = sumCoverage(features);
  const first = features[0]?.id ?? "";
  const last = features.at(-1)?.id ?? "";
  return (
    <div className="az-card vf-card" title={features.map((f) => `${f.id} ${f.title}`).join("\n")}>
      <span className="row">
        <span className="mono vf-range">
          {first} – {last}
        </span>
        <span className="spacer" />
        <StatusGlyph glyph="s-done" label="Passing" />
      </span>
      <SegmentBar segments={["c-pass"]} height={6} />
      <span className="vf-card-text">
        {c.passing} / {c.total} · done
      </span>
    </div>
  );
}

function SummaryCards({
  features,
  runs,
  changed,
}: {
  features: Feature[];
  runs: VerifyRun[];
  changed: Set<string>;
}) {
  const done = features.filter(
    (f) => f.status === "done" && f.derived.coverage.passing === f.derived.coverage.total,
  );
  const grouped = done.length > 1 ? new Set(done.map((f) => f.id)) : new Set<string>();
  return (
    <div className="vf-cards">
      {features
        .filter((f) => !grouped.has(f.id))
        .map((f) => (
          <FeatureCard
            key={f.id}
            feature={f}
            run={latestRun(runs, f.id)}
            flash={changed.has(f.id)}
          />
        ))}
      {grouped.size > 0 && <DoneCard features={done} />}
    </div>
  );
}

function groupSummary(f: Feature, runs: VerifyRun[]): string {
  const c = f.derived.coverage;
  const n = plural(c.total, "scenario");
  if (c.passing === c.total) {
    const run = runs.find((r) => runFeature(r.target) === f.id && r.scenarios.length > 0);
    return `${n} · all passing${run?.commit ? ` at ${run.commit}` : ""}`;
  }
  if (c.untested === c.total) return `${n} · all untested`;
  return `${n} · ${coverageSummary(c)}`;
}

export function ScenarioRow({
  scenario,
  run,
  now,
  onRun,
}: {
  scenario: Scenario;
  run?: VerifyRun;
  now: number;
  onRun: (id: string) => void;
}) {
  const status = scenario.coverage.status;
  const look = COVERAGE_LOOK[status];
  const tests = scenario.coverage.tests;
  const first = tests[0];
  const uncommitted = tests.some((t) => t.committed === false);
  return (
    <div role="row" className={`vf-grid vf-scenario ${status}`}>
      <span role="cell" className="vf-scn">
        <a className="mono vf-sid" href={routeForId(scenario.id)}>
          {scenario.id}
        </a>
        <span className="vf-scn-title" title={scenario.title}>
          {scenario.title}
        </span>
      </span>
      <span role="cell" className="vf-cell">
        <KindTag kind={scenario.kind} />
      </span>
      <span role="cell" className="vf-cell vf-cov">
        <StatusGlyph glyph={look.glyph} />
        {look.label}
      </span>
      <span
        role="cell"
        className={`vf-cell mono vf-test ${first ? "" : "none"}`.trim()}
        title={
          tests
            .map((t) => `${t.file} › ${t.name}${t.committed === false ? " (uncommitted)" : ""}`)
            .join("\n") || undefined
        }
      >
        <span className="vf-test-name">
          {first ? basename(first.file) : "no test references it"}
          {tests.length > 1 && ` +${tests.length - 1}`}
        </span>
        {uncommitted && (
          <span className="az-tag vf-uncommitted" title={UNCOMMITTED_TITLE}>
            uncommitted
          </span>
        )}
      </span>
      <span role="cell" className="vf-cell vf-last">
        {run ? (
          <>
            <a className="mono" href={href("verification", run.id)} onClick={() => onRun(run.id)}>
              {run.id}
            </a>
            <span className="vf-age">{age(run.at, now)}</span>
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

function FeatureGroup({
  feature,
  open,
  filter,
  runs,
  now,
  flash,
  onToggle,
  onRun,
}: {
  feature: Feature;
  open: boolean;
  filter: Filter;
  runs: VerifyRun[];
  now: number;
  flash: boolean;
  onToggle: () => void;
  onRun: (id: string) => void;
}) {
  const expandable = Boolean(feature.detail);
  const shown = open && expandable;
  const onRowClick = (e: MouseEvent) => {
    if (!expandable || (e.target as HTMLElement).closest("a, button")) return;
    onToggle();
  };
  return (
    <div role="rowgroup" className={flash ? "az-flash" : undefined}>
      <div
        role="row"
        className={`vf-group ${shown ? "open" : ""} ${expandable ? "expandable" : ""}`.trim()}
        onClick={onRowClick}
      >
        <span role="rowheader" className="vf-group-cell">
          <button
            type="button"
            className="vf-chev"
            aria-expanded={shown}
            aria-label={`${shown ? "Collapse" : "Expand"} ${feature.id}`}
            disabled={!expandable}
            title={expandable ? undefined : "Scenario rows aren't in this index"}
            onClick={onToggle}
          >
            <Icon name={shown ? "chevronDown" : "chevronRight"} size={12} />
          </button>
          <IdChip id={feature.id} />
          <span className="vf-group-title">{feature.title}</span>
          {!shown && <span className="vf-group-sum">{groupSummary(feature, runs)}</span>}
        </span>
      </div>
      {shown &&
        feature.detail?.stories.map((story) => {
          const rows = story.scenarios.filter(
            (s) => filter === "all" || s.coverage.status !== "passing",
          );
          if (rows.length === 0) return null;
          return (
            <Fragment key={story.id}>
              <div role="row" className="vf-story">
                <span role="cell">
                  <span className="mono">{story.id}</span> · {story.title}
                </span>
              </div>
              {rows.map((s) => (
                <ScenarioRow
                  key={s.id}
                  scenario={s}
                  run={runs.find((r) => r.scenarios.some((x) => x.id === s.id))}
                  now={now}
                  onRun={onRun}
                />
              ))}
            </Fragment>
          );
        })}
    </div>
  );
}

/** Groups start open when they have failures, are being built, or hold the selected run. */
function openByDefault(f: Feature, focus: string | null): boolean {
  return f.derived.coverage.failing > 0 || f.status === "in-progress" || f.id === focus;
}

function CoverageMatrix({
  features,
  runs,
  now,
  changed,
  focus,
  onRun,
}: {
  features: Feature[];
  runs: VerifyRun[];
  now: number;
  changed: Set<string>;
  /** The feature of the open run. */
  focus: string | null;
  onRun: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const total = gaps(sumCoverage(features));
  const shown = filter === "all" ? features : features.filter((f) => gaps(f.derived.coverage) > 0);
  const isOpen = (f: Feature) => overrides.get(f.id) ?? openByDefault(f, focus);
  const toggle = (f: Feature) => setOverrides(new Map(overrides).set(f.id, !isOpen(f)));
  return (
    <section className="vf-matrix" aria-label="Coverage matrix">
      <div className="vf-matrix-head">
        <Eyebrow>Coverage matrix</Eyebrow>
        <span className="spacer" />
        <Segmented<Filter>
          label="Coverage filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "gaps", label: "Gaps", count: total },
          ]}
        />
      </div>
      <div role="table" aria-label="Scenario coverage" className="vf-table">
        <div role="row" className="vf-grid vf-th">
          <span role="columnheader">Scenario</span>
          <span role="columnheader">Kind</span>
          <span role="columnheader">Coverage</span>
          <span role="columnheader">Test</span>
          <span role="columnheader">Last run</span>
        </div>
        {shown.map((f) => (
          <FeatureGroup
            key={f.id}
            feature={f}
            open={isOpen(f)}
            filter={filter}
            runs={runs}
            now={now}
            flash={changed.has(f.id)}
            onToggle={() => toggle(f)}
            onRun={onRun}
          />
        ))}
        {shown.length === 0 && <div className="vf-none">No gaps: every scenario passes.</div>}
      </div>
    </section>
  );
}

function RunsList({
  runs,
  open,
  now,
  onToggle,
}: {
  runs: VerifyRun[];
  open: string | null;
  now: number;
  onToggle: (id: string) => void;
}) {
  return (
    <aside className="vf-runs" aria-label="Verify runs">
      <div className="row">
        <Eyebrow>Runs</Eyebrow>
        <span className="vf-count">{runs.length}</span>
      </div>
      {runs.length === 0 ? (
        <EmptyState title="No verify runs yet">
          Run <code className="az-c">azimuth verify</code> to record one.
        </EmptyState>
      ) : (
        <div className="vf-runlist">
          {runs.map((run) => {
            const expanded = run.id === open;
            return (
              <Fragment key={run.id}>
                <button
                  type="button"
                  className={`vf-run ${expanded ? "sel az-focus" : ""}`.trim()}
                  aria-expanded={expanded}
                  onClick={() => onToggle(run.id)}
                >
                  <StatusGlyph
                    glyph={run.ok ? "s-done" : "s-failing"}
                    label={run.ok ? "Passed" : "Failed"}
                  />
                  <span className="mono vf-run-id">{run.id}</span>
                  <span className="vf-run-sum">
                    <span className="mono">{run.target}</span> ·{" "}
                    <span className={run.ok ? undefined : "vf-red"}>
                      {run.ok ? "passed" : "failed"}
                    </span>{" "}
                    · {shortDuration(run.duration_ms)}
                  </span>
                  <span className="vf-age">{age(run.at, now)}</span>
                </button>
                {expanded && <RunResult run={run} now={now} variant="drawer" />}
              </Fragment>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export function VerificationScreen({ route }: { route: Route }) {
  const { index, now, changed } = useIndexState();
  const runs = useMemo(() => [...(index?.runs ?? [])].sort(byNewest), [index]);
  // The URL picks the open run (newest by default); collapsing one is local.
  const [closed, setClosed] = useState<string | null>(null);
  const selected = route.id ?? runs[0]?.id ?? null;
  const open = selected === closed ? null : selected;
  const select = (id: string) => {
    setClosed(null);
    navigate(href("verification", id));
  };
  const toggle = (id: string) => (id === open ? setClosed(id) : select(id));
  const pick = (i: number, act: (id: string) => void) => {
    const run = runs[i];
    if (run) act(run.id);
  };
  useListKeys({
    count: runs.length,
    selected: Math.max(
      0,
      runs.findIndex((r) => r.id === selected),
    ),
    onSelect: (i) => pick(i, select),
    onOpen: (i) => pick(i, toggle),
  });
  const features = useMemo(() => (index ? verifiable(index, runs) : []), [index, runs]);
  if (!index) return null;

  const openRun = runs.find((r) => r.id === open);
  return (
    <Page crumbs={[{ label: "Verification" }]}>
      <div className="vf">
        <div className="vf-title-row">
          <h1 className="page-title">Verification</h1>
          {features.length > 0 && <span className="vf-sub">{headline(sumCoverage(features))}</span>}
        </div>
        {features.length === 0 && runs.length === 0 ? (
          <EmptyState title="Nothing to verify yet">
            Scenarios and verify runs show up here once a feature has a spec. Run{" "}
            <code className="az-c">/azimuth:spec</code> in Claude Code to write one.
          </EmptyState>
        ) : (
          <>
            {features.length > 0 && (
              <SummaryCards features={features} runs={runs} changed={changed} />
            )}
            <div className="vf-cols">
              <CoverageMatrix
                features={features}
                runs={runs}
                now={now}
                changed={changed}
                focus={openRun ? runFeature(openRun.target) : null}
                onRun={select}
              />
              <RunsList runs={runs} open={open} now={now} onToggle={toggle} />
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
