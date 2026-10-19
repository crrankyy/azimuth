import { describe, expect, it } from "vitest";
import { deriveActivity, IDLE_REASON, latestGoal } from "../../src/core/live-agents";
import type { LiveRecord } from "../../src/core/live";

type ToolRecord = Extract<LiveRecord, { kind: "tool" }>;
type WaitRecord = Extract<LiveRecord, { kind: "wait" }>;

/** `10:02:00` → the ISO time on 2026-10-20, as the hooks write it. */
const T = (hms: string) => `2026-10-20T${hms}Z`;
const start = (hms: string, source?: string): LiveRecord => ({
  kind: "start",
  at: T(hms),
  ...(source && { source }),
});
const subagent = (id: string, hms: string): LiveRecord => ({
  kind: "subagent",
  at: T(hms),
  agent_id: id,
  agent_type: "general-purpose",
});
const subagentStop = (id: string, hms: string): LiveRecord => ({
  kind: "subagent-stop",
  at: T(hms),
  agent_id: id,
});
const tool = (hms: string, over: Partial<ToolRecord> = {}): LiveRecord => ({
  kind: "tool",
  at: T(hms),
  tool: "Bash",
  file: null,
  summary: "pnpm build",
  agent_id: null,
  ...over,
});
const wait = (hms: string, over: Partial<WaitRecord> = {}): LiveRecord => ({
  kind: "wait",
  at: T(hms),
  source: "permission",
  reason: "Permission prompt: Bash pnpm build",
  tool: "Bash",
  target: "pnpm build",
  agent_id: null,
  ...over,
});
const note = (hms: string, reason: string): LiveRecord =>
  wait(hms, { source: "notification", reason, tool: null, target: null });
const prompt = (hms: string): LiveRecord => ({ kind: "prompt", at: T(hms) });
const stop = (hms: string): LiveRecord => ({ kind: "stop", at: T(hms) });
const end = (hms: string): LiveRecord => ({ kind: "end", at: T(hms) });

const derive = (records: LiveRecord[], hms: string) =>
  deriveActivity(records, new Date(T(hms)), records[0]?.at ?? "");
const agent = (records: LiveRecord[], hms: string, id: string) =>
  derive(records, hms).agents.get(id);

describe("F-014 waits per agent", () => {
  const BUILD = "Permission prompt: Bash pnpm build";
  const asked = [
    start("10:00:00"),
    subagent("a1", "10:00:10"),
    tool("10:01:00", { agent_id: "a1" }),
    wait("10:02:00", { agent_id: "a1" }),
  ];

  it("S-014.4.1 makes the agent a permission request names wait", () => {
    const activity = derive(asked, "10:05:00");
    const waiting = { reason: BUILD, since: T("10:02:00") };
    expect(activity.agents.get("a1")).toMatchObject({
      status: "waiting",
      waiting,
      waits: [{ from: T("10:02:00"), to: null, reason: BUILD }],
    });
    expect(activity).toMatchObject({ status: "waiting", waiting });
  });

  it("S-014.4.2 ends the wait at the agent's next tool", () => {
    const activity = derive([...asked, tool("10:03:00", { agent_id: "a1" })], "10:05:00");
    expect(activity.agents.get("a1")).toMatchObject({
      status: "running",
      waiting: null,
      waits: [{ from: T("10:02:00"), to: T("10:03:00"), reason: BUILD }],
    });
    expect(activity).toMatchObject({ status: "running", waiting: null });
  });

  it("S-014.4.3 leaves the wait open through another agent's activity", () => {
    const activity = derive([...asked, tool("10:03:00"), prompt("10:04:00")], "10:05:00");
    expect(activity.agents.get("a1")).toMatchObject({
      status: "waiting",
      waiting: { since: T("10:02:00") },
    });
    expect(activity.status).toBe("waiting");
  });

  it("S-014.4.4 ends a notification for an unknown agent at any agent's next record", () => {
    const reason = "Permission prompt: Claude needs your permission to use Bash";
    const records = [
      start("10:00:00"),
      tool("10:01:00"),
      subagent("a1", "10:01:30"),
      note("10:02:00", reason),
      tool("10:03:00", { agent_id: "a1" }),
    ];
    expect(derive(records, "10:05:00").main).toMatchObject({
      waiting: null,
      waits: [{ from: T("10:02:00"), to: T("10:03:00"), reason }],
    });
  });

  it("S-014.4.5 adds nothing for a notification during an open permission wait", () => {
    const records = [
      start("10:00:00"),
      subagent("a1", "10:00:10"),
      wait("10:02:00", { agent_id: "a1" }),
      note("10:02:06", "Permission prompt: Claude needs your permission to use Bash"),
    ];
    const activity = derive(records, "10:05:00");
    expect(activity.main).toMatchObject({ status: "running", waits: [] });
    expect(activity.agents.get("a1")?.waits).toEqual([
      { from: T("10:02:00"), to: null, reason: BUILD },
    ]);
  });

  it("S-014.4.6 keeps the first wait's start for a repeated request", () => {
    const LINT = "Permission prompt: Bash pnpm lint";
    const records = [
      start("10:00:00"),
      wait("10:02:00"),
      wait("10:02:30", { reason: LINT, target: "pnpm lint" }),
    ];
    expect(derive(records, "10:05:00").main).toMatchObject({
      waiting: { reason: LINT, since: T("10:02:00") },
      waits: [{ from: T("10:02:00"), to: null, reason: LINT }],
    });
  });
});

