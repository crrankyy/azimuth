import { describe, expect, it } from "vitest";
import { agentsLive, transcriptPage1 } from "../../../../test/fixtures/live/agents";
import { agentRows, type AgentRow } from "../../data/agents";
import { nowLine, stepAgent, TRANSCRIPT_KEYS } from "./transcript";

const sessionRows = (claudeSession: string): AgentRow[] => {
  const session = agentsLive().find((s) => s.claude_session === claudeSession);
  if (!session) throw new Error(`No fixture session ${claudeSession}`);
  return agentRows(session);
};

const rowOf = (rows: AgentRow[], agentId: string | null): AgentRow => {
  const row = rows.find((r) => r.agent_id === agentId);
  if (!row) throw new Error(`No row ${agentId}`);
  return row;
};

describe("F-015 transcript tabs and keys", () => {
  it("S-015.4.3 steps through the agent tabs and stops at either end", () => {
    const rows = sessionRows("c1201");
    expect(stepAgent(rows, null, 1)?.href).toBe("#/agents/c1201/a1");
    expect(stepAgent(rows, "a1", 1)?.href).toBe("#/agents/c1201/a2");
    expect(stepAgent(rows, "a2", 1)).toBeNull();
    expect(stepAgent(rows, null, -1)).toBeNull();
    expect(stepAgent(rows, "a1", -1)?.href).toBe("#/agents/c1201");
    expect(TRANSCRIPT_KEYS).toEqual({ "[": "prev", "]": "next", f: "follow", Escape: "back" });
  });
});

describe("F-015 the transcript's now line", () => {
  it("S-015.4.7 waits for a running subagent, else is working", () => {
    const main = rowOf(sessionRows("c1201"), null);
    const entries = structuredClone(transcriptPage1.entries);
    expect(nowLine(main, entries)).toEqual({
      status: "running",
      text: "Waiting for test-runner…",
    });
    expect(nowLine(main, entries.slice(0, 8))).toEqual({ status: "running", text: "Working…" });
  });

  it("S-015.4.8 has no now line for a done agent and shows the wait while waiting", () => {
    expect(nowLine(rowOf(sessionRows("c1201"), "a2"), [])).toBeNull();
    expect(nowLine(rowOf(sessionRows("c1140"), null), [])).toEqual({
      status: "waiting",
      text: "Permission prompt: WebFetch prometheus.io",
    });
  });
});
