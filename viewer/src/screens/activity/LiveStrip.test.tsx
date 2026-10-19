import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, LiveActivity, LiveAgent, LiveSession } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { IndexContext } from "../../data/IndexProvider";
import { LiveStrip } from "./LiveStrip";

const NOW = Date.parse("2026-10-18T18:06:00Z");

function withIndex(children: ReactNode) {
  const value = {
    index: expectedIndex as unknown as Index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return <IndexContext.Provider value={value}>{children}</IndexContext.Provider>;
}

const activity: LiveActivity = {
  status: "running",
  waiting: null,
  current: null,
  started_at: "2026-10-18T18:00:00Z",
  ended_at: null,
  edits: [],
  waits: [],
  transcript: false,
};

const agent = (over: Partial<LiveAgent>): LiveAgent => ({
  ...activity,
  agent_id: "a1",
  agent_type: "general-purpose",
  last_seen_at: "2026-10-18T18:05:50Z",
  description: null,
  task: null,
  feature: null,
  stopped_at: null,
  ...over,
});

const session = (over: Partial<LiveSession>): LiveSession => ({
  claude_session: "c1",
  ses: null,
  started_at: "2026-10-18T18:00:00Z",
  last_seen_at: "2026-10-18T18:05:50Z",
  stopped_at: null,
  ended_at: null,
  agents: [],
  current: null,
  feature: null,
  task: null,
  features: [],
  events: [],
  main: activity,
  status: "running",
  waiting: null,
  goal: null,
  skill: null,
  ...over,
});

const render = (s: LiveSession) =>
  renderToStaticMarkup(withIndex(<LiveStrip live={[s]} now={NOW} />));
const lanes = (html: string) => html.split('<li class="live-lane').slice(1);

describe("F-005 live lanes", () => {
  it("S-005.3.1 names a lane after its assignment, with its task", () => {
    const html = render(
      session({
        agents: [agent({ description: "Build T-002.2 heading recognizer", task: "T-002.2" })],
      }),
    );
    const [lane] = lanes(html);
    expect(lane).toContain("Build T-002.2 heading recognizer");
    expect(lane).toContain(">T-002.2<");
  });

  it("S-005.3.2 shows every feature in flight on the session row", () => {
    const html = render(session({ features: ["F-002", "F-003"] }));
    const row = html.split('class="live-row-head"')[1] ?? "";
    expect(row).toContain(">F-002<");
    expect(row).toContain(">F-003<");
  });

  it("S-005.3.3 falls back to the subagent's type without an assignment", () => {
    const [lane] = lanes(render(session({ agents: [agent({})] })));
    expect(lane).toContain(">general-purpose<");
    expect(lane).not.toContain("az-id");
  });

  it("S-005.3.4 marks a finished subagent's lane", () => {
    const [lane] = lanes(
      render(session({ agents: [agent({ stopped_at: "2026-10-18T18:05:55Z" })] })),
    );
    expect(lane).toContain("Finished");
    expect(lane).not.toContain("az-live");
  });
});
