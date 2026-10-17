import { edgePath, layoutDag, type StateGraph } from "../lib/graph";

const W = 150;
const H = 40;

/** A contract's state machine, laid out like the other graphs (nodes left to right, elbow edges). */
export function StateDiagram({ graph }: { graph: StateGraph }) {
  const layout = layoutDag(
    graph.states,
    graph.transitions.map((t) => [t.from, t.to]),
    { nodeWidth: W, nodeHeight: H, colGap: 70, rowGap: 28 },
  );
  const selfLoops = graph.transitions.filter((t) => t.from === t.to);
  const pad = 12;
  return (
    <figure className="state-diagram" aria-label="State diagram">
      <svg width={layout.width + pad * 2} height={layout.height + pad * 2 + 16} role="img">
        <defs>
          <marker
            id="sd-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8z" fill="var(--edge)" />
          </marker>
        </defs>
        <g transform={`translate(${pad} ${pad})`}>
          {layout.edges.map((e, i) => {
            const label = graph.transitions.find((t) => t.from === e.from && t.to === e.to)?.label;
            const [lx, ly] = e.points[
              Math.floor(e.points.length / 2) - (e.points.length > 2 ? 1 : 0)
            ] ?? [0, 0];
            return (
              <g key={i}>
                <path
                  d={edgePath(e.points)}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={1.5}
                  markerEnd="url(#sd-arrow)"
                />
                {label && (
                  <text x={lx + 4} y={ly - 5} className="sd-label">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          {layout.nodes.map((n) => {
            if (n.id === "[start]" || n.id === "[end]") {
              return (
                <g key={n.id}>
                  <circle
                    cx={n.x + W / 2}
                    cy={n.y + H / 2}
                    r={7}
                    fill={n.id === "[start]" ? "var(--ink-muted)" : "none"}
                    stroke="var(--ink-muted)"
                    strokeWidth={1.5}
                  />
                  {n.id === "[end]" && (
                    <circle cx={n.x + W / 2} cy={n.y + H / 2} r={3.5} fill="var(--ink-muted)" />
                  )}
                </g>
              );
            }
            const loop = selfLoops.find((t) => t.from === n.id);
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={W}
                  height={H}
                  rx={8}
                  fill="var(--surface-2)"
                  stroke="var(--hairline-strong)"
                />
                <text x={n.x + W / 2} y={n.y + H / 2 + 4} textAnchor="middle" className="sd-state">
                  {n.id}
                </text>
                {loop && (
                  <text x={n.x + W / 2} y={n.y - 6} textAnchor="middle" className="sd-label">
                    ↻ {loop.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}
