import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { runHistory } from "../../src/core/runs";
import { featureFiles, loadTree } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

interface RunSpec {
  id: string;
  target: string;
  at: string;
  ok?: boolean;
  exit_code?: number;
  duration_ms?: number;
  commit?: string;
  output_tail?: string;
  /** Left out of the run file when the key is absent here. */
  waited_ms?: number;
  /** Left out of the run file when the key is absent here. */
  prebuild?: { ok: boolean; duration_ms: number } | null;
}

function runFile({ ok = true, exit_code = 0, duration_ms = 1000, ...rest }: RunSpec): string {
  return JSON.stringify({
    command: "pnpm test",
    ok,
    exit_code,
    duration_ms,
    commit: "9f3c2e1",
    scenarios: [],
    junit: null,
    output_tail: "",
    ...rest,
  });
}

const THREE_RUNS: RunSpec[] = [
  {
    id: "R-0001",
    target: "T-001.1",
    duration_ms: 12400,
    at: "2026-10-19T09:00:00Z",
    commit: "9f3c2e1",
    waited_ms: 0,
    prebuild: { ok: true, duration_ms: 41200 },
  },
  {
    id: "R-0002",
    target: "T-001.1",
    duration_ms: 11800,
    at: "2026-10-19T15:00:00Z",
    commit: "a1b2c3d",
    waited_ms: 40500,
    prebuild: null,
  },
  {
    id: "R-0003",
    target: "T-001.1",
    ok: false,
    exit_code: 1,
    duration_ms: 2100,
    at: "2026-10-24T08:00:00Z",
    commit: "0c4d5e6",
    output_tail: "FAIL test/a.test.ts > S-001.1.1 opens\nTimed out in 5000ms",
  },
];

const FOUR_RUNS: RunSpec[] = [
  ...THREE_RUNS,
  {
    id: "R-0004",
    target: "T-001.2",
    duration_ms: 900,
    at: "2026-10-20T10:00:00Z",
    commit: "a1b2c3d",
    waited_ms: 0,
    prebuild: null,
  },
];

const REMOVED_TASK_RUN: RunSpec = { id: "R-0006", target: "T-001.9", at: "2026-10-25T08:00:00Z" };

/** F-001 in progress planning T-001.1 and T-001.2, F-002 an idea, and `runs` in the cache. */
function modelWith(runs: RunSpec[]) {
  const tree = loadTree({
    ...featureFiles({
      id: "F-001",
      status: "in-progress",
      tasks: [
        { id: "T-001.1", covers: ["S-001.1.1"] },
        { id: "T-001.2", covers: ["S-001.1.2"] },
      ],
    }),
    ...featureFiles({ id: "F-002", status: "idea", ideaOnly: true }),
    ...Object.fromEntries(runs.map((r) => [`.azimuth/cache/runs/${r.id}.json`, runFile(r)])),
  });
  cleanup = tree.cleanup;
  return tree.model;
}

function failure(run: () => unknown): unknown {
  try {
    run();
  } catch (e) {
    return e;
  }
  return null;
}

describe("ST-025.1 Pick a task's or feature's runs, newest first", () => {
  it("S-025.1.1 lists a task's runs newest first", () => {
    const history = runHistory(modelWith(FOUR_RUNS), "T-001.1", 20);
    expect(history).toMatchObject({ ref: "T-001.1", kind: "task", total: 3 });
    expect(history.runs.map((r) => r.id)).toEqual(["R-0003", "R-0002", "R-0001"]);
  });

  it("S-025.1.2 counts runs of removed tasks and of the feature itself, cut to the limit", () => {
    const model = modelWith([
      ...FOUR_RUNS,
      { id: "R-0005", target: "T-002.1", at: "2026-10-26T08:00:00Z" },
      REMOVED_TASK_RUN,
      { id: "R-0007", target: "F-001", at: "2026-10-18T08:00:00Z" },
    ]);
    const history = runHistory(model, "F-001", 3);
    expect(history).toMatchObject({ ref: "F-001", kind: "feature", total: 6 });
    expect(history.runs.map((r) => r.id)).toEqual(["R-0006", "R-0003", "R-0004"]);
  });

  it("S-025.1.3 lists the higher run ID first for runs at the same second", () => {
    const model = modelWith([
      ...THREE_RUNS,
      { id: "R-0008", target: "T-001.1", at: "2026-10-26T08:00:00Z" },
      { id: "R-0009", target: "T-001.1", at: "2026-10-26T08:00:00Z" },
    ]);
    expect(runHistory(model, "T-001.1", 20).runs.map((r) => r.id)).toEqual([
      "R-0009",
      "R-0008",
      "R-0003",
      "R-0002",
      "R-0001",
    ]);
  });

  it("S-025.1.4 keeps the runs of a task no plan lists readable", () => {
    const history = runHistory(modelWith([...THREE_RUNS, REMOVED_TASK_RUN]), "T-001.9", 20);
    expect(history).toMatchObject({ ref: "T-001.9", kind: "task", total: 1 });
    expect(history.runs.map((r) => r.id)).toEqual(["R-0006"]);
  });

  it("S-025.1.5 gives a planned task without runs an empty list", () => {
    expect(runHistory(modelWith(THREE_RUNS), "T-001.2", 20)).toEqual({
      ref: "T-001.2",
      kind: "task",
      runs: [],
      total: 0,
    });
  });

  it("S-025.1.6 refuses a task neither planned nor run, and an unknown feature", () => {
    const model = modelWith(THREE_RUNS);
    const unknownTask = failure(() => runHistory(model, "T-001.9", 20));
    expect(unknownTask).toBeInstanceOf(AzimuthError);
    expect(unknownTask).toMatchObject({ code: "not-found", message: "T-001.9 does not exist." });
    const unknownFeature = failure(() => runHistory(model, "F-009", 20));
    expect(unknownFeature).toBeInstanceOf(AzimuthError);
    expect(unknownFeature).toMatchObject({ code: "not-found", message: "F-009 does not exist." });
  });

  it("S-025.1.7 refuses a scenario or run ID as not a task or feature ID", () => {
    const model = modelWith(THREE_RUNS);
    const scenario = failure(() => runHistory(model, "S-001.1.1", 20));
    expect(scenario).toBeInstanceOf(AzimuthError);
    expect(scenario).toMatchObject({
      code: "invalid",
      message: "S-001.1.1 is not a task or feature ID.",
    });
    const run = failure(() => runHistory(model, "R-0001", 20));
    expect(run).toBeInstanceOf(AzimuthError);
    expect(run).toMatchObject({ code: "invalid", message: "R-0001 is not a task or feature ID." });
  });

  it("S-025.1.8 refuses a feature with no tasks and no runs", () => {
    const error = failure(() => runHistory(modelWith(THREE_RUNS), "F-002", 20));
    expect(error).toBeInstanceOf(AzimuthError);
    expect(error).toMatchObject({
      code: "invalid",
      message: "F-002 has no tasks and no verify runs.",
    });
  });
});
