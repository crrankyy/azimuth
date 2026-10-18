import { useRef, useState } from "react";
import type { Feature, FeatureStatus } from "../../../../src/core/types";
import { PriorityTag } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { useListKeys } from "../../lib/keys";
import { href, navigate } from "../../lib/router";
import { FEATURE_LOOK, LIFECYCLE, PARKED } from "../../lib/status";
import { sortFeatures, type FlagKey } from "./model";
import { FlagList } from "./parts";

interface Column {
  key: string;
  glyph: string;
  title: string;
  cards: Feature[];
}

/** Within a column: most urgent first, then most recently touched. */
const columnOrder = (list: Feature[]) => sortFeatures(list, "priority");

function columns(features: Feature[]): { lifecycle: Column[]; parked: Column } {
  const of = (statuses: FeatureStatus[]) =>
    columnOrder(features.filter((f) => statuses.includes(f.status)));
  return {
    lifecycle: LIFECYCLE.map((s) => ({
      key: s,
      glyph: FEATURE_LOOK[s].glyph,
      title: FEATURE_LOOK[s].label,
      cards: of([s]),
    })),
    parked: { key: "parked", glyph: "s-muted", title: "Parked", cards: of(PARKED) },
  };
}

/** One column per lifecycle step plus a collapsed Parked column. No drag and drop. */
export function FeatureBoard({
  features,
  flagsById,
}: {
  features: Feature[];
  flagsById: Map<string, FlagKey[]>;
}) {
  const { changed } = useIndexState();
  const [parkedOpen, setParkedOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardEls = useRef(new Map<string, HTMLAnchorElement>());
  const { lifecycle, parked } = columns(features);
  const shown = parkedOpen ? [...lifecycle, parked] : lifecycle;
  const ids = shown.flatMap((c) => c.cards.map((f) => f.id));
  const selected = selectedId ? ids.indexOf(selectedId) : -1;

  useListKeys({
    count: ids.length,
    selected,
    onSelect: (i) => {
      const id = ids[i];
      if (!id) return;
      setSelectedId(id);
      cardEls.current.get(id)?.scrollIntoView({ block: "nearest" });
    },
    onOpen: (i) => ids[i] && navigate(href("features", ids[i])),
  });

  const cardRef = (id: string) => (el: HTMLAnchorElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };
  return (
    <div className={`fb-board ${parkedOpen ? "parked-open" : ""}`.trim()}>
      {shown.map((col) => (
        <section key={col.key} className="fb-col" aria-label={`${col.title}, ${col.cards.length}`}>
          <div className="fb-col-head">
            <StatusGlyph glyph={col.glyph} />
            <span className="fb-col-title">{col.title}</span>
            <span className="fb-col-count">{col.cards.length}</span>
            {col.key === "parked" && (
              <button
                type="button"
                className="icon-btn fb-collapse"
                aria-expanded="true"
                aria-label="Collapse parked features"
                onClick={() => setParkedOpen(false)}
              >
                <Chevron dir="left" />
              </button>
            )}
          </div>
          {col.cards.map((f) => (
            <BoardCard
              key={f.id}
              f={f}
              flags={flagsById.get(f.id) ?? []}
              selected={f.id === selectedId}
              changed={changed.has(f.id)}
              parked={col.key === "parked"}
              cardRef={cardRef(f.id)}
            />
          ))}
          {col.cards.length === 0 && <div className="fb-empty">Nothing here</div>}
        </section>
      ))}
      {!parkedOpen && (
        <button
          type="button"
          className="fb-parked"
          aria-expanded="false"
          aria-label={`Show ${parked.cards.length} parked features`}
          onClick={() => setParkedOpen(true)}
        >
          <StatusGlyph glyph="s-muted" />
          <span className="fb-parked-label">Parked · {parked.cards.length}</span>
          <Chevron dir="right" />
        </button>
      )}
    </div>
  );
}

function BoardCard({
  f,
  flags,
  selected,
  changed,
  parked,
  cardRef,
}: {
  f: Feature;
  flags: FlagKey[];
  selected: boolean;
  changed: boolean;
  parked: boolean;
  cardRef: (el: HTMLAnchorElement | null) => void;
}) {
  const { done, total } = f.derived.progress;
  const c = f.derived.coverage;
  const progress =
    total > 0 ? `${done} / ${total} tasks` : f.status === "idea" ? "No spec yet" : "No tasks";
  const className = ["fb-card", selected ? "az-focus" : "", changed ? "az-flash" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <a ref={cardRef} className={className} href={href("features", f.id)}>
      <span className="fb-card-top">
        <span className="az-mono fb-card-id">{f.id}</span>
        <span className="spacer" />
        <PriorityTag priority={f.priority} />
      </span>
      <span className="fb-card-title">{f.title}</span>
      {flags.length > 0 && <FlagList feature={f} flags={flags} short />}
      <span className="fb-card-foot">
        <span>{parked ? FEATURE_LOOK[f.status].label : progress}</span>
        {c.total > 0 && !parked && (
          <span>
            {c.passing} / {c.total} passing
          </span>
        )}
        {f.milestone && <span className="az-mono fb-card-ms">{f.milestone}</span>}
      </span>
    </a>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
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
      <path d={dir === "right" ? "M3.5 2L6.5 5L3.5 8" : "M6.5 2L3.5 5L6.5 8"} />
    </svg>
  );
}