describe("F-014 statuses", () => {
  const turn = [start("10:00:00"), prompt("10:00:05"), tool("10:01:00"), stop("10:02:00")];

  it("S-014.5.1 makes a main agent that finished its turn wait for your prompt", () => {
    const activity = derive(turn, "10:10:00");
    expect(activity.main).toMatchObject({
      status: "waiting",
      waiting: { reason: IDLE_REASON, since: T("10:02:00") },
      waits: [{ from: T("10:02:00"), to: null, reason: IDLE_REASON }],
    });
    expect(activity.status).toBe("waiting");
  });

  it("S-014.5.2 makes an idle session done after 30 minutes", () => {
    expect(derive(turn, "10:32:00").main.status).toBe("waiting");
    const activity = derive(turn, "10:32:01");
    expect(activity.main).toMatchObject({
      status: "done",
      ended_at: T("10:02:00"),
      waiting: null,
      waits: [],
    });
    expect(activity.status).toBe("done");
  });

  it("S-014.5.3 ends the idle span at your next prompt", () => {
    const records = [...turn, prompt("10:12:00"), tool("10:12:30")];
    expect(derive(records, "10:13:00").main).toMatchObject({
      status: "running",
      waits: [{ from: T("10:02:00"), to: T("10:12:00"), reason: IDLE_REASON }],
    });
  });

  it("S-014.5.4 keeps an idle session running while a subagent works", () => {
    const records = [
      start("10:00:00"),
      subagent("a1", "10:00:30"),
      stop("10:02:00"),
      tool("10:04:00", { agent_id: "a1" }),
    ];
    const activity = derive(records, "10:05:00");
    expect(activity.main.status).toBe("waiting");
    expect(activity.agents.get("a1")?.status).toBe("running");
    expect(activity).toMatchObject({ status: "running", waiting: null });
  });

  it("S-014.5.5 makes a finished subagent done at its stop", () => {
    const records = [
      start("10:00:00"),
      subagent("a1", "10:00:30"),
      tool("10:01:00", { agent_id: "a1" }),
      subagentStop("a1", "10:04:00"),
    ];
    expect(agent(records, "10:05:00", "a1")).toMatchObject({
      status: "done",
      started_at: T("10:00:30"),
      ended_at: T("10:04:00"),
    });
  });

  it("S-014.5.6 makes an ended session done with all its agents", () => {
    const records = [
      start("10:00:00"),
      subagent("a1", "10:00:30"),
      wait("10:01:00", { agent_id: "a1" }),
      end("10:03:00"),
    ];
    const activity = derive(records, "10:05:00");
    expect(activity.main).toMatchObject({ status: "done", ended_at: T("10:03:00") });
    expect(activity.agents.get("a1")).toMatchObject({
      status: "done",
      ended_at: T("10:03:00"),
      waits: [
        { from: T("10:01:00"), to: T("10:03:00"), reason: "Permission prompt: Bash pnpm build" },
      ],
    });
    expect(activity).toMatchObject({ status: "done", waiting: null });
  });

  it("S-014.5.7 makes a session that went quiet without stopping done after 30 minutes", () => {
    const records = [start("10:00:00"), tool("10:01:00")];
    expect(derive(records, "10:31:00").main.status).toBe("running");
    expect(derive(records, "10:31:01").main).toMatchObject({
      status: "done",
      ended_at: T("10:01:00"),
    });
  });

  it("S-014.5.8 never expires a permission wait", () => {
    const reason = "Permission prompt: WebFetch prometheus.io";
    const records = [
      start("10:00:00"),
      wait("10:02:00", { reason, tool: "WebFetch", target: "prometheus.io" }),
    ];
    const activity = derive(records, "12:00:00");
    const waiting = { reason, since: T("10:02:00") };
    expect(activity.main).toMatchObject({ status: "waiting", waiting });
    expect(activity).toMatchObject({ status: "waiting", waiting });
  });

  it("S-014.5.9 runs a resumed session again", () => {
    const records = [
      start("10:00:00"),
      end("10:03:00"),
      start("10:20:00", "resume"),
      tool("10:20:30"),
    ];
    const activity = derive(records, "10:21:00");
    expect(activity.main).toMatchObject({ status: "running", ended_at: null });
    expect(activity.status).toBe("running");
  });
});

