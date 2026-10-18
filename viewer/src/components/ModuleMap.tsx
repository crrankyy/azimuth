import { useId, type ReactNode } from "react";
import type { Module } from "../../../src/core/types";
import { edgePath, layoutDag, type Layout, type PlacedEdge } from "../lib/graph";
import "./module-map.css";

const NODE = { nodeWidth: 220, nodeHeight: 80, rowGap: 20 };
/** Two columns read best spread wide (as in the handoff); deeper maps tighten up to fit. */
const WIDE_GAP = 280;
const NARROW_GAP = 96;
const MAX_WIDE = 720;

function layoutModules(modules: Module[]): Layout {
  const ids = modules.map((m) => m.name);
  const edges = modules.flatMap((m) => m.depends_on.map((d): [string, string] => [m.name, d]));
  const wide = layoutDag(ids, edges, { ...NODE, colGap: WIDE_GAP });
  return wide.width <= MAX_WIDE ? wide : layoutDag(ids, edges, { ...NODE, colGap: NARROW_GAP });
}

const between = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b);

/** Whether a point lies on an orthogonal polyline. */
function onPath([x, y]: [number, number], points: [number, number][]): boolean {
  return points.some((p, i) => {
    const q = points[i + 1];
    if (!q) return false;
    if (p[0] === q[0]) return x === p[0] && between(y, p[1], q[1]);
    return y === p[1] && between(x, p[0], q[0]);
  });
}

/** Elbows that another edge also passes through: drawn as dots so shared lines read as forks. */
function junctions(edges: PlacedEdge[]): [number, number][] {
  const out = new Map<string, [number, number]>();
  for (const e of edges) {
    for (const elbow of e.points.slice(1, -1)) {
      const shared = edges.some((other) => other !== e && onPath(elbow, other.points));
      if (shared) out.set(`${elbow[0]},${elbow[1]}`, elbow);
    }
  }
  return [...out.values()];
}

/**
 * Modules from architecture.md and their `depends_on`, laid out left to right. Arrows point at
 * the dependency.
 */
export function ModuleMap({ modules, footer }: { modules: Module[]; footer?: ReactNode }) {
  const arrow = useId();
  const layout = layoutModules(modules);
  const byName = new Map(modules.map((m) => [m.name, m]));
  return (
    <section aria-label="Module map" className="az-card mm">
      <div className="mm-canvas" style={{ width: layout.width, height: layout.height }}>
        <svg className="mm-edges" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker
              id={arrow}
              viewBox="0 0 7 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0 0L7 4L0 8z" />
            </marker>
          </defs>
          {layout.edges.map((e) => (
            <path
              key={`${e.from}-${e.to}`}
              d={edgePath(e.points)}
              markerEnd={`url(#${arrow})`}
              className={e.back ? "back" : undefined}
            />
          ))}
          {junctions(layout.edges).map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
          ))}
        </svg>
        {layout.nodes.map((n) => {
          const m = byName.get(n.id);
          if (!m) return null;
          return (
            <div
              key={m.name}
              className="mm-node"
              style={{ left: n.x, top: n.y, width: NODE.nodeWidth, height: NODE.nodeHeight }}
              title={`${m.name} (${m.path})${m.depends_on.length ? ` depends on ${m.depends_on.join(", ")}` : ""}`}
            >
              <span className="mm-node-head">
                <b className="az-mono">{m.name}</b>
                <span className="az-mono mm-path">{m.path}</span>
              </span>
              <span className="mm-resp">{m.responsibility}</span>
            </div>
          );
        })}
      </div>
      <div className="mm-foot">
        <span>Arrows point to what a module depends on</span>
        {footer}
      </div>
    </section>
  );
}
