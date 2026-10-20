import { useState, type ReactNode } from "react";
import { placeholderParts } from "../../../../src/core/placeholders";
import type {
  CoverageStatus,
  Feature,
  Scenario,
  ScenarioKind,
  ScenarioTest,
  Story,
  VerifyRun,
} from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { EmptyState, Eyebrow, KindTag, Segmented } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { ago, plural } from "../../lib/format";
import { COVERAGE_LOOK } from "../../lib/status";
import {
  countBy,
  COVERAGES,
  coverageBreakdown,
  failureLine,
  KINDS,
  latestRunFor,
  scenariosOf,
} from "./featureData";

type KindFilter = "all" | ScenarioKind;
type CoverageFilter = "all" | CoverageStatus;

/**
 * Placeholder values in scenario text. Marked by text as well as colour: a settled value carries
 * a ✓ and a title, an open one reads "to be settled".
 */
function placeholders(text: string): ReactNode[] {
  return placeholderParts(text).map((part, i) =>
    part.kind === "text" ? (
      part.text
    ) : part.kind === "settled" ? (
      <span key={i} className="fd-ph settled" title="settled by test">
        {part.value}
        <span className="fd-ph-mark" aria-hidden="true">
          ✓
        </span>
        <span className="sr-only"> (settled by test)</span>
      </span>
    ) : (
      <span key={i} className="fd-ph open" title="to be settled by the first passing test">
        to be settled
      </span>
    ),
  );
}

/**
 * Scenario text with `code` spans and placeholder values. Kept apart from the Markdown renderer on
 * purpose: GIVEN/WHEN/THEN lines are full of snake_case names that must not turn into emphasis.
 */
function gwt(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code key={i} className="az-c">
        {placeholders(part.slice(1, -1))}
      </code>
    ) : (
      placeholders(part)
    ),
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The title of a test's `uncommitted` tag, here and in the Verification table. */
export const UNCOMMITTED_TITLE = "Not committed: the done gate counts only tests in HEAD";

function chipLabel(s: Scenario): string {
  const { status, tests } = s.coverage;
  if (status === "untested") return "untested · no test references it";
  const uncommitted = tests.filter((t) => t.committed === false).length;
  const label = `${COVERAGE_LOOK[status].label} · ${plural(tests.length, "test")}`;
  return uncommitted > 0 ? `${label} · ${uncommitted} uncommitted` : label;
}

function TestRow({
  test,
  run,
  now,
}: {
  test: ScenarioTest;
  run: VerifyRun | undefined;
  now: number;
}) {
  const look = COVERAGE_LOOK[test.status];
  const failure = test.status === "failing" && run ? failureLine(run, test.name) : null;
  return (
    <li className="fd-test">
      <div className="fd-test-row">
        <StatusGlyph glyph={look.glyph} />
        <span className="az-mono fd-test-file">{test.file}</span>
        <span className="fd-test-name">{test.name}</span>
        {test.confidence === "fallback" && (
          <span
            className="fd-test-conf"
            title="Matched by file and name, not by a scenario ID marker"
          >
            fallback match
          </span>
        )}
        {test.committed === false && (
          <span className="az-tag fd-test-uncommitted" title={UNCOMMITTED_TITLE}>
            uncommitted
          </span>
        )}
        <span className="spacer" />
        <span className={`fd-test-status ${test.status}`}>{look.label}</span>
        {run && <IdChip id={run.id} />}
        {run && <span className="fd-test-age">{ago(run.at, now)}</span>}
      </div>
      {failure && <div className="az-mono fd-test-failure">{failure}</div>}
    </li>
  );
}