describe("F-014 current actions and edits", () => {
  it("S-014.6.1 keeps each agent's own current action and edits", () => {
    const records = [
      start("10:00:00"),
      tool("10:01:00", {
        tool: "Edit",
        file: "src/a.ts",
        summary: "Edited src/a.ts",
        added: 4,
        removed: 1,
      }),
      subagent("a1", "10:01:10"),
      tool("10:02:00", {
        tool: "Read",
        file: "src/b.ts",
        summary: "Read src/b.ts",
        agent_id: "a1",
      }),
      tool("10:03:00", {
        tool: "Edit",
        file: "src/c.ts",
        summary: "Edited src/c.ts",
        agent_id: "a1",
        failed: true,
        error: "String to replace not found",
      }),
    ];
    const activity = derive(records, "10:04:00");
    expect(activity.main.current).toEqual({
      at: T("10:01:00"),
      tool: "Edit",
      file: "src/a.ts",
      summary: "Edited src/a.ts",
      agent_id: null,
      added: 4,
      removed: 1,
      error: null,
    });
    expect(activity.main.edits).toEqual([
      { file: "src/a.ts", at: T("10:01:00"), added: 4, removed: 1 },
    ]);
    const a1 = activity.agents.get("a1");
    expect(a1?.current).toMatchObject({
      tool: "Edit",
      file: "src/c.ts",
      error: "String to replace not found",
    });
    expect(a1?.edits).toEqual([]);
  });

  it("S-014.6.2 keeps only the last five edits", () => {
    const writes = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      tool(`10:0${n}:00`, { tool: "Write", file: `e${n}.ts`, summary: `Wrote e${n}.ts` }),
    );
    const edits = derive([start("10:00:00"), ...writes], "10:08:00").main.edits;
    expect(edits.map((e) => e.file)).toEqual(["e3.ts", "e4.ts", "e5.ts", "e6.ts", "e7.ts"]);
  });

  it("S-014.6.3 reads logs written before this feature", () => {
    const records = [
      start("10:00:00"),
      tool("10:01:00", { tool: "Edit", file: "src/a.ts", summary: "Edited src/a.ts" }),
    ];
    const main = derive(records, "10:02:00").main;
    expect(main).toMatchObject({
      status: "running",
      waits: [],
      edits: [{ file: "src/a.ts", at: T("10:01:00"), added: null, removed: null }],
      current: { added: null, removed: null, error: null },
    });
  });
});

describe("F-014 latest goal", () => {
  const session = { goal: "Spec F-014", skill: "spec", goals: "" };

  it("takes the last Goals bullet, with a skill when its first part has no spaces", () => {
    const goals = "- 09:00 · spec · Spec F-014\n- 10:30 · build · Build F-014";
    expect(latestGoal({ ...session, goals })).toEqual({ goal: "Build F-014", skill: "build" });
    expect(latestGoal({ ...session, goals: "- 10:30 · Fix the build · again" })).toEqual({
      goal: "Fix the build · again",
      skill: null,
    });
  });

  it("falls back to the frontmatter goal and skill", () => {
    expect(latestGoal(session)).toEqual({ goal: "Spec F-014", skill: "spec" });
    expect(latestGoal({ goal: "", skill: null, goals: "" })).toEqual({ goal: null, skill: null });
  });
});
