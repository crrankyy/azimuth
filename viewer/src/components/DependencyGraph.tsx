import { useEffect, useId, useMemo, useState } from "react";
import type { Feature, FeatureStatus } from "../../../src/core/types";
import { edgePath, layoutDag } from "../lib/graph";
import { href, navigate } from "../lib/router";
import { FEATURE_LOOK, PARKED } from "../lib/status";
import { IdChip } from "./IdChip";
import { EmptyState, Eyebrow, Kbd, PriorityTag } from "./primitives";
import { StatusGlyph, StatusPill } from "./Status";
import "../screens/roadmap/dependency-graph.css";

/** The handoff's graph geometry: 146×56 nodes, columns 184px apart, rows 96px apart. */
const W = 146;
const H = 56;
const OPTS = { nodeWidth: W, nodeHeight: H, colGap: 184 - W, rowGap: 96 - H };

type Tone = "edge" | "faint" | "ink" | "muted" | "danger";
type Role = "hovered" | "up" | "down" | "dim" | "plain";

interface GraphEdge {
  from: string;
  to: string;
  points: [number, number][];
  back: boolean;
}

const VIRTUAL = "\u0000";

/**
 * Lays the graph out with a virtual node in every column a long edge crosses, so the edge runs
 * through an empty slot instead of under an unrelated feature (which would read as a false edge).
 */
function layoutFeatures(ids: string[], edges: [string, string][]) {
  const layer = new Map(layoutDag(ids, edges, OPTS).nodes.map((n) => [n.id, n.layer]));
  const allIds = [...ids];
  const allEdges: [string, string][] = [];
  const chains: { from: string; to: string; via: string[] }[] = [];
  for (const [from, to] of edges) {
    const a = layer.get(from) ?? 0;
    const b = layer.get(to) ?? 0;
    const via: string[] = [];
    let prev = from;
    for (let l = a + 1; l < b; l++) {
      const id = `${VIRTUAL}${from}>${to}#${l}`;
      allIds.push(id);
      allEdges.push([prev, id]);
      via.push(id);
      prev = id;
    }
    allEdges.push([prev, to]);
    chains.push({ from, to, via });
  }
  const layout = layoutDag(allIds, allEdges, OPTS);
  const at = new Map(layout.nodes.map((n) => [n.id, n]));
  const direct = new Map(layout.edges.map((e) => [`${e.from}>${e.to}`, e]));
  const placed: GraphEdge[] = chains.map(({ from, to, via }) => {
    if (via.length === 0) {
      const e = direct.get(`${from}>${to}`);
      return { from, to, points: e?.points ?? [], back: e?.back ?? false };
    }
    const stops = [from, ...via, to].map((id) => at.get(id));
    const points: [number, number][] = [];
    stops.forEach((n, i) => {
      if (!n) return;
      const y = n.y + H / 2;
      if (i > 0) {
        const py = points[points.length - 1]?.[1] ?? y;
        const mid = n.x - OPTS.colGap / 2;
        if (py !== y) points.push([mid, py], [mid, y]);
        points.push([n.x, y]);
      }
      if (i < stops.length - 1) points.push([n.x + W, y]);
    });
    return { from, to, points, back: false };
  });
  return {
    nodes: layout.nodes.filter((n) => !n.id.startsWith(VIRTUAL)),
    edges: placed,
    width: layout.width,
    height: layout.height,
  };
}

/** `depends_on` among the given features, dependency first (drawn left to right). */
export function dependencyEdges(features: Feature[]): [string, string][] {
  const ids = new Set(features.map((f) => f.id));
  return features.flatMap((f) =>
    f.depends_on.filter((d) => ids.has(d)).map((d): [string, string] => [d, f.id]),
  );
}

const statusClass = (s: FeatureStatus) => (PARKED.includes(s) ? "st-parked" : `st-${s}`);

/**
 * Features as nodes coloured by status, `depends_on` as elbow edges. Hovering or focusing a
 * node highlights what it depends on and what it blocks, labelled in text, and dims the rest.
 */
