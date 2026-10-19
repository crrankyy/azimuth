import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  anySessionOpen,
  appendLive,
  liveDir,
  liveFile,
  liveMetaFile,
  processAlive,
  pruneLive,
  readLiveMeta,
  readLiveRecords,
  readLiveSessions,
  sessionOpen,
  sessionsLastSeen,
  summarizeLive,
  transcriptPathOf,
  updateLiveMeta,
  type LiveRecord,
  type OpenCheck,
} from "../../src/core/live";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const NOW = new Date("2026-10-18T12:00:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) =>
  new Date(NOW.getTime() - hours * HOUR).toISOString().replace(/\.\d{3}Z$/, "Z");
const check = (running: number[] = [4242]): OpenCheck => ({
  now: NOW,
  idleMs: 2 * HOUR,
  alive: (pid) => running.includes(pid),
});

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

describe("sessionOpen", () => {
  it("counts a session whose process runs as open, however long it has been quiet", () => {
    expect(sessionOpen([{ kind: "start", at: ago(10), pid: 4242 }], check())).toBe(true);
  });

  it("S-001.1.2 doesn't count a session that ended, until it starts again", () => {
    const ended: LiveRecord[] = [
      { kind: "start", at: ago(1), pid: 4242 },
      { kind: "end", at: ago(0.5), reason: "prompt_input_exit" },
    ];
    expect(sessionOpen(ended, check())).toBe(false);
    expect(sessionOpen([...ended, { kind: "start", at: ago(0.1), pid: 4242 }], check())).toBe(true);
  });

  it("S-001.1.3 doesn't count a session whose process is gone", () => {
    expect(sessionOpen([{ kind: "start", at: ago(0.1), pid: 4242 }], check([]))).toBe(false);
  });

  it("S-001.1.4 keeps the idle rule for a session without a process ID", () => {
    expect(sessionOpen([{ kind: "start", at: ago(3) }], check())).toBe(false);
    expect(sessionOpen([{ kind: "start", at: ago(1) }], check())).toBe(true);
  });

  it("follows the latest process ID, including one recorded by a prompt", () => {
    const records: LiveRecord[] = [
      { kind: "start", at: ago(5), pid: 1111 },
      { kind: "prompt", at: ago(4), pid: 4242 },
    ];
    expect(sessionOpen(records, check([4242]))).toBe(true);
    expect(sessionOpen(records, check([1111]))).toBe(false);
  });

  it("stops trusting a process ID once the log is a day old", () => {
    expect(sessionOpen([{ kind: "start", at: ago(25), pid: 4242 }], check())).toBe(false);
  });
});

describe("anySessionOpen", () => {
  it("looks at every Claude Code session of the project", () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    const now = { ...check(), now: new Date() };
    const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(anySessionOpen(tree.root, now)).toBe(false);
    appendLive(tree.root, "ended", { kind: "start", at, pid: 4242 });
    appendLive(tree.root, "ended", { kind: "end", at });
    expect(anySessionOpen(tree.root, now)).toBe(false);
    appendLive(tree.root, "open", { kind: "start", at, pid: 4242 });
    expect(anySessionOpen(tree.root, now)).toBe(true);
  });
});

describe("processAlive", () => {
  it("tells a running process from one that exited", () => {
    expect(processAlive(process.pid)).toBe(true);
    const exited = spawnSync("true").pid;
    expect(processAlive(exited)).toBe(false);
  });
});

