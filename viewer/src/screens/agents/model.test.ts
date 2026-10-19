import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LiveSession } from "../../../../src/core/types";
import { AGENTS_NOW, agentsLive } from "../../../../test/fixtures/live/agents";
import { agentGroups, editedFiles, filterCounts, needsYou, shownGroups } from "./model";

// "Today" is the viewer's local day; the fixture's times are UTC.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const ids = (sessions: LiveSession[]) => sessions.map((s) => s.claude_session);

/** The fixture's session with this Claude Code session ID, from `live`. */
const find = (live: LiveSession[], id: string): LiveSession => {
  const found = live.find((s) => s.claude_session === id);
  if (!found) throw new Error(`No fixture session ${id}`);
  return found;
};

/** The fixture with c1202's code-reviewer also editing src/retry/policy.ts (S-015.3.3). */
function withSharedEdit(): LiveSession[] {
  const live = agentsLive();
  find(live, "c1202").agents[0]!.edits = [
    { file: "src/retry/policy.ts", at: "2026-10-18T12:04:31Z", added: 2, removed: 0 },
  ];
  return live;
}

describe("F-015 the Agents model", () => {
  it("S-015.2.9 shows only the chosen filter's group and counts each filter", () => {
    const groups = agentGroups(agentsLive(), AGENTS_NOW);
    const waiting = shownGroups(groups, "waiting");
    expect([ids(waiting.running), ids(waiting.waiting), ids(waiting.finished)]).toEqual([
      [],
      ["c1140"],
      [],
    ]);
    const finished = shownGroups(groups, "finished");
    expect([ids(finished.running), ids(finished.waiting), ids(finished.finished)]).toEqual([
      [],
      [],
      ["c1100", "c0930"],
    ]);
    expect(filterCounts(groups)).toEqual({ active: 3, running: 2, waiting: 1, finished: 2 });
  });

  it("S-015.3.3 reports a file two agents edit as a conflict", () => {
    expect(editedFiles(withSharedEdit(), []).conflicts).toEqual([
      {
        path: "src/retry/policy.ts",
        editors: [
          { key: "c1201", label: "…1201", href: "#/agents/c1201" },
          { key: "c1202/a3", label: "…1202 code-reviewer", href: "#/agents/c1202/a3" },
        ],
      },
    ]);
  });

  it("S-015.3.4 leaves shared files out of the conflicts", () => {
    const { files, conflicts } = editedFiles(withSharedEdit(), ["src/retry/*.ts"]);
    expect(conflicts).toEqual([]);
    expect(files.find((f) => f.path === "src/retry/policy.ts")?.editors.map((e) => e.key)).toEqual([
      "c1201",
      "c1202/a3",
    ]);
  });

  it("S-015.3.9 lists a subagent's permission prompt after older waits", () => {
    const live = agentsLive();
    const runner = find(live, "c1201").agents[0]!;
    runner.status = "waiting";
    runner.waiting = {
      reason: "Permission prompt: Bash pnpm vitest run",
      since: "2026-10-18T12:04:30Z",
    };
    const waits = needsYou(live);
    expect(waits.map((w) => [w.session.claude_session, w.row.key, w.wait.reason])).toEqual([
      ["c1140", "c1140", "Permission prompt: WebFetch prometheus.io"],
      ["c1201", "c1201/a1", "Permission prompt: Bash pnpm vitest run"],
    ]);
    expect(waits[1]?.row).toMatchObject({
      key: "c1201/a1",
      name: "test-runner",
      href: "#/agents/c1201/a1",
    });
  });
});
