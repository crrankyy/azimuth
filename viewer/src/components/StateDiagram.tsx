import { edgePath, layoutDag, type PlacedEdge, type StateGraph } from "../lib/graph";

const W = 150;
const H = 36;
/** Vertical space between layers, which holds the fork lines and the edge labels. */
const LAYER_GAP = 48;
const COL_GAP = 24;
const PAD = 12;
/** Rough width of one 11px label character, to keep labels inside the figure. */
const CHAR = 6.2;
const MARKER_R = 7;
const isMarker = (id: string) => id === "[start]" || id === "[end]";

type Point = [number, number];

/**
 * A contract's state machine, laid out top to bottom: states fan out sideways, which fits the
 * main column. `layoutDag` places layers left to right, so its axes are swapped here.
 */
function verticalLayout(graph: StateGraph) {
  const flat = layoutDag(
    graph.states,
    graph.transitions.map((t) => [t.from, t.to]),
    { nodeWidth: H, nodeHeight: W, colGap: LAYER_GAP, rowGap: COL_GAP },
  );
  const swap = ([x, y]: Point): Point => [y, x];
  const nodes = flat.nodes.map((n) => ({ ...n, x: n.y, y: n.x }));
  const at = new Map(nodes.map((n) => [n.id, n]));
  const edges = flat.edges.map((e): PlacedEdge => {
    const points = e.points.map(swap);
    // Start and end markers are small circles centred in their box; meet the circle itself.
    const from = at.get(e.from);
    const to = at.get(e.to);
    const first = points[0];
    const last = points.at(-1);
    if (from && first && e.from === "[start]") first[1] = from.y + H / 2 + MARKER_R;
    if (to && last && e.to === "[end]") last[1] = to.y + H / 2 - MARKER_R - 1;
    return { ...e, points };
  });
  return { nodes, edges, width: flat.height, height: flat.width };
}

/** Shortens a label to fit `room` pixels; the full text stays in its tooltip. */
function fit(label: string, room: number): string {
  const max = Math.max(4, Math.floor(room / CHAR));
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

export function StateDiagram({ graph }: { graph: StateGraph }) {
  const layout = verticalLayout(graph);
  const labelOf = (from: string, to: string) =>
    graph.transitions.find((t) => t.from === from && t.to === to)?.label;
  // Forward labels sit right of the arrow entering their target, within that column's pitch;
  // back-edge and self-loop labels sit right of their state, above and below the returning edge.
  const room = W + COL_GAP - 12;
  const side = 2 * (W + COL_GAP);
  const labels = [
    ...layout.edges.flatMap((e) => {
      const text = labelOf(e.from, e.to);
      const [x, y] = e.points.at(-1) ?? [0, 0];
      if (!text) return [];
      return e.back
        ? [{ key: `${e.from}>${e.to}`, text, x: x + 8, y: y + 14, room: side }]
        : [{ key: `${e.from}>${e.to}`, text, x: x + 6, y: y - 8, room }];
    }),
    ...graph.transitions
      .filter((t) => t.from === t.to && t.label)
      .flatMap((t) => {
        const n = layout.nodes.find((x) => x.id === t.from);
        if (!n) return [];
        const text = `↻ ${t.label}`;
        return [{ key: `${t.from}>loop`, text, x: n.x + W + 8, y: n.y + H / 2 - 6, room: side }];
      }),
  ].map((l) => ({ ...l, shown: fit(l.text, l.room) }));
  const right = Math.max(layout.width, ...labels.map((l) => l.x + l.shown.length * CHAR));
  return (
    <figure className="state-diagram" aria-label="State diagram">
      <svg width={right + PAD * 2} height={layout.height + PAD * 2} role="img">
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
        <g transform={`translate(${PAD} ${PAD})`}>
          {layout.edges.map((e) => (
            <path
              key={`${e.from}>${e.to}`}
              d={edgePath(e.points)}
              fill="none"
              stroke="var(--edge)"
              strokeWidth={1.5}
              markerEnd="url(#sd-arrow)"
            />
          ))}
          {layout.nodes.map((n) =>
            isMarker(n.id) ? (
              <g key={n.id}>
                <circle
                  cx={n.x + W / 2}
                  cy={n.y + H / 2}
                  r={MARKER_R}
                  fill={n.id === "[start]" ? "var(--ink-muted)" : "none"}
                  stroke="var(--ink-muted)"
                  strokeWidth={1.5}
                />
                {n.id === "[end]" && (
                  <circle cx={n.x + W / 2} cy={n.y + H / 2} r={3.5} fill="var(--ink-muted)" />
                )}
              </g>
            ) : (
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
                  {fit(n.id, W - 16)}
                  <title>{n.id}</title>
                </text>
              </g>
            ),
          )}
          {labels.map((l) => (
            <text key={l.key} x={l.x} y={l.y} className="sd-label">
              {l.shown}
              <title>{l.text}</title>
            </text>
          ))}
        </g>
      </svg>
    </figure>
  );
}