describe("F-005 subagent assignments", () => {
  const at = (minute: number) => `2026-10-18T18:${String(minute).padStart(2, "0")}:00Z`;
  const launch = (id: string, description: string, refs: string[], minute = 0): LiveRecord => ({
    kind: "launch",
    at: at(minute),
    tool_use_id: id,
    description,
    refs,
  });
  const started = (id: string, minute = 1): LiveRecord => ({
    kind: "subagent",
    at: at(minute),
    agent_id: id,
    agent_type: "general-purpose",
  });
  const agentTool = (useId: string, spawned: string, minute = 2): LiveRecord => ({
    kind: "tool",
    at: at(minute),
    tool: "Agent",
    file: null,
    summary: "Started an agent",
    agent_id: null,
    tool_use_id: useId,
    spawned,
  });
  const agents = (records: LiveRecord[]) =>
    Object.fromEntries(
      (summarizeLive("s", records)?.agents ?? []).map((a) => [
        a.agent_id,
        { description: a.description, task: a.task, feature: a.feature },
      ]),
    );
  const twoLaunches = [
    launch("toolu_1", "Build T-002.2 heading recognizer", ["T-002.2"]),
    launch("toolu_2", "Build T-003.1 code spans", ["T-003.1"]),
    started("a1"),
    started("a2"),
  ];

  it("S-005.2.1 matches a subagent exactly by the Agent tool's response", () => {
    const records = [
      launch("toolu_1", "Build T-002.2 heading recognizer", ["T-002.2"]),
      started("a1"),
      agentTool("toolu_1", "a1"),
    ];
    expect(agents(records)).toEqual({
      a1: { description: "Build T-002.2 heading recognizer", task: "T-002.2", feature: "F-002" },
    });
  });

  it("S-005.2.2 matches running subagents to launches in order", () => {
    expect(agents(twoLaunches)).toMatchObject({
      a1: { task: "T-002.2" },
      a2: { task: "T-003.1" },
    });
  });

  it("S-005.2.3 lets an exact match override the order", () => {
    const records = [...twoLaunches, agentTool("toolu_1", "a2", 3), agentTool("toolu_2", "a1", 4)];
    expect(agents(records)).toMatchObject({
      a1: { task: "T-003.1" },
      a2: { task: "T-002.2" },
    });
  });

  it("S-005.2.4 keeps a subagent without a launch, unassigned", () => {
    expect(agents([started("a9")])).toEqual({
      a9: { description: null, task: null, feature: null },
    });
  });

  const inFlight: LiveRecord[] = [
    {
      kind: "tool",
      at: at(0),
      tool: "Bash",
      file: null,
      summary: "azimuth move T-003.4 in-progress",
      agent_id: null,
    },
    launch("toolu_1", "Build T-002.2 heading recognizer", ["T-002.2"], 1),
    started("a1", 2),
  ];

  it("S-005.2.5 lists every feature in flight across the lanes", () => {
    expect(summarizeLive("s", inFlight)?.features).toEqual(["F-002", "F-003"]);
  });

  it("S-005.2.6 drops a finished subagent's feature", () => {
    const records: LiveRecord[] = [
      ...inFlight,
      { kind: "subagent-stop", at: "2026-10-18T18:05:00Z", agent_id: "a1" },
    ];
    const s = summarizeLive("s", records);
    expect(s?.features).toEqual(["F-003"]);
    expect(s?.agents.find((a) => a.agent_id === "a1")?.stopped_at).toBe("2026-10-18T18:05:00Z");
  });
});

describe("F-011 the live sidecar", () => {
  const project = () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    return tree.root;
  };
  /** Sets a live log's modification time, which stands for its Claude Code session's last write. */
  const touchLive = (root: string, claude: string, at: string) =>
    utimesSync(liveFile(root, claude), new Date(at), new Date(at));
  const tool = (at: string): LiveRecord => ({
    kind: "tool",
    at,
    tool: "Bash",
    file: null,
    summary: "ls",
    agent_id: null,
  });

  it("S-011.2.1 merges what each writer knows", () => {
    const root = project();
    updateLiveMeta(root, "c1", {
      started_at: "2026-10-20T09:00:00Z",
      transcript_path: "/tmp/t1.jsonl",
    });
    updateLiveMeta(root, "c1", { ses: "SES-20261020-0900" });
    updateLiveMeta(root, "c1", {
      started_at: "2026-10-20T11:00:00Z",
      transcript_path: "/tmp/t2.jsonl",
    });
    expect(readLiveMeta(root, "c1")).toEqual({
      started_at: "2026-10-20T09:00:00Z",
      ses: "SES-20261020-0900",
      transcript_path: "/tmp/t2.jsonl",
    });
    expect(liveMetaFile(root, "c1")).toBe(join(liveDir(root), "c1.meta.json"));
  });

  it("S-011.2.2 reads a missing or unreadable sidecar as null", () => {
    const root = project();
    mkdirSync(liveDir(root), { recursive: true });
    writeFileSync(liveMetaFile(root, "c2"), "{not json");
    expect(readLiveMeta(root, "c1")).toBeNull();
    expect(readLiveMeta(root, "c2")).toBeNull();
  });

  it("S-011.2.3 takes a live session's Azimuth session and start time from the sidecar", () => {
    const root = project();
    for (const minute of [0, 1, 2, 3, 4, 5])
      appendLive(root, "c1", tool(`2026-10-20T11:0${minute}:00Z`));
    touchLive(root, "c1", "2026-10-20T11:05:00Z");
    updateLiveMeta(root, "c1", {
      started_at: "2026-10-20T09:00:00Z",
      ses: "SES-20261020-0900",
      transcript_path: null,
    });
    const live = readLiveSessions(root, new Date("2026-10-20T11:06:00Z")).find(
      (s) => s.claude_session === "c1",
    );
    expect(live?.started_at).toBe("2026-10-20T09:00:00Z");
    expect(live?.ses).toBe("SES-20261020-0900");
  });

  it("S-011.2.4 still answers from the tail without a sidecar", () => {
    const records: LiveRecord[] = [
      { kind: "start", at: "2026-10-20T09:00:00Z", source: "startup" },
      { kind: "session", at: "2026-10-20T09:01:00Z", ses: "SES-20261020-0900" },
      tool("2026-10-20T09:02:00Z"),
    ];
    const live = summarizeLive("c1", records, null);
    expect(live?.started_at).toBe("2026-10-20T09:00:00Z");
    expect(live?.ses).toBe("SES-20261020-0900");
  });

  it("S-011.5.1 maps each sidecar's Azimuth session to its live log's last write", () => {
    const root = project();
    appendLive(root, "c1", tool("2026-10-20T11:30:00Z"));
    touchLive(root, "c1", "2026-10-20T11:30:00Z");
    updateLiveMeta(root, "c1", { ses: "SES-20261020-0900" });
    appendLive(root, "c2", tool("2026-10-20T11:40:00Z"));
    updateLiveMeta(root, "c2", { ses: null });
    updateLiveMeta(root, "c3", { ses: "SES-20261019-0800" });
    expect(sessionsLastSeen(root)).toEqual(
      new Map([["SES-20261020-0900", "2026-10-20T11:30:00Z"]]),
    );
  });
});

