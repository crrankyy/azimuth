/**
 * Layered layout for small directed graphs (task DAGs, feature dependencies, module maps, state
 * diagrams), drawn like the handoff: columns by longest path from the roots, rows ordered to
 * reduce crossings, and orthogonal elbow edges.
 */

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  /** Horizontal space between columns. */
  colGap: number;
  /** Vertical space between rows. */
  rowGap: number;
}

export interface PlacedNode {
  id: string;
  x: number;
  y: number;
  layer: number;
  row: number;
}

export interface PlacedEdge {
  from: string;
  to: string;
  /** Polyline points (orthogonal segments), from the source's right edge to the target's left. */
  points: [number, number][];
  /** True for edges reversed to break a cycle (drawn as returning edges). */
  back: boolean;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

/** Edges that close a cycle (found by DFS in input order); self-loops are dropped from layout. */
function backEdges(ids: string[], edges: [string, string][]): Set<string> {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) if (a !== b) out.get(a)?.push(b);
  const state = new Map<string, 1 | 2>();
  const back = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) back.add(`${id}\u0000${next}`);
      else if (!state.has(next)) visit(next);
    }
    state.set(id, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id);
  return back;
}

export function layoutDag(ids: string[], edges: [string, string][], opts: LayoutOptions): Layout {
  const known = new Set(ids);
  const valid = edges.filter(([a, b]) => known.has(a) && known.has(b) && a !== b);
  const back = backEdges(ids, valid);
  const forward = valid.map(([a, b]) =>
    back.has(`${a}\u0000${b}`) ? ([b, a] as [string, string]) : ([a, b] as [string, string]),
  );

  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  const succs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of forward) {
    preds.get(b)?.push(a);
    succs.get(a)?.push(b);
  }

  // Longest path from the roots gives the column.
  const layer = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    const cached = layer.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(0, ...(preds.get(id) ?? []).map((p) => depth(p, seen) + 1));
    layer.set(id, d);
    return d;
  };
  ids.forEach((id) => depth(id));

  const layers: string[][] = [];
  for (const id of ids) (layers[layer.get(id) ?? 0] ??= []).push(id);
  for (let i = 0; i < layers.length; i++) layers[i] ??= [];

  // Barycenter sweeps to reduce crossings.
  const position = new Map<string, number>();
  const index = () => layers.forEach((l) => l.forEach((id, i) => position.set(id, i)));
  index();
  const bary = (id: string, neighbours: string[]) =>
    neighbours.length === 0
      ? (position.get(id) ?? 0)
      : neighbours.reduce((s, n) => s + (position.get(n) ?? 0), 0) / neighbours.length;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < layers.length; i++) {
      layers[i] = [...(layers[i] as string[])].sort(
        (a, b) => bary(a, preds.get(a) ?? []) - bary(b, preds.get(b) ?? []),
      );
      index();
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      layers[i] = [...(layers[i] as string[])].sort(
        (a, b) => bary(a, succs.get(a) ?? []) - bary(b, succs.get(b) ?? []),
      );
      index();
    }
  }

  // Vertical alignment on the row grid: each node level with the average of its predecessors
  // (roots with their successors), keeping the column's order and never overlapping.
  const rowOf = new Map<string, number>();
  layers.forEach((l) => l.forEach((id, i) => rowOf.set(id, i)));
  const average = (ids: string[]) =>
    ids.reduce((sum, n) => sum + (rowOf.get(n) ?? 0), 0) / ids.length;
  const align = (layer: string[], neighbours: Map<string, string[]>) => {
    let next = 0;
    for (const id of layer) {
      const near = neighbours.get(id) ?? [];
      const wanted = near.length > 0 ? Math.round(average(near)) : (rowOf.get(id) ?? 0);
      const row = Math.max(next, wanted);
      rowOf.set(id, row);
      next = row + 1;
    }
  };
  for (let i = 1; i < layers.length; i++) align(layers[i] as string[], preds);
  if (layers[0]) align(layers[0], succs);
  // Alignment can push whole columns down; drop rows no node uses so no blank band remains.
  const used = [...new Set(rowOf.values())].sort((a, b) => a - b);
  const dense = new Map(used.map((row, i) => [row, i]));
  for (const [id, row] of rowOf) rowOf.set(id, dense.get(row) ?? row);

  const colPitch = opts.nodeWidth + opts.colGap;
  const rowPitch = opts.nodeHeight + opts.rowGap;
  const nodes: PlacedNode[] = [];
  layers.forEach((l, li) =>
    l.forEach((id) => {
      const row = rowOf.get(id) ?? 0;
      nodes.push({ id, layer: li, row, x: li * colPitch, y: row * rowPitch });
    }),
  );
  const at = new Map(nodes.map((n) => [n.id, n]));
  const placed: PlacedEdge[] = valid.map(([from, to]) => {
    const a = at.get(from) as PlacedNode;
    const b = at.get(to) as PlacedNode;
    const isBack = back.has(`${from}\u0000${to}`);
    const ay = a.y + opts.nodeHeight / 2;
    const by = b.y + opts.nodeHeight / 2;
    if (isBack) {
      // Leave the source's bottom and enter the target's bottom, below both rows.
      const low = Math.max(a.y, b.y) + opts.nodeHeight + opts.rowGap / 2;
      const ax = a.x + opts.nodeWidth / 2;
      const bx = b.x + opts.nodeWidth / 2;
      return {
        from,
        to,
        back: true,
        points: [
          [ax, a.y + opts.nodeHeight],
          [ax, low],
          [bx, low],
          [bx, b.y + opts.nodeHeight],
        ],
      };
    }
    const x1 = a.x + opts.nodeWidth;
    const x2 = b.x;
    const mid = x2 - opts.colGap / 2;
    const points: [number, number][] =
      ay === by
        ? [
            [x1, ay],
            [x2, by],
          ]
        : [
            [x1, ay],
            [mid, ay],
            [mid, by],
            [x2, by],
          ];
    return { from, to, back: false, points };
  });
  const rows = Math.max(1, ...nodes.map((n) => n.row + 1));
  return {
    nodes,
    edges: placed,
    width: Math.max(0, layers.length * colPitch - opts.colGap),
    height: rows * rowPitch - opts.rowGap + (placed.some((e) => e.back) ? opts.rowGap : 0),
  };
}

