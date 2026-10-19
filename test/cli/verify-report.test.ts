import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportLines, type ReportMode } from "../../src/cli/verify-report";
import type { VerifyProgress, VerifyTarget } from "../../src/core/verify";
import type { VerifyRun } from "../../src/core/types";

let savedNoColor: string | undefined;
beforeAll(() => {
  savedNoColor = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
});
afterAll(() => {
  if (savedNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = savedNoColor;
});

const target = (task: string, command = "echo ok"): VerifyProgress => ({
  kind: "target",
  target: { task, feature: "F-001", command, covers: [] } satisfies VerifyTarget,
});

const run = (
  id: string,
  task: string,
  fields: Partial<Pick<VerifyRun, "ok" | "exit_code" | "duration_ms" | "output_tail">>,
): VerifyProgress => ({
  kind: "run",
  run: {
    id,
    target: task,
    command: "echo ok",
    ok: true,
    exit_code: 0,
    duration_ms: 0,
    at: "2026-10-20T09:00:00Z",
    commit: null,
    output_tail: "",
    scenarios: [],
    junit: null,
    ...fields,
  },
});

const lines = (events: VerifyProgress[], mode: ReportMode) =>
  events.flatMap((event) => reportLines(event, mode));

const MODES: ReportMode[] = ["full", "summary"];

describe("reportLines", () => {
  it("S-007.7.1 prints one line per run in summary mode, and a failure's output", () => {
    const events = [
      target("T-001.1"),
      run("R-0001", "T-001.1", { duration_ms: 1200 }),
      target("T-001.2"),
      run("R-0002", "T-001.2", {
        ok: false,
        exit_code: 3,
        duration_ms: 500,
        output_tail: "boom",
      }),
    ];
    expect(lines(events, "summary")).toEqual([
      "R-0001 T-001.1 passed in 1.2s",
      "R-0002 T-001.2 failed (exit 3) in 0.5s",
      "    boom",
    ]);
  });

  it("S-007.7.2 also names each command in full mode", () => {
    const events: VerifyProgress[] = [
      { kind: "prebuild", command: "cargo build" },
      {
        kind: "prebuilt",
        result: {
          command: "cargo build",
          ok: true,
          exit_code: 0,
          duration_ms: 41200,
          output_tail: "Finished",
        },
      },
      target("T-001.1", "echo ok"),
      run("R-0001", "T-001.1", { duration_ms: 1200 }),
    ];
    expect(lines(events, "full")).toEqual([
      "prebuild: cargo build",
      "prebuild passed in 41.2s",
      "T-001.1: echo ok",
      "R-0001 T-001.1 passed in 1.2s",
    ]);
  });

  it("S-007.7.3 reports a wait in whole seconds, rounded up", () => {
    for (const mode of MODES) {
      expect(
        lines(
          [
            { kind: "waited", waited_ms: 40000 },
            { kind: "waited", waited_ms: 300 },
          ],
          mode,
        ),
      ).toEqual(["waited 40s for another verify", "waited 1s for another verify"]);
    }
  });

  it("S-007.7.4 prints nothing when there was no wait", () => {
    for (const mode of MODES)
      expect(reportLines({ kind: "waited", waited_ms: 0 }, mode)).toEqual([]);
  });

  it("S-007.7.5 shows a failed prebuild and its output in both modes", () => {
    const event: VerifyProgress = {
      kind: "prebuilt",
      result: {
        command: "cargo build",
        ok: false,
        exit_code: 2,
        duration_ms: 3100,
        output_tail: "no compiler",
      },
    };
    for (const mode of MODES) {
      expect(reportLines(event, mode)).toEqual([
        "prebuild failed (exit 2) in 3.1s",
        "    no compiler",
      ]);
    }
  });
});