describe("F-014 live sessions in the index", () => {
  const project = () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    return tree;
  };
  const T = (hms: string) => `2026-10-20T${hms}Z`;
  const at = (hms: string) => new Date(T(hms));
  const touchLive = (root: string, claude: string, when: Date) =>
    utimesSync(liveFile(root, claude), when, when);
  const sessionFile = (id: string, skill: string, goal: string, goals = "") =>
    [
      "---",
      `id: ${id}`,
      "agent: claude-code",
      `skill: ${skill}`,
      `started_at: ${id.slice(4, 8)}-${id.slice(8, 10)}-${id.slice(10, 12)}T${id.slice(13, 15)}:${id.slice(15, 17)}:00Z`,
      "ended_at: null",
      `goal: ${goal}`,
      "touched: []",
      "commits: []",
      "raised: []",
      "---",
      "## Summary",
      "",
      "## Handoff",
      "",
      ...(goals ? ["## Goals", goals, ""] : []),
    ].join("\n");
  const live = (root: string, claude: string, records: LiveRecord[], last: Date) => {
    for (const r of records) appendLive(root, claude, r);
    touchLive(root, claude, last);
  };
  const find = (sessions: ReturnType<typeof readLiveSessions>, claude: string) =>
    sessions.find((s) => s.claude_session === claude);

  it("S-014.7.1 carries a live session's activity and latest goal", () => {
    const tree = project();
    tree.write(
      ".azimuth/sessions/SES-20261020-1000.md",
      sessionFile("SES-20261020-1000", "spec", "Spec F-014", "- 10:30 · build · Build F-014"),
    );
    live(
      tree.root,
      "c1",
      [
        { kind: "start", at: T("10:00:00") },
        { kind: "session", at: T("10:00:05"), ses: "SES-20261020-1000" },
        { kind: "subagent", at: T("10:31:00"), agent_id: "a1", agent_type: "general-purpose" },
        {
          kind: "tool",
          at: T("10:32:00"),
          tool: "Read",
          file: "a.ts",
          summary: "Read a.ts",
          agent_id: "a1",
        },
      ],
      at("10:32:00"),
    );
    const c1 = find(readLiveSessions(tree.root, at("10:33:00")), "c1");
    expect(c1).toMatchObject({
      goal: "Build F-014",
      skill: "build",
      status: "running",
      main: { status: "running" },
    });
    expect(c1?.agents.find((a) => a.agent_id === "a1")).toMatchObject({
      status: "running",
      started_at: T("10:31:00"),
    });
  });

  it("S-014.7.2 falls back to the session's own goal, or to nothing", () => {
    const tree = project();
    tree.write(
      ".azimuth/sessions/SES-20261020-0900.md",
      sessionFile("SES-20261020-0900", "build", "Build F-011"),
    );
    live(
      tree.root,
      "c2",
      [{ kind: "session", at: T("09:00:05"), ses: "SES-20261020-0900" }],
      at("09:00:05"),
    );
    live(
      tree.root,
      "c3",
      [{ kind: "session", at: T("09:00:05"), ses: "SES-20261019-0800" }],
      at("09:00:05"),
    );
    const sessions = readLiveSessions(tree.root, at("09:10:00"));
    expect(find(sessions, "c2")).toMatchObject({ goal: "Build F-011", skill: "build" });
    expect(find(sessions, "c3")).toMatchObject({ goal: null, skill: null });
  });

  it("S-014.7.3 keeps live logs for three days", () => {
    const tree = project();
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);
    live(tree.root, "old", [{ kind: "start", at: hoursAgo(73).toISOString() }], hoursAgo(73));
    live(tree.root, "recent", [{ kind: "start", at: hoursAgo(48).toISOString() }], hoursAgo(48));
    expect(readLiveSessions(tree.root).map((s) => s.claude_session)).toEqual(["recent"]);
    pruneLive(tree.root);
    expect(existsSync(liveFile(tree.root, "old"))).toBe(false);
    expect(existsSync(liveFile(tree.root, "recent"))).toBe(true);
  });

  /** c1's sidecar names a main transcript; a1 has a subagent file next to it, a2 none. */
  const withTranscripts = () => {
    const tree = project();
    const main = join(tree.root, "projects/-demo/c1.jsonl");
    tree.write("projects/-demo/c1.jsonl", "{}\n");
    tree.write("projects/-demo/c1/subagents/agent-a1.jsonl", "{}\n");
    live(
      tree.root,
      "c1",
      [
        { kind: "start", at: T("10:00:00") },
        { kind: "subagent", at: T("10:01:00"), agent_id: "a1", agent_type: null },
        { kind: "subagent", at: T("10:02:00"), agent_id: "a2", agent_type: null },
      ],
      at("10:02:00"),
    );
    updateLiveMeta(tree.root, "c1", { transcript_path: main });
    return { tree, main };
  };

  it("S-014.7.4 flags transcripts whose file exists", () => {
    const { tree } = withTranscripts();
    const c1 = find(readLiveSessions(tree.root, at("10:03:00")), "c1");
    expect(c1?.main.transcript).toBe(true);
    const flags = Object.fromEntries(c1?.agents.map((a) => [a.agent_id, a.transcript]) ?? []);
    expect(flags).toEqual({ a1: true, a2: false });
  });

  it("S-014.7.5 lets a subagent's recorded transcript path win", () => {
    const { tree, main } = withTranscripts();
    const other = join(tree.root, "other/agent-a2.jsonl");
    appendLive(tree.root, "c1", {
      kind: "subagent-stop",
      at: T("10:04:00"),
      agent_id: "a2",
      transcript_path: other,
    });
    const meta = readLiveMeta(tree.root, "c1");
    const records = readLiveRecords(tree.root, "c1");
    expect(transcriptPathOf(meta, records, "a2")).toBe(other);
    expect(transcriptPathOf(meta, records, "a1")).toBe(
      join(tree.root, "projects/-demo/c1/subagents/agent-a1.jsonl"),
    );
    expect(transcriptPathOf(meta, records, null)).toBe(main);
  });

  it("S-014.7.6 gives a session without a sidecar no transcript", () => {
    const tree = project();
    const records: LiveRecord[] = [
      { kind: "start", at: T("10:00:00") },
      { kind: "subagent", at: T("10:01:00"), agent_id: "a1", agent_type: null },
    ];
    live(tree.root, "c4", records, at("10:01:00"));
    const c4 = find(readLiveSessions(tree.root, at("10:02:00")), "c4");
    expect(c4?.main.transcript).toBe(false);
    expect(c4?.agents[0]?.transcript).toBe(false);
    expect(transcriptPathOf(null, records, "a1")).toBeNull();
  });

  it("S-014.7.7 gives an agent ID that isn't a plain name no path", () => {
    const { tree } = withTranscripts();
    const meta = readLiveMeta(tree.root, "c1");
    expect(transcriptPathOf(meta, readLiveRecords(tree.root, "c1"), "../a1")).toBeNull();
  });
});
