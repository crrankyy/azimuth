import { useState } from "react";
import type { Decision, DecisionStatus } from "../../../src/core/types";
import { Hint, Page } from "../components/AppShell";
import { EmptyState } from "../components/primitives";
import { StatusGlyph } from "../components/Status";
import { useIndexState } from "../data/IndexProvider";
import { shortDate } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { href, navigate, type Route } from "../lib/router";
import { DECISION_LOOK } from "../lib/status";
import { AdrView } from "./decisions/AdrView";
import "./decisions/decisions.css";

type Filter = "all" | DecisionStatus;

/** Chip order follows the lifecycle, with the dead ends last. */
const FILTERS: DecisionStatus[] = ["proposed", "accepted", "superseded", "rejected"];

const newestFirst = (a: Decision, b: Decision) => b.id.localeCompare(a.id);

export function DecisionsScreen({ route }: { route: Route }) {
  const { index, changed } = useIndexState();
  const [filter, setFilter] = useState<Filter>("all");
  const all = [...(index?.decisions ?? [])].sort(newestFirst);
  const list = filter === "all" ? all : all.filter((d) => d.status === filter);
  const selected = all.find((d) => d.id === route.id) ?? list[0] ?? null;
  const cursor = selected ? list.findIndex((d) => d.id === selected.id) : -1;
  useListKeys({
    count: list.length,
    selected: cursor,
    onSelect: (i) => {
      const next = list[i];
      if (next) navigate(href("decisions", next.id));
    },
  });

  const crumbs = [
    { label: "Decisions", href: href("decisions") },
    ...(selected ? [{ label: <span className="az-mono">{selected.id}</span> }] : []),
  ];
  return (
    <Page crumbs={crumbs} hints={<Hint keys={["j", "k"]} label="move" />} flush>
      <div className="dec-layout">
        <aside className="dec-list" aria-label="Decision list">
          <div className="dec-list-head">
            <h1>Decisions</h1>
            <span className="dec-count">{all.length}</span>
          </div>
          <div className="dec-chips" role="group" aria-label="Filter by status">
            <StatusChip on={filter === "all"} count={all.length} onClick={() => setFilter("all")}>
              All
            </StatusChip>
            {FILTERS.map((status) => (
              <StatusChip
                key={status}
                on={filter === status}
                count={all.filter((d) => d.status === status).length}
                onClick={() => setFilter(status)}
                glyph={DECISION_LOOK[status].glyph}
              >
                {DECISION_LOOK[status].label}
              </StatusChip>
            ))}
          </div>
          <div className="dec-items">
            {list.map((d) => (
              <DecisionItem
                key={d.id}
                decision={d}
                current={d.id === selected?.id}
                flash={changed.has(d.id)}
              />
            ))}
            {list.length === 0 && all.length > 0 && (
              <div className="dec-none">No {filter} decisions.</div>
            )}
          </div>
        </aside>
        {selected ? (
          <AdrView key={selected.id} decision={selected} />
        ) : (
          <div className="dec-empty">
            <EmptyState title="No decisions yet">
              Agents propose an ADR here when a choice needs your call.
            </EmptyState>
          </div>
        )}
      </div>
    </Page>
  );
}

function StatusChip({
  on,
  count,
  glyph,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  glyph?: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`az-chip ${on ? "on" : ""}`.trim()}
      aria-pressed={on}
      disabled={count === 0 && !on}
      onClick={onClick}
    >
      {glyph && count > 0 && <StatusGlyph glyph={glyph} />}
      {children} {count}
    </button>
  );
}

function DecisionItem({
  decision: d,
  current,
  flash,
}: {
  decision: Decision;
  current: boolean;
  flash: boolean;
}) {
  const look = DECISION_LOOK[d.status];
  const label =
    d.status === "superseded" && d.superseded_by ? `Superseded by ${d.superseded_by}` : look.label;
  return (
    <a
      href={href("decisions", d.id)}
      className={`dec-item s-${d.status} ${flash ? "az-flash" : ""}`.trim()}
      aria-current={current ? "true" : undefined}
    >
      <span className="dec-item-top">
        <StatusGlyph glyph={look.glyph} />
        <span className="az-mono dec-item-id">{d.id}</span>
        <span className="dec-item-status">{label}</span>
        <span className="dec-item-date">{shortDate(d.date)}</span>
      </span>
      <span className="dec-item-title">{d.title}</span>
    </a>
  );
}
