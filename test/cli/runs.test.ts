import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

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

const runId = (n: number) => `R-${String(n).padStart(4, "0")}`;

/** Passing one-second runs of T-001.1 at `commit` 9f3c2e1, R-0001 to R-<count>. */
function passingRuns(count: number, at: (n: number) => string): RunSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: runId(i + 1),
    target: "T-001.1",
    at: at(i + 1),
    waited_ms: 0,
    prebuild: null,
  }));
}

const TWO_HUNDRED_TEN_RUNS = passingRuns(210, (n) =>
  new Date(Date.parse("2026-10-19T00:00:00Z") + n * 60_000).toISOString().replace(".000Z", "Z"),
);

/** F-001 in progress planning T-001.1 and T-001.2, F-002 an idea, and `runs` in the cache. */
function project(runs: RunSpec[]): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
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
  return tree.root;
}

const USAGE = "Usage: azimuth runs <T-ID|F-ID> [--limit N] [--json]\n";

describe("ST-025.2 azimuth runs prints one line per run", () => {
  it("S-025.2.1 prints a task's runs one line each, newest first", async () => {
    const r = await runCli(project(THREE_RUNS), ["runs", "T-001.1"]);
    expect(r).toEqual({
      code: 0,
      out:
        "R-0003 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\n" +
        "R-0002 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\n" +
        "R-0001 2026-10-19T09:00:00Z 9f3c2e1 passed in 12.4s, prebuild passed in 41.2s\n",
      err: "",
    });
  });

  it("S-025.2.2 names each run's task when listing a feature", async () => {
    const root = project([
      ...FOUR_RUNS,
      {
        id: "R-0005",
        target: "T-002.1",
        duration_ms: 500,
        at: "2026-10-26T08:00:00Z",
        commit: "a1b2c3d",
      },
    ]);
    const r = await runCli(root, ["runs", "F-001"]);
    expect([r.code, r.out]).toEqual([
      0,
      "R-0003 T-001.1 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\n" +
        "R-0004 T-001.2 2026-10-20T10:00:00Z a1b2c3d passed in 0.9s\n" +
        "R-0002 T-001.1 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\n" +
        "R-0001 T-001.1 2026-10-19T09:00:00Z 9f3c2e1 passed in 12.4s, prebuild passed in 41.2s\n",
    ]);
  });

  it("S-025.2.3 caps the lines at --limit and counts the older runs", async () => {
    const r = await runCli(project(THREE_RUNS), ["runs", "T-001.1", "--limit", "2"]);
    expect([r.code, r.out]).toEqual([
      0,
      "R-0003 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\n" +
        "R-0002 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\n" +
        "… and 1 older\n",
    ]);
  });

  it("S-025.2.4 prints twenty runs when --limit isn't given", async () => {
    const runs = passingRuns(22, (n) => `2026-10-19T09:${String(n).padStart(2, "0")}:00Z`);
    const r = await runCli(project(runs), ["runs", "T-001.1"]);
    expect(r.code).toBe(0);
    const lines = r.out.trimEnd().split("\n");
    expect(lines).toHaveLength(21);
    expect(lines[0]).toBe("R-0022 2026-10-19T09:22:00Z 9f3c2e1 passed in 1.0s");
    expect(lines[19]).toMatch(/^R-0003 /);
    expect(lines[20]).toBe("… and 2 older");
  });

  it("S-025.2.5 lists every run of the task, beyond the index's latest", async () => {
    const r = await runCli(project(TWO_HUNDRED_TEN_RUNS), ["runs", "T-001.1", "--limit", "250"]);
    expect(r.code).toBe(0);
    const lines = r.out.trimEnd().split("\n");
    expect(lines).toHaveLength(210);
    expect(lines[0]).toMatch(/^R-0210 /);
    expect(lines.at(-1)).toBe("R-0001 2026-10-19T00:01:00Z 9f3c2e1 passed in 1.0s");
  });

  it("S-025.2.6 says a planned task has no runs yet, and prints [] with --json", async () => {
    const root = project(THREE_RUNS);
    const r = await runCli(root, ["runs", "T-001.2"]);
    expect([r.code, r.out]).toEqual([0, "No verify runs for T-001.2 yet.\n"]);
    const json = await runCli(root, ["runs", "T-001.2", "--json"]);
    expect([json.code, json.out]).toEqual([0, "[]\n"]);
  });

  it("S-025.2.7 refuses a question ID as not a task or feature ID", async () => {
    const root = project(THREE_RUNS);
    expect((await runCli(root, ["new", "question", "Which one?"])).code).toBe(0);
    const r = await runCli(root, ["runs", "Q-0001"]);
    expect(r).toEqual({ code: 1, out: "", err: "✗ Q-0001 is not a task or feature ID.\n" });
  });

  it("S-025.2.8 refuses a task neither planned nor run", async () => {
    const r = await runCli(project(THREE_RUNS), ["runs", "T-001.9"]);
    expect(r).toEqual({ code: 1, out: "", err: "✗ T-001.9 does not exist.\n" });
  });

  it("S-025.2.9 rejects a --limit that isn't a whole number of at least 1", async () => {
    const root = project(THREE_RUNS);
    const zero = await runCli(root, ["runs", "T-001.1", "--limit", "0"]);
    expect(zero).toEqual({
      code: 2,
      out: "",
      err: `--limit takes a whole number of at least 1, not "0".\n${USAGE}`,
    });
    const fraction = await runCli(root, ["runs", "T-001.1", "--limit", "2.5"]);
    expect([fraction.code, fraction.err]).toEqual([
      2,
      `--limit takes a whole number of at least 1, not "2.5".\n${USAGE}`,
    ]);
  });

  it("S-025.2.10 prints the run records without their output tails with --json", async () => {
    const r = await runCli(project(THREE_RUNS), ["runs", "T-001.1", "--json"]);
    expect(r.code).toBe(0);
    const runs = JSON.parse(r.out) as Record<string, unknown>[];
    expect(runs.map((run) => run.id)).toEqual(["R-0003", "R-0002", "R-0001"]);
    expect(runs.filter((run) => "output_tail" in run)).toEqual([]);
    expect(runs[1]).toEqual({
      id: "R-0002",
      target: "T-001.1",
      command: "pnpm test",
      ok: true,
      exit_code: 0,
      duration_ms: 11800,
      at: "2026-10-19T15:00:00Z",
      commit: "a1b2c3d",
      scenarios: [],
      junit: null,
      waited_ms: 40500,
      prebuild: null,
    });
  });
});
