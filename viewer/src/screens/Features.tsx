import { useMemo, useState } from "react";
import { PRIORITIES, type Feature, type Index } from "../../../src/core/types";
import { Hint, Page } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { Button, EmptyState, Segmented } from "../components/primitives";
import { StatusGlyph } from "../components/Status";
import { useIndexState } from "../data/IndexProvider";
import type { Route } from "../lib/router";
import { FEATURE_LOOK, LIFECYCLE, PARKED } from "../lib/status";
import { FeatureBoard } from "./features/FeatureBoard";
import { FeatureTable, type GroupBy } from "./features/FeatureTable";
import { FilterMenu, type FacetOption } from "./features/FilterMenu";
import {
  FLAG_KEYS,
  FLAGS,
  failingFeatures,
  featureFlags,
  isParked,
  matchesFilters,
  NO_FILTERS,
  NO_MILESTONE,
  orderedMilestones,
  SORTS,
  sortFeatures,
  type Filters,
  type FlagKey,
  type SortKey,
} from "./features/model";

type View = "table" | "board";
const VIEW_KEY = "azimuth.features.view";

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table";
  } catch {
    // Storage can be blocked (file:// exports, private windows); the table is the default.
    return "table";
  }
}

function writeView(view: View): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not persisting the choice is harmless.
  }
}

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "milestone", label: "Milestone" },
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];

function count(pool: Feature[], test: (f: Feature) => boolean): number {
  return pool.filter(test).length;
}

function facetOptions(
  index: Index,
  pool: Feature[],
  flagsById: Map<string, FlagKey[]>,
): Record<keyof Filters, FacetOption[]> {
  const statuses = [...LIFECYCLE, ...PARKED].filter(
    (s) => !PARKED.includes(s) || pool.some((f) => f.status === s),
  );
  const tags = [...new Set(pool.flatMap((f) => f.tags))].sort();
  return {
    status: statuses.map((s) => ({
      value: s,
      label: FEATURE_LOOK[s].label,
      icon: <StatusGlyph glyph={FEATURE_LOOK[s].glyph} />,
      count: count(pool, (f) => f.status === s),
    })),
    milestone: [
      ...orderedMilestones(index.milestones).map((m) => ({
        value: m.id,
        label: m.id,
        count: count(pool, (f) => f.milestone === m.id),
      })),
      { value: NO_MILESTONE, label: "No milestone", count: count(pool, (f) => !f.milestone) },
    ],
    priority: PRIORITIES.map((p) => ({
      value: p,
      label: p,
      count: count(pool, (f) => f.priority === p),
    })),
    tag: tags.map((t) => ({ value: t, label: t, count: count(pool, (f) => f.tags.includes(t)) })),
    flags: FLAG_KEYS.map((k) => ({
      value: k,
      label: FLAGS[k].label,
      count: count(pool, (f) => (flagsById.get(f.id) ?? []).includes(k)),
    })),
  };
}

const FACETS: { key: keyof Filters; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "milestone", label: "Milestone" },
  { key: "priority", label: "Priority" },
  { key: "tag", label: "Tag" },
  { key: "flags", label: "Flags" },
];

export function FeaturesScreen({ route: _route }: { route: Route }) {
  const { index } = useIndexState();
  const [view, setView] = useState<View>(readView);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("milestone");
  const [sort, setSort] = useState<SortKey>("activity");
  const [showParked, setShowParked] = useState(false);

  const all = useMemo(() => index?.features ?? [], [index]);
  const flagsById = useMemo(() => {
    const failing = index ? failingFeatures(index) : new Set<string>();
    return new Map(all.map((f) => [f.id, featureFlags(f, failing)]));
  }, [index, all]);
  if (!index) return null;

  const changeView = (next: View) => {
    setView(next);
    writeView(next);
  };
  const isBoard = view === "board";
  const parkedCount = count(all, isParked);
  const pool = isBoard || showParked ? all : all.filter((f) => !isParked(f));
  const active: Filters = isBoard ? { ...filters, status: [] } : filters;
  const rows = sortFeatures(
    pool.filter((f) => matchesFilters(f, flagsById.get(f.id) ?? [], active)),
    sort,
  );
  const options = facetOptions(index, pool, flagsById);
  const filtered = Object.values(active).some((v) => v.length > 0);

  const views = (
    <Segmented
      label="View"
      value={view}
      onChange={changeView}
      options={[
        { value: "table", label: "Table" },
        { value: "board", label: "Board" },
      ]}
    />
  );

  return (
    <Page crumbs={[{ label: "Features" }]} views={views}>
      <div className="ft-page">
        <div className="ft-toolbar">
          {FACETS.filter((f) => !(isBoard && f.key === "status")).map((facet) => (
            <FilterMenu
              key={facet.key}
              label={facet.label}
              options={options[facet.key]}
              selected={filters[facet.key]}
              onChange={(next) => setFilters({ ...filters, [facet.key]: next })}
            />
          ))}
          <span className="spacer" />
          {isBoard ? (
            <span className="ft-lock">
              <Icon name="lock" size={13} />
              Status moves only through gated actions. Open a feature to act.
            </span>
          ) : (
            <>
              <label className="ft-ctl">
                Group
                <select
                  className="az-select"
                  aria-label="Group by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                >
                  {GROUPS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ft-ctl">
                Sort
                <select
                  className="az-select"
                  aria-label="Sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ft-ctl ft-check">
                <input
                  type="checkbox"
                  checked={showParked}
                  onChange={(e) => setShowParked(e.target.checked)}
                />
                Show parked <span className="ft-n">{parkedCount}</span>
              </label>
            </>
          )}
        </div>

        {all.length === 0 ? (
          <EmptyState title="No features yet">
            Run <code className="az-c">/azimuth:idea</code> in Claude Code to capture your first feature.
          </EmptyState>
        ) : rows.length === 0 && !isBoard ? (
          <EmptyState title="No features match these filters">
            <Button small onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </Button>
          </EmptyState>
        ) : isBoard ? (
          <FeatureBoard features={rows} flagsById={flagsById} />
        ) : (
          <FeatureTable rows={rows} groupBy={groupBy} flagsById={flagsById} />
        )}

        {!isBoard && all.length > 0 && (
          <div className="ft-foot">
            <span>
              {rows.length} of {all.length} features
              {!showParked && parkedCount > 0 && ` · ${parkedCount} parked hidden`}
              {filtered && " · filtered"}
            </span>
            <span className="spacer" />
            <Hint keys={["j", "k"]} label="move" />
            <Hint keys={["↵"]} label="open" />
            <Hint keys={["p"]} label="set priority" />
            <Hint keys={["m"]} label="set milestone" />
          </div>
        )}
      </div>
    </Page>
  );
}