/** The longest chain of nodes (by count), used to highlight a plan's critical path. */
export function longestPath(ids: string[], edges: [string, string][]): string[] {
  const succs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) if (a !== b && succs.has(a) && succs.has(b)) succs.get(a)?.push(b);
  const memo = new Map<string, string[]>();
  const from = (id: string, seen: Set<string>): string[] => {
    const hit = memo.get(id);
    if (hit) return hit;
    if (seen.has(id)) return [id];
    seen.add(id);
    let best: string[] = [];
    for (const next of succs.get(id) ?? []) {
      const path = from(next, seen);
      if (path.length > best.length) best = path;
    }
    seen.delete(id);
    const result = [id, ...best];
    memo.set(id, result);
    return result;
  };
  let best: string[] = [];
  for (const id of ids) {
    const path = from(id, new Set());
    if (path.length > best.length) best = path;
  }
  return best;
}

/** SVG path data for an edge's polyline. */
export function edgePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

export interface StateGraph {
  states: string[];
  transitions: { from: string; to: string; label: string }[];
}

/** Parses the `stateDiagram-v2` subset contracts use: `A --> B: label`, with `[*]` start/end. */
export function parseStateDiagram(source: string): StateGraph | null {
  const lines = source.split("\n").map((l) => l.trim());
  if (!lines.some((l) => /^stateDiagram(-v2)?$/.test(l))) return null;
  const states: string[] = [];
  const transitions: StateGraph["transitions"] = [];
  const add = (s: string) => {
    if (!states.includes(s)) states.push(s);
  };
  let sawStart = false;
  for (const line of lines) {
    const m = /^(\[\*\]|[\w.-]+)\s*-->\s*(\[\*\]|[\w.-]+)\s*(?::\s*(.*))?$/.exec(line);
    if (!m) continue;
    const from = m[1] === "[*]" ? (sawStart ? "[end]" : "[start]") : (m[1] as string);
    const to = m[2] === "[*]" ? "[end]" : (m[2] as string);
    if (m[1] === "[*]") sawStart = true;
    add(from);
    add(to);
    transitions.push({ from, to, label: (m[3] ?? "").trim() });
  }
  return states.length > 0 ? { states, transitions } : null;
}