/** A scenario: ID, title, kind, GIVEN/WHEN/THEN and a coverage chip that expands to its tests. */
export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const { index, now } = useIndexState();
  const status = scenario.coverage.status;
  const [open, setOpen] = useState(
    status === "failing" || scenario.coverage.tests.some((t) => t.committed === false),
  );
  const run = index ? latestRunFor(index, scenario.id) : undefined;
  const panelId = `fd-tests-${scenario.id}`;
  return (
    <article className="fd-scenario" id={scenario.id}>
      <div className="fd-scenario-head">
        <IdChip id={scenario.id} />
        <span className="fd-scenario-title">{scenario.title}</span>
        <KindTag kind={scenario.kind} />
        <span className="spacer" />
        <button
          type="button"
          className={`fd-cov-chip ${status}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <StatusGlyph glyph={COVERAGE_LOOK[status].glyph} />
          <span>{chipLabel(scenario)}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d={open ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
          </svg>
        </button>
      </div>
      <dl className="az-gwt fd-gwt">
        <dt>GIVEN</dt>
        <dd>{gwt(scenario.given)}</dd>
        <dt>WHEN</dt>
        <dd>{gwt(scenario.when)}</dd>
        <dt>THEN</dt>
        <dd>{gwt(scenario.then)}</dd>
      </dl>
      {open && (
        <div className="fd-tests" id={panelId}>
          {scenario.coverage.tests.length === 0 ? (
            <div className="fd-tests-none">
              No test references {scenario.id} yet. Put the ID in a test title to link it.
            </div>
          ) : (
            <ul>
              {scenario.coverage.tests.map((t) => (
                <TestRow key={`${t.file}-${t.name}`} test={t} run={run} now={now} />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

/** A story's intent sentence, then its (filtered) ScenarioCards. */
export function StoryBlock({ story, scenarios }: { story: Story; scenarios: Scenario[] }) {
  return (
    <section className="fd-story" aria-labelledby={`${story.id}-title`}>
      <div className="fd-story-head">
        <IdChip id={story.id} />
        <h3 id={`${story.id}-title`}>{story.title}</h3>
        <span className="spacer" />
        <span className="fd-story-sum">
          {plural(story.scenarios.length, "scenario")}
          {story.scenarios.length > 0 && ` · ${coverageBreakdown(story.scenarios)}`}
        </span>
      </div>
      {story.intent && <p className="fd-story-intent">{story.intent}</p>}
      {scenarios.map((s) => (
        <ScenarioCard key={s.id} scenario={s} />
      ))}
    </section>
  );
}

export function StoriesTab({ f }: { f: Feature }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [coverage, setCoverage] = useState<CoverageFilter>("all");
  const stories = f.detail?.stories ?? [];
  const all = scenariosOf(f);
  if (stories.length === 0) {
    return <EmptyState title="No stories yet">The spec for {f.id} has no stories.</EmptyState>;
  }
  const kinds = countBy(all, (s) => s.kind);
  const covs = countBy(all, (s) => s.coverage.status);
  const matches = (s: Scenario) =>
    (kind === "all" || s.kind === kind) && (coverage === "all" || s.coverage.status === coverage);
  const visible = stories
    .map((story) => ({ story, scenarios: story.scenarios.filter(matches) }))
    .filter((x) => x.scenarios.length > 0);
  return (
    <div className="fd-stories">
      <div className="fd-filters">
        <span className="fd-filters-sum">
          {plural(stories.length, "story", "stories")} · {plural(all.length, "scenario")}
        </span>
        <span className="spacer" />
        <span className="fd-filter">
          <Eyebrow className="fd-filter-label">Kind</Eyebrow>
          <Segmented<KindFilter>
            label="Filter by kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All", count: all.length },
              ...KINDS.filter((k) => kinds[k]).map((k) => ({
                value: k,
                label: capital(k),
                count: kinds[k],
              })),
            ]}
          />
        </span>
        <span className="fd-filter">
          <Eyebrow className="fd-filter-label">Coverage</Eyebrow>
          <Segmented<CoverageFilter>
            label="Filter by coverage"
            value={coverage}
            onChange={setCoverage}
            options={[
              { value: "all", label: "All" },
              ...COVERAGES.filter((c) => covs[c]).map((c) => ({
                value: c,
                label: capital(COVERAGE_LOOK[c].label),
                count: covs[c],
              })),
            ]}
          />
        </span>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No scenarios match these filters" />
      ) : (
        visible.map(({ story, scenarios }) => (
          <StoryBlock key={story.id} story={story} scenarios={scenarios} />
        ))
      )}
    </div>
  );
}
