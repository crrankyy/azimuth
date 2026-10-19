import { describe, expect, it } from "vitest";
import type { LiveSession } from "../../../src/core/types";
import { agentsLive, liveAgent, liveSession } from "../../../test/fixtures/live/agents";
import { actionLabel, agentDuration, agentRows, sessionLabel, shortLabel } from "./agents";

const session = (id: string): LiveSession => {
  const found = agentsLive().find((s) => s.claude_session === id);
  if (!found) throw new Error(`No fixture session ${id}`);
  return found;
};

describe("F-015 agent rows and labels", () => {
  it("S-015.6.6 turns a session into its main agent's row, then one per subagent", () => {
    const rows = agentRows(session("c1201"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      key: "c1201",
      agent_id: null,
      name: "Main session",
      description: "Turn S-005.2.1 green: implement retry exhaustion",
      status: "running",
      task: "T-005.4",
      href: "#/agents/c1201",
    });
    expect(rows[1]).toMatchObject({
      key: "c1201/a1",
      name: "test-runner",
      status: "running",
      href: "#/agents/c1201/a1",
    });
    expect(rows[2]).toMatchObject({
      key: "c1201/a2",
      name: "explorer",
      status: "done",
      ended_at: "2026-10-18T12:02:32Z",
    });
    expect(agentDuration(rows[2]!, Date.parse("2026-10-18T12:05:00Z"))).toBe(72_000);
  });

  it("S-015.6.7 names a subagent without a type plainly", () => {
    const rows = agentRows(
      liveSession({ agents: [liveAgent({ agent_id: "a7", agent_type: null, description: null })] }),
    );
    expect(rows[1]).toMatchObject({ key: "c1/a7", name: "subagent", description: null });
  });

  it("S-015.6.8 labels sessions by their SES and actions by tool and file", () => {
    const c1201 = session("c1201");
    expect(sessionLabel(c1201)).toBe("SES-20261018-1201");
    expect(shortLabel(c1201)).toBe("…1201");
    expect(actionLabel(c1201.main.current!)).toBe("Edit src/retry/policy.ts");
    expect(actionLabel(session("c1202").agents[0]!.current!)).toBe("Read src/api/attempts.ts");
    expect(actionLabel(c1201.agents[0]!.current!)).toBe("pnpm vitest run src/retry/policy.test.ts");
    const bare = liveSession({ ses: null, claude_session: "7f3a9c2e-1202-4b1d" });
    expect(sessionLabel(bare)).toBe("7f3a9c2e");
    expect(shortLabel(bare)).toBe("7f3a9c2e");
  });
});
