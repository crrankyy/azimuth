import { afterEach, describe, expect, it } from "vitest";
import { derive } from "../../src/core/derive";
import type { Facts } from "../../src/core/facts";
import { nextGate, type GateContext } from "../../src/core/gates";
import type { Model } from "../../src/core/model";
import { sortProblems, validate } from "../../src/core/validate";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

function analyze(model: Model, facts: Facts): GateContext {
  const derived = derive(model, facts);
  const problems = sortProblems([...model.problems, ...validate(model, facts, derived)]);
  return { model, facts, derived, problems };
}

interface RunSpec {
  id: string;
  target: string;
  ok: boolean;
  at?: string;
  /** Left out of the run file when the key is absent here. */
  prebuild?: { ok: boolean; duration_ms: number } | null;
}

function runFile({ id, target, ok, at = "2026-10-17T10:00:00Z", ...rest }: RunSpec): string {
  return JSON.stringify({ id, target, at, ok, commit: "aaaaaaa", scenarios: [], ...rest });
}

/** F-001's done.verify-passed check: verifying, T-001.1 and T-001.2 done, HEAD aaaaaaa. */
function verifyCheck(runs: RunSpec[]) {
  const tree = loadTree({
    ...featureFiles({
      id: "F-001",
      status: "verifying",
      tasks: [
        { id: "T-001.1", status: "done", covers: ["S-001.1.1"] },
        { id: "T-001.2", status: "done", covers: ["S-001.1.2"] },
      ],
    }),
    ...Object.fromEntries(runs.map((r) => [`.azimuth/cache/runs/${r.id}.json`, runFile(r)])),
  });
  cleanup = tree.cleanup;
  const facts = makeFacts({
    git: {
      available: true,
      head: "aaaaaaa",
      commits: [
        {
          sha: "aaaaaaa",
          at: "2026-10-17T09:00:00Z",
          actor: "agent",
          session: null,
          subject: "x",
          refs: ["T-001.1", "T-001.2"],
          files_changed: 1,
        },
      ],
    },
  });
  const gate = nextGate(analyze(tree.model, facts), tree.model.features[0]!);
  return gate?.checks.find((c) => c.id === "done.verify-passed");
}

const FAILED_PREBUILD = { ok: false, duration_ms: 3100 };
const PASSING_PREBUILD = { ok: true, duration_ms: 41200 };
const R1: RunSpec = { id: "R-0001", target: "T-001.1", ok: true, prebuild: FAILED_PREBUILD };
const R2: RunSpec = { id: "R-0002", target: "T-001.2", ok: true, prebuild: PASSING_PREBUILD };

describe("ST-018.5 the done gate asks for a rerun with a working build", () => {
  it("S-018.5.1 lists a pass after a failed prebuild as needing a rerun", () => {
    expect(verifyCheck([R1, R2])).toMatchObject({
      ok: false,
      detail: "T-001.1 passed after a failed prebuild",
    });
  });

  it("S-018.5.2 passes once a later run of the task had a working prebuild", () => {
    const rerun: RunSpec = {
      id: "R-0003",
      target: "T-001.1",
      ok: true,
      at: "2026-10-17T11:00:00Z",
      prebuild: PASSING_PREBUILD,
    };
    expect(verifyCheck([R1, R2, rerun])).toMatchObject({ ok: true });
  });

  it("S-018.5.3 counts runs without a prebuild key or with a null prebuild as before", () => {
    const noKey: RunSpec = { id: "R-0001", target: "T-001.1", ok: true };
    const nullPrebuild: RunSpec = { id: "R-0002", target: "T-001.2", ok: true, prebuild: null };
    expect(verifyCheck([noKey, nullPrebuild])).toMatchObject({ ok: true });
  });

  it("S-018.5.4 names a failed run before a pass after a failed prebuild", () => {
    const failed: RunSpec = { id: "R-0002", target: "T-001.2", ok: false };
    expect(verifyCheck([R1, failed])).toMatchObject({
      ok: false,
      detail: "T-001.2 failed at aaaaaaa",
    });
  });
});