export function DependencyGraph({ features, all }: { features: Feature[]; all: Feature[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const markerBase = useId().replace(/:/g, "");
  const ids = useMemo(() => features.map((f) => f.id).sort(), [features]);
  const edges = useMemo(() => dependencyEdges(features), [features]);
  const layout = useMemo(() => layoutFeatures(ids, edges), [ids, edges]);

  useEffect(() => {
    if (!hover) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "Enter" || target?.closest("a, button, input, select, textarea")) return;
      navigate(href("features", hover));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover]);

  if (features.length === 0) {
    return (
      <section className="az-card dg-card" aria-label="Dependency graph">
        <EmptyState title="No features to graph">
          Features appear here once they exist; change the filters to see more.
        </EmptyState>
      </section>
    );
  }

  const byId = new Map(all.map((f) => [f.id, f]));
  const hovered = hover ? byId.get(hover) : undefined;
  const blocking = hovered ? hovered.status !== "done" : false;
  const up = new Set(edges.filter(([, b]) => b === hover).map(([a]) => a));
  const down = new Set(edges.filter(([a]) => a === hover).map(([, b]) => b));
  const roleOf = (id: string): Role => {
    if (!hover) return "plain";
    if (id === hover) return "hovered";
    if (up.has(id)) return "up";
    if (down.has(id)) return "down";
    return "dim";
  };
  const toneOf = (e: GraphEdge): Tone => {
    if (!hover) return "edge";
    if (e.to === hover) return "ink";
    if (e.from === hover) return blocking ? "danger" : "muted";
    return "faint";
  };
  const marker = (tone: Tone) => `${markerBase}-${tone}`;
  // Highlighted edges paint last so dimmed ones never cross over them.
  const ordered = [...layout.edges].sort(
    (a, b) => Number(toneOf(a) !== "faint") - Number(toneOf(b) !== "faint"),
  );

  return (
    <>
      <section className="az-card dg-card" aria-label="Dependency graph">
        <div className="dg-plane" style={{ width: layout.width, height: layout.height }}>
          <svg className="dg-edges" width={layout.width} height={layout.height} aria-hidden="true">
            <defs>
              {(["edge", "faint", "ink", "muted", "danger"] as Tone[]).map((tone) => (
                <marker
                  key={tone}
                  id={marker(tone)}
                  viewBox="0 0 7 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="8"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0 0L7 4L0 8z" className={`dg-arrow ${tone}`} />
                </marker>
              ))}
            </defs>
            {ordered.map((e) => (
              <path
                key={`${e.from}-${e.to}`}
                d={edgePath(e.points)}
                className={`dg-edge ${toneOf(e)} ${e.back ? "back" : ""}`.trim()}
                markerEnd={`url(#${marker(toneOf(e))})`}
              />
            ))}
          </svg>
          {layout.nodes.map((n) => {
            const f = byId.get(n.id);
            if (!f) return null;
            return (
              <GraphNode
                key={n.id}
                f={f}
                x={n.x}
                y={n.y}
                role={roleOf(n.id)}
                blocking={blocking}
                onHover={(on) => setHover(on ? n.id : null)}
              />
            );
          })}
        </div>
      </section>
      <HoverPanel hovered={hovered} blocking={blocking} byId={byId} />
    </>
  );
}

function GraphNode({
  f,
  x,
  y,
  role,
  blocking,
  onHover,
}: {
  f: Feature;
  x: number;
  y: number;
  role: Role;
  blocking: boolean;
  onHover: (on: boolean) => void;
}) {
  const look = FEATURE_LOOK[f.status];
  const className = ["dg-node", statusClass(f.status), role].join(" ");
  let tag = null;
  if (role === "up") tag = <span className="dg-tag">Depends</span>;
  else if (role === "down")
    tag = (
      <span className={`dg-tag ${blocking ? "danger" : ""}`.trim()}>
        {blocking ? "Blocked" : "Dependent"}
      </span>
    );
  else if (f.priority === "P0" && f.status !== "done") tag = <PriorityTag priority="P0" />;
  return (
    <a
      className={className}
      href={href("features", f.id)}
      style={{ left: x, top: y, width: W, height: H }}
      aria-label={`${f.id} ${f.title}, ${look.label}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <span className="dg-node-top">
        <StatusGlyph glyph={look.glyph} />
        <span className="az-mono dg-id">{f.id}</span>
        <span className="spacer" />
        {tag}
      </span>
      <span className="dg-title">{f.title}</span>
    </a>
  );
}

function RelationList({ ids, byId }: { ids: string[]; byId: Map<string, Feature> }) {
  if (ids.length === 0) return <span className="dg-none">nothing</span>;
  return (
    <>
      {ids.map((id, i) => {
        const f = byId.get(id);
        return (
          <span key={id} className="dg-rel-item">
            <span className="az-mono dg-rel-id">{id}</span>
            {f && ` · ${FEATURE_LOOK[f.status].label.toLowerCase()}`}
            {i < ids.length - 1 && ","}
          </span>
        );
      })}
    </>
  );
}

function HoverPanel({
  hovered,
  blocking,
  byId,
}: {
  hovered: Feature | undefined;
  blocking: boolean;
  byId: Map<string, Feature>;
}) {
  if (!hovered) {
    return (
      <div className="az-card dg-panel">
        <span className="dg-hint">
          Hover or focus a feature to trace what it depends on and what it blocks.
        </span>
      </div>
    );
  }
  return (
    <div className="az-card dg-panel" aria-live="polite">
      <Eyebrow>Hovering</Eyebrow>
      <IdChip id={hovered.id} />
      <span className="dg-panel-title">{hovered.title}</span>
      <StatusPill look={FEATURE_LOOK[hovered.status]} />
      <span className="dg-sep" aria-hidden="true" />
      <span className="dg-rel">
        <span className="dg-line ink" aria-hidden="true" />
        Depends on <RelationList ids={hovered.depends_on} byId={byId} />
      </span>
      <span className="dg-rel">
        <span className={`dg-line ${blocking ? "danger" : "muted"}`} aria-hidden="true" />
        {blocking ? "Blocks" : "Required by"}{" "}
        <RelationList ids={hovered.derived.blocks} byId={byId} />
      </span>
      <span className="spacer" />
      <span className="dg-press">
        Press <Kbd>↵</Kbd> to open
      </span>
    </div>
  );
}
