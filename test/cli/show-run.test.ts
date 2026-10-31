import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** A run record, written to its file as given: keys left out here stay out of the file. */
type RunSpec = Record<string, unknown> & { id: string };

function runFile(spec: RunSpec): string {
  return JSON.stringify({
    target: "T-001.1",
    command: "pnpm test",
    ok: true,
    exit_code: 0,
    duration_ms: 1000,
    commit: "9f3c2e1",
    scenarios: [],
    junit: null,
    output_tail: "",
    ...spec,
  });
}

const R_0003: RunSpec = {
  id: "R-0003",
  ok: false,
  exit_code: 1,
  duration_ms: 2100,
  at: "2026-10-24T08:00:00Z",
  commit: "0c4d5e6",
  output_tail: "FAIL test/a.test.ts > S-001.1.1 opens\nTimed out in 5000ms",
};

const THREE_RUNS: RunSpec[] = [
  {
    id: "R-0001",
    duration_ms: 12400,
    at: "2026-10-19T09:00:00Z",
    commit: "9f3c2e1",
    waited_ms: 0,
    prebuild: { ok: true, duration_ms: 41200 },
  },
  {
    id: "R-0002",
    duration_ms: 11800,
    at: "2026-10-19T15:00:00Z",
    commit: "a1b2c3d",
    waited_ms: 40500,
    prebuild: null,
  },
  R_0003,
];

const TWO_HUNDRED_TEN_RUNS: RunSpec[] = Array.from({ length: 210 }, (_, i) => ({
  id: `R-${String(i + 1).padStart(4, "0")}`,
  at: new Date(Date.parse("2026-10-19T00:00:00Z") + (i + 1) * 60_000)
    .toISOString()
    .replace(".000Z", "Z"),
  waited_ms: 0,
  prebuild: null,
}));

/** F-001 in progress planning T-001.1 and T-001.2, and `runs` in the cache. */
function project(runs: RunSpec[], raw: Record<string, string> = {}): string {
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
    ...Object.fromEntries(runs.map((r) => [`.azimuth/cache/runs/${r.id}.json`, runFile(r)])),
    ...raw,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("ST-025.3 azimuth show R-NNNN prints the whole run", () => {
  it("S-025.3.1 lists every field of a run, then its output", async () => {
    const full: RunSpec = {
      ...R_0003,
      command: "pnpm exec vitest run test/a.test.ts",
      waited_ms: 400,
      ses: "SES-20261024-0750",
      prebuild: { ok: true, duration_ms: 41200 },
      junit: { tests: 2, failures: 1, errors: 0, skipped: 0 },
      scenarios: [
        { id: "S-001.1.1", status: "failing" },
        { id: "S-001.1.2", status: "passing" },
      ],
    };
    const r = await runCli(project([...THREE_RUNS.slice(0, 2), full]), ["show", "R-0003"]);
    expect(r).toEqual({
      code: 0,
      out:
        "R-0003 T-001.1 failed (exit 1) in 2.1s\n" +
        "At: 2026-10-24T08:00:00Z\n" +
        "Commit: 0c4d5e6\n" +
        "Command: pnpm exec vitest run test/a.test.ts\n" +
        "Waited: 1s\n" +
        "Session: SES-20261024-0750\n" +
        "Prebuild: passed in 41.2s\n" +
        "JUnit: tests 2, failures 1, errors 0, skipped 0\n" +
        "Scenarios: S-001.1.1 failing, S-001.1.2 passing\n" +
        "Output:\n" +
        "    FAIL test/a.test.ts > S-001.1.1 opens\n" +
        "    Timed out in 5000ms\n",
      err: "",
    });
  });

  it("S-025.3.2 prints a run file from before the newer keys", async () => {
    const root = project([], {
      ".azimuth/cache/runs/R-0020.json":
        '{"id":"R-0020","target":"T-001.1","command":"pnpm test","ok":true,"exit_code":0,"duration_ms":1000,"at":"2026-10-01T10:00:00Z","commit":null,"output_tail":"","scenarios":[],"junit":null}',
    });
    const r = await runCli(root, ["show", "R-0020"]);
    expect(r).toEqual({
      code: 0,
      out:
        "R-0020 T-001.1 passed in 1.0s\n" +
        "At: 2026-10-01T10:00:00Z\n" +
        "Commit: none\n" +
        "Command: pnpm test\n" +
        "Prebuild: none\n" +
        "Output: (none)\n",
      err: "",
    });
  });

  it("S-025.3.3 says twice that a run followed a failed prebuild", async () => {
    const root = project([
      {
        id: "R-0021",
        at: "2026-10-25T08:00:00Z",
        commit: "0c4d5e6",
        waited_ms: 0,
        ses: null,
        prebuild: { ok: false, duration_ms: 3100 },
      },
    ]);
    const r = await runCli(root, ["show", "R-0021"]);
    expect(r).toEqual({
      code: 0,
      out:
        "R-0021 T-001.1 passed in 1.0s after a failed prebuild\n" +
        "At: 2026-10-25T08:00:00Z\n" +
        "Commit: 0c4d5e6\n" +
        "Command: pnpm test\n" +
        "Waited: 0s\n" +
        "Session: none\n" +
        "Prebuild: failed in 3.1s\n" +
        "Output: (none)\n",
      err: "",
    });
  });

  it("S-025.3.4 prints the run's line with --brief", async () => {
    const r = await runCli(project(THREE_RUNS), ["show", "R-0003", "--brief"]);
    expect(r).toEqual({
      code: 0,
      out: "R-0003 T-001.1 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\n",
      err: "",
    });
  });

  it("S-025.3.5 prints the whole run record with --json", async () => {
    const r = await runCli(project(THREE_RUNS), ["show", "R-0003", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({
      id: "R-0003",
      target: "T-001.1",
      command: "pnpm test",
      ok: false,
      exit_code: 1,
      duration_ms: 2100,
      at: "2026-10-24T08:00:00Z",
      commit: "0c4d5e6",
      output_tail: "FAIL test/a.test.ts > S-001.1.1 opens\nTimed out in 5000ms",
      scenarios: [],
      junit: null,
      prebuild: null,
    });
  });

  it("S-025.3.6 finds a run older than the index's window", async () => {
    const root = project(TWO_HUNDRED_TEN_RUNS);
    const r = await runCli(root, ["show", "R-0001", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ id: "R-0001", at: "2026-10-19T00:01:00Z" });
    expect(buildIndex(root).index.runs.filter((run) => run.id === "R-0001")).toEqual([]);
  });

  it("S-025.3.7 refuses an unknown run as show does today", async () => {
    const r = await runCli(project(THREE_RUNS), ["show", "R-0999"]);
    expect(r).toEqual({
      code: 2,
      out: "",
      err: "R-0999 not found.\nUsage: azimuth show <ID> [--brief | --json]\n",
    });
  });

  it("S-025.3.8 still prints the brief of an ID that isn't a run", async () => {
    const r = await runCli(project(THREE_RUNS), ["show", "T-001.1"]);
    expect(r.code).toBe(0);
    expect(r.out.split("\n")[0]).toBe("T-001.1 todo Task T-001.1 (in F-001 in-progress)");
  });
});
