import { describe, expect, it } from "vitest";
import { layoutDag, longestPath, parseStateDiagram } from "./graph";
import { tokenize } from "./highlight";

const OPTS = { nodeWidth: 150, nodeHeight: 60, colGap: 50, rowGap: 36 };
const TASKS = ["T-005.1", "T-005.2", "T-005.3", "T-005.4", "T-005.5", "T-005.6"];
const AFTER: [string, string][] = [
  ["T-005.1", "T-005.2"],
  ["T-005.1", "T-005.3"],
  ["T-005.2", "T-005.4"],
  ["T-005.1", "T-005.5"],
  ["T-005.3", "T-005.6"],
  ["T-005.4", "T-005.6"],
  ["T-005.5", "T-005.6"],
];

describe("layoutDag", () => {
  it("places tasks in columns by longest path, like the handoff's plan graph", () => {
    const layout = layoutDag(TASKS, AFTER, OPTS);
    const col = Object.fromEntries(layout.nodes.map((n) => [n.id, n.x]));
    expect(col).toEqual({
      "T-005.1": 0,
      "T-005.2": 200,
      "T-005.3": 200,
      "T-005.5": 200,
      "T-005.4": 400,
      "T-005.6": 600,
    });
    expect(layout.width).toBe(750);
    expect(layout.height).toBe(252);
    const edge = layout.edges.find((e) => e.from === "T-005.1" && e.to === "T-005.3");
    expect(edge?.points[0]).toEqual([150, 30]);
    expect(edge?.points.at(-1)?.[0]).toBe(200);
  });

  it("is deterministic and survives cycles", () => {
    const a = layoutDag(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
        ["b", "b"],
      ],
      OPTS,
    );
    const b = layoutDag(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
        ["b", "b"],
      ],
      OPTS,
    );
    expect(a).toEqual(b);
    expect(a.edges.filter((e) => e.back).map((e) => `${e.from}>${e.to}`)).toEqual(["c>a"]);
  });

  it("finds the critical path", () => {
    expect(longestPath(TASKS, AFTER)).toEqual(["T-005.1", "T-005.2", "T-005.4", "T-005.6"]);
  });
});

describe("parseStateDiagram", () => {
  it("reads transitions with start and end markers", () => {
    const graph = parseStateDiagram(
      "stateDiagram-v2\n  [*] --> pending\n  pending --> in_flight: leased\n  in_flight --> [*]\n",
    );
    expect(graph).toEqual({
      states: ["[start]", "pending", "in_flight", "[end]"],
      transitions: [
        { from: "[start]", to: "pending", label: "" },
        { from: "pending", to: "in_flight", label: "leased" },
        { from: "in_flight", to: "[end]", label: "" },
      ],
    });
    expect(parseStateDiagram("flowchart LR\n a --> b")).toBeNull();
  });
});

describe("tokenize", () => {
  it("classifies keywords, types, strings, numbers, comments and calls", () => {
    const tokens = tokenize('export type A = "x"; // note\nconst n = 42; f(1)', "ts").filter(
      (t) => t.cls,
    );
    expect(tokens.map((t) => `${t.cls}:${t.text}`)).toEqual([
      "k:export",
      "k:type",
      "t:A",
      's:"x"',
      "c:// note",
      "k:const",
      "n:42",
      "f:f",
      "n:1",
    ]);
  });
});
