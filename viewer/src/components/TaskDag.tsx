import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Task, TaskStatus } from "../../../src/core/types";
import { plural } from "../lib/format";
import { edgePath, layoutDag, longestPath, type PlacedEdge } from "../lib/graph";
import { TASK_LOOK } from "../lib/status";
import { Eyebrow, Kbd } from "./primitives";
import { StatusGlyph } from "./Status";
import "./taskdag.css";

/** The handoff's plan geometry: 150×60 nodes, columns 200px apart. */
const OPTS = { nodeWidth: 150, nodeHeight: 60, colGap: 50, rowGap: 36 };
/** Room around the plane so the selected node's outline isn't clipped by the scroller. */
const PAD = 6;
const LEGEND: TaskStatus[] = ["done", "in-progress", "blocked", "todo", "skipped"];

/** `after` edges, prerequisite first, in task order. */
export function taskEdges(tasks: Task[]): [string, string][] {
  return tasks.flatMap((t) => t.after.map((a): [string, string] => [a, t.id]));
}

const edgeKey = (from: string, to: string) => `${from}>${to}`;

function criticalEdges(path: string[]): Set<string> {
  return new Set(path.slice(1).map((to, i) => edgeKey(path[i] as string, to)));
}

/** A 7×8 arrowhead at the polyline's end, pointing along its last segment. */
export function arrowHead(points: [number, number][]): string {
  const [x2, y2] = points.at(-1) ?? [0, 0];
  const [x1, y1] = points.at(-2) ?? [x2 - 1, y2];
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  const bx = x2 - dx * 7;
  const by = y2 - dy * 7;
  return `M${x2} ${y2} L${bx - dy * 4} ${by + dx * 4} L${bx + dy * 4} ${by - dx * 4} Z`;
}

/** The word in a node's corner: a failed last run outranks the status. */
function nodeBadge(task: Task): { text: string; danger: boolean; label?: string } {
  if (task.status === "blocked") return { text: "blocked", danger: true };
  if (task.last_run && !task.last_run.ok) {
    return { text: "run ✕", danger: true, label: "Last run failed" };
  }
  return { text: TASK_LOOK[task.status].label.toLowerCase(), danger: false };
}

interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}
type Side = "left" | "right" | "up" | "down";
const SIDES: Side[] = ["left", "up", "down", "right"];

/** How many nodes lie wholly or partly outside the visible part of the canvas, on each side. */
export function hiddenNodes(nodes: { x: number; y: number }[], view: View): Record<Side, number> {
  const count = (outside: (n: { x: number; y: number }) => boolean) => nodes.filter(outside).length;
  return {
    left: count((n) => n.x + PAD < view.left),
    right: count((n) => n.x + PAD + OPTS.nodeWidth > view.left + view.width),
    up: count((n) => n.y + PAD < view.top),
    down: count((n) => n.y + PAD + OPTS.nodeHeight > view.top + view.height),
  };
}

/** The canvas's visible part, kept current as it scrolls or resizes. */
function useView(ref: RefObject<HTMLDivElement | null>): View | null {
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const update = () =>
      setView({
        left: box.scrollLeft,
        top: box.scrollTop,
        width: box.clientWidth,
        height: box.clientHeight,
      });
    // ResizeObserver also reports the first size, so this needs no synchronous update.
    const observer = new ResizeObserver(update);
    observer.observe(box);
    box.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", update);
    };
  }, [ref]);
  return view;
}

/** Scrolls the canvas (never the page) just enough to show a node. */
function reveal(box: HTMLElement, x: number, y: number): void {
  const right = x + OPTS.nodeWidth + 2 * PAD;
  const bottom = y + OPTS.nodeHeight + 2 * PAD;
  if (x < box.scrollLeft) box.scrollLeft = x;
  else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  if (y < box.scrollTop) box.scrollTop = y;
  else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
}

function Edge({ edge, critical }: { edge: PlacedEdge; critical: boolean }) {
  const cls = `td-edge ${critical ? "crit" : ""} ${edge.back ? "back" : ""}`.trim();
  return (
    <g className={cls}>
      <path d={edgePath(edge.points)} />
      <path className="td-arrow" d={arrowHead(edge.points)} />
    </g>
  );
}

