import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index, Task, VerifyRun } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { junitSummary, RunResult, runFeature } from "./RunResult";
import { arrowHead, hiddenNodes, TaskDag, taskEdges } from "./TaskDag";

const index = expectedIndex as unknown as Index;
const tasks = index.features.find((f) => f.id === "F-005")?.detail?.tasks as Task[];
const run = (id: string) => index.runs.find((r) => r.id === id) as VerifyRun;
const NOW = Date.parse("2026-10-18T12:05:00Z");

describe("hiddenNodes", () => {
  it("BUG-0008 counts tasks cut off on each side of the visible canvas", () => {
    // Columns at 0, 200, 400, 600 and 800; nodes are 150×60, plus 6px of padding.
    const row = [0, 200, 400, 600, 800].map((x) => ({ x, y: 0 }));
    const view = (left: number, width: number) => ({ left, top: 0, width, height: 600 });
    expect(hiddenNodes(row, view(0, 600))).toEqual({ left: 0, right: 2, up: 0, down: 0 });
    expect(hiddenNodes(row, view(300, 700))).toEqual({ left: 2, right: 0, up: 0, down: 0 });
    expect(hiddenNodes(row, view(0, 1000))).toEqual({ left: 0, right: 0, up: 0, down: 0 });
    // Nine tasks in one column, 96px apart, in a 560px-high canvas.
    const column = Array.from({ length: 9 }, (_, i) => ({ x: 0, y: i * 96 }));
    expect(hiddenNodes(column, { left: 0, top: 0, width: 800, height: 560 })).toMatchObject({
      up: 0,
      down: 3,
    });
  });
});

describe("TaskDag", () => {
  const html = renderToStaticMarkup(
    <TaskDag tasks={tasks} selected="T-005.4" onSelect={() => undefined} />,
  );

  it("draws one node per task in the handoff's columns", () => {
    const nodes = [...html.matchAll(/class="td-node [^"]*" style="left:(\d+)px;top:(\d+)px/g)];
    const columns = nodes.map((m) => Number(m[1]) - 6).sort((a, b) => a - b);
    expect(columns).toEqual([0, 200, 200, 200, 400, 600]);
    const middle = nodes.filter((m) => Number(m[1]) - 6 === 200).map((m) => Number(m[2]) - 6);
    expect(middle.sort((a, b) => a - b)).toEqual([0, 96, 192]);
  });

  it("styles nodes by status and marks the selected one", () => {
    expect(html).toMatch(/class="td-node st-in-progress sel"[^>]*aria-current="true"/);
    expect(html.match(/td-node st-done/g)).toHaveLength(3);
    expect(html).toContain("td-node st-blocked");
    expect(html).toContain("td-node st-todo");
    expect(html).toContain(">run ✕<");
    expect(html).toContain(">blocked<");
  });

  it("draws every after edge and inks the critical path", () => {
    expect(taskEdges(tasks)).toHaveLength(7);
    expect(html.match(/class="td-edge crit"/g)).toHaveLength(3);
    expect(html.match(/class="td-edge"/g)).toHaveLength(4);
    expect(html).toContain("Critical path · 4 tasks");
    expect(html).toContain("Done 3");
    expect(html).toContain("Blocked 1");
  });

  it("points arrowheads along the last segment", () => {
    expect(
      arrowHead([
        [150, 30],
        [200, 30],
      ]),
    ).toBe("M200 30 L193 34 L193 26 Z");
    expect(
      arrowHead([
        [10, 100],
        [10, 60],
      ]),
    ).toBe("M10 60 L14 67 L6 67 Z");
  });
});

describe("RunResult", () => {
  // The viewer shows local times (BUG-0030); pin the zone so the sample's 11:56 UTC reads as such.
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it("shows a failed run's facts and output tail", () => {
    const html = renderToStaticMarkup(<RunResult run={run("R-0142")} now={NOW} />);
    expect(html).toContain("rr-card fail");
    expect(html).toContain(">Failed<");
    expect(html).toContain(">R-0142<");
    expect(html).toContain("exit 1 · 2.14 s");
    expect(html).toContain("9f3c2e1");
    expect(html).toContain("11:56 · 9m ago");
    expect(html).toContain('class="out-fail"');
  });

  it("notes a run without output and adds JUnit counts", () => {
    const quiet = { ...run("R-0139"), junit: { tests: 12, failures: 0, errors: 0, skipped: 2 } };
    const html = renderToStaticMarkup(<RunResult run={quiet} now={NOW} />);
    expect(html).toContain(">Passed<");
    expect(html).toContain("12 tests · 2 skipped");
    expect(html).toContain("No output captured.");
  });

  it("renders the runs-list drawer with copyable commands", () => {
    const html = renderToStaticMarkup(<RunResult run={run("R-0142")} now={NOW} variant="drawer" />);
    expect(html).toContain("$ pnpm vitest run src/retry/policy.test.ts");
    expect(html).toContain("S-005.2.1");
    expect(html).toContain("Copy azimuth verify F-005");
  });

  it("maps targets to features and summarizes JUnit", () => {
    expect(runFeature("T-005.4")).toBe("F-005");
    expect(runFeature("F-007")).toBe("F-007");
    expect(junitSummary(null)).toBeNull();
    expect(junitSummary({ tests: 1, failures: 1, errors: 1, skipped: 0 })).toBe(
      "1 test · 1 failed · 1 error",
    );
  });
});