function TaskNode({
  task,
  x,
  y,
  selected,
  onSelect,
}: {
  task: Task;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const badge = nodeBadge(task);
  const cls = `td-node st-${task.status} ${selected ? "sel" : ""}`.trim();
  return (
    <button
      type="button"
      className={cls}
      style={{ left: x, top: y, width: OPTS.nodeWidth, height: OPTS.nodeHeight }}
      aria-current={selected ? "true" : undefined}
      title={task.title}
      onClick={() => onSelect(task.id)}
    >
      <span className="td-node-head">
        <StatusGlyph glyph={TASK_LOOK[task.status].glyph} label={TASK_LOOK[task.status].label} />
        <span className="td-node-id">{task.id}</span>
        <span className="spacer" />
        <span
          className={`td-node-badge ${badge.danger ? "danger" : ""}`.trim()}
          title={badge.label}
        >
          {badge.text}
        </span>
      </span>
      <span className="td-node-title">{task.title}</span>
    </button>
  );
}

function Legend({ tasks }: { tasks: Task[] }) {
  const counts = LEGEND.map((s) => [s, tasks.filter((t) => t.status === s).length] as const);
  return (
    <div className="td-legend">
      {counts
        .filter(([, n]) => n > 0)
        .map(([status, n]) => (
          <span key={status} className="td-legend-item">
            <StatusGlyph glyph={TASK_LOOK[status].glyph} />
            {TASK_LOOK[status].label} {n}
          </span>
        ))}
      <span className="spacer" />
      <span className="td-legend-item">
        Click a node or use <Kbd>j</Kbd> <Kbd>k</Kbd>
      </span>
    </div>
  );
}

/** A plan's tasks as a left-to-right graph of `after` edges, with the critical path in ink. */
export function TaskDag({
  tasks,
  selected,
  onSelect,
}: {
  tasks: Task[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { layout, critical, pathLength } = useMemo(() => {
    const ids = tasks.map((t) => t.id);
    const edges = taskEdges(tasks);
    const path = longestPath(ids, edges);
    return {
      layout: layoutDag(ids, edges, OPTS),
      critical: criticalEdges(path),
      pathLength: path.length,
    };
  }, [tasks]);
  const scroller = useRef<HTMLDivElement>(null);
  const view = useView(scroller);
  // macOS hides scrollbars, so say when tasks are out of view instead of relying on one.
  const hidden = view ? hiddenNodes(layout.nodes, view) : null;
  const scrollTo = (side: Side) => {
    const box = scroller.current;
    if (!box) return;
    const sign = side === "left" || side === "up" ? -1 : 1;
    const across = side === "left" || side === "right";
    box.scrollBy({
      left: across ? sign * box.clientWidth * 0.8 : 0,
      top: across ? 0 : sign * box.clientHeight * 0.8,
      behavior: "smooth",
    });
  };
  const placed = layout.nodes.find((n) => n.id === selected);
  const selX = placed?.x;
  const selY = placed?.y;
  useEffect(() => {
    if (scroller.current && selX !== undefined && selY !== undefined) {
      reveal(scroller.current, selX, selY);
    }
  }, [selX, selY]);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const isCritical = (e: PlacedEdge) => !e.back && critical.has(edgeKey(e.from, e.to));
  // Critical edges last, so they draw over the plain ones where they share a trunk.
  const edges = [...layout.edges].sort((a, b) => Number(isCritical(a)) - Number(isCritical(b)));
  return (
    <section className="az-card td-card" aria-label="Task graph">
      <div className="td-head">
        <Eyebrow>Task graph</Eyebrow>
        <span className="td-meta">{plural(tasks.length, "task")} · edges from after</span>
        <span className="spacer" />
        {SIDES.map((side) =>
          hidden && hidden[side] > 0 ? (
            <button
              key={side}
              type="button"
              className={`td-more ${side}`}
              onClick={() => scrollTo(side)}
            >
              {side === "left" && "← "}
              {side === "up" && "↑ "}
              {plural(hidden[side], "more task")}
              {side === "down" && " ↓"}
              {side === "right" && " →"}
            </button>
          ) : null,
        )}
        {pathLength > 1 && (
          <span className="td-crit-key">
            <span className="td-crit-line" aria-hidden="true" />
            Critical path · {plural(pathLength, "task")}
          </span>
        )}
      </div>
      <div className="td-scroll" ref={scroller}>
        <div
          className="td-plane"
          style={{ width: layout.width + 2 * PAD, height: layout.height + 2 * PAD }}
        >
          <svg
            className="td-edges"
            width={layout.width + 2 * PAD}
            height={layout.height + 2 * PAD}
            aria-hidden="true"
          >
            <g transform={`translate(${PAD} ${PAD})`}>
              {edges.map((e) => (
                <Edge key={edgeKey(e.from, e.to)} edge={e} critical={isCritical(e)} />
              ))}
            </g>
          </svg>
          {layout.nodes.map((n) => {
            const task = byId.get(n.id);
            if (!task) return null;
            return (
              <TaskNode
                key={n.id}
                task={task}
                x={n.x + PAD}
                y={n.y + PAD}
                selected={n.id === selected}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </div>
      <Legend tasks={tasks} />
    </section>
  );
}
