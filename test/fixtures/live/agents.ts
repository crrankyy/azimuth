/**
 * Live sessions for the viewer's agent screens (F-015), shaped by F-014's types, and two
 * transcript pages of c1201's main agent. Times are 2026-10-18 UTC: tests set TZ=UTC and render
 * with now = AGENTS_NOW against the Hookline index (contract.md, Test fixture).
 */
import type {
  Index,
  LiveActivity,
  LiveAgent,
  LiveEdit,
  LiveEvent,
  LiveSession,
  LiveWait,
  TranscriptPage,
  TranscriptText,
} from "../../../src/core/types";
import { expectedIndex } from "../hookline/expected-index";

export const AGENTS_NOW = Date.parse("2026-10-18T12:05:00Z");

const at = (time: string) => `2026-10-18T${time}Z`;

export function liveEvent(over: Partial<LiveEvent>): LiveEvent {
  return {
    at: at("12:00:00"),
    tool: "Read",
    file: null,
    summary: "",
    agent_id: null,
    added: null,
    removed: null,
    error: null,
    ...over,
  };
}

function liveActivity(over: Partial<LiveActivity>): LiveActivity {
  return {
    status: "running",
    waiting: null,
    current: null,
    started_at: at("12:00:00"),
    ended_at: null,
    edits: [],
    waits: [],
    transcript: true,
    ...over,
  };
}

export function liveAgent(over: Partial<LiveAgent>): LiveAgent {
  return {
    ...liveActivity({}),
    agent_id: "a1",
    agent_type: null,
    last_seen_at: at("12:00:00"),
    description: null,
    task: null,
    feature: null,
    stopped_at: null,
    ...over,
  };
}

export function liveSession(over: Partial<LiveSession>): LiveSession {
  const startedAt = over.started_at ?? at("12:00:00");
  return {
    claude_session: "c1",
    ses: null,
    started_at: startedAt,
    last_seen_at: startedAt,
    stopped_at: null,
    ended_at: null,
    agents: [],
    current: null,
    feature: null,
    task: null,
    features: [],
    events: [],
    // F-014: the main agent starts with the session.
    main: liveActivity({ started_at: startedAt }),
    status: "running",
    waiting: null,
    goal: null,
    skill: null,
    ...over,
  };
}

// Builders rather than shared constants, so no two places in a session share one object: a test
// that changes a session's `waiting` doesn't also change its main agent's.
const policyEdit = () =>
  liveEvent({
    at: at("12:04:12"),
    tool: "Edit",
    file: "src/retry/policy.ts",
    summary: "Edited src/retry/policy.ts",
    added: 4,
    removed: 1,
  });
const runnerBash = () =>
  liveEvent({
    at: at("12:04:50"),
    tool: "Bash",
    summary: "pnpm vitest run src/retry/policy.test.ts",
    agent_id: "a1",
  });
const explorerGrep = () =>
  liveEvent({
    at: at("12:01:40"),
    tool: "Grep",
    summary: 'Searched for "decideRetry("',
    agent_id: "a2",
  });
const attemptsEdit = () =>
  liveEvent({
    at: at("12:04:39"),
    tool: "Edit",
    file: "src/api/attempts.ts",
    summary: "Edited src/api/attempts.ts",
  });
const reviewerRead = () =>
  liveEvent({
    at: at("12:04:30"),
    tool: "Read",
    file: "src/api/attempts.ts",
    summary: "Read src/api/attempts.ts",
    agent_id: "a3",
  });
const metricsRead = () =>
  liveEvent({
    at: at("11:59:30"),
    tool: "Read",
    file: "docs/metrics.md",
    summary: "Read docs/metrics.md",
  });
const promptWait = (): LiveWait => ({
  reason: "Permission prompt: WebFetch prometheus.io",
  since: at("12:00:00"),
});
const edit = (file: string, time: string, added: number | null, removed: number | null) =>
  ({ file, at: at(time), added, removed }) satisfies LiveEdit;

/** A subagent that has finished: stopped, ended and last seen at `end`. */
const doneAgent = (over: Partial<LiveAgent> & { started_at: string; ended_at: string }) =>
  liveAgent({ status: "done", stopped_at: over.ended_at, last_seen_at: over.ended_at, ...over });

/** A done session's main agent and status. */
const done = (startedAt: string, end: string): Pick<LiveSession, "status" | "main"> => ({
  status: "done",
  main: liveActivity({ status: "done", started_at: startedAt, ended_at: end }),
});

/** A fresh copy of the six sessions below, in this order. */
export function agentsLive(): LiveSession[] {
  return [
    liveSession({
      claude_session: "c1201",
      ses: "SES-20261018-1201",
      started_at: at("12:01:04"),
      last_seen_at: at("12:04:50"),
      agents: [
        liveAgent({
          agent_id: "a1",
          agent_type: "test-runner",
          description: "Re-run policy.test.ts after each edit",
          started_at: at("12:04:20"),
          last_seen_at: at("12:04:50"),
          current: runnerBash(),
        }),
        doneAgent({
          agent_id: "a2",
          agent_type: "explorer",
          description: "Find every caller of decideRetry()",
          started_at: at("12:01:20"),
          ended_at: at("12:02:32"),
          current: explorerGrep(),
        }),
      ],
      current: runnerBash(),
      feature: "F-005",
      task: "T-005.4",
      features: ["F-005"],
      events: [explorerGrep(), policyEdit(), runnerBash()],
      main: liveActivity({
        started_at: at("12:01:04"),
        current: policyEdit(),
        edits: [edit("src/retry/policy.ts", "12:04:12", 4, 1)],
      }),
      goal: "Turn S-005.2.1 green: implement retry exhaustion",
      skill: "build",
    }),
    liveSession({
      claude_session: "c1202",
      ses: "SES-20261018-1202",
      started_at: at("12:02:00"),
      last_seen_at: at("12:04:39"),
      agents: [
        liveAgent({
          agent_id: "a3",
          agent_type: "code-reviewer",
          description: "Check the attempts.ts diff for other unawaited promises",
          started_at: at("12:04:08"),
          last_seen_at: at("12:04:30"),
          current: reviewerRead(),
        }),
      ],
      current: attemptsEdit(),
      feature: "F-007",
      task: "T-007.4",
      features: ["F-007"],
      events: [reviewerRead(), attemptsEdit()],
      main: liveActivity({
        started_at: at("12:02:00"),
        current: attemptsEdit(),
        edits: [edit("src/api/attempts.ts", "12:04:39", null, null)],
      }),
      goal: "Fix the two lint errors, then re-verify F-007",
      skill: "build",
    }),
    liveSession({
      claude_session: "c1140",
      ses: "SES-20261018-1140",
      started_at: at("11:40:00"),
      last_seen_at: at("12:00:00"),
      agents: [
        doneAgent({
          agent_id: "a4",
          agent_type: "researcher",
          description: "Survey current log fields and counters in src/",
          started_at: at("11:42:00"),
          ended_at: at("11:50:00"),
        }),
      ],
      current: metricsRead(),
      feature: "F-010",
      task: null,
      features: ["F-010"],
      events: [metricsRead()],
      main: liveActivity({
        status: "waiting",
        waiting: promptWait(),
        started_at: at("11:40:00"),
        current: metricsRead(),
        waits: [{ from: at("12:00:00"), to: null, reason: promptWait().reason }],
      }),
      status: "waiting",
      waiting: promptWait(),
      goal: "Write the F-010 spec",
      skill: "spec",
    }),
    liveSession({
      claude_session: "c1100",
      ses: "SES-20261018-1100",
      started_at: at("11:00:00"),
      last_seen_at: at("11:58:00"),
      ended_at: at("11:58:00"),
      agents: [
        doneAgent({
          agent_id: "a5",
          agent_type: "test-runner",
          started_at: at("11:10:00"),
          ended_at: at("11:30:00"),
        }),
        doneAgent({
          agent_id: "a6",
          agent_type: "explorer",
          started_at: at("11:20:00"),
          ended_at: at("11:45:00"),
        }),
      ],
      feature: "F-005",
      task: "T-005.4",
      features: [],
      ...done(at("11:00:00"), at("11:58:00")),
      goal: "Build F-005 tasks T-005.2 to T-005.4",
      skill: "build",
    }),
    // Ended without an `end` record: done once quiet, with only the main agent's end.
    liveSession({
      claude_session: "c0930",
      ses: "SES-20261018-0930",
      started_at: at("09:30:00"),
      last_seen_at: at("10:25:00"),
      feature: "F-008",
      task: null,
      features: [],
      ...done(at("09:30:00"), at("10:25:00")),
      goal: "Write the F-008 spec",
      skill: "spec",
    }),
    liveSession({
      claude_session: "c1430",
      ses: "SES-20261017-1430",
      started_at: "2026-10-17T14:30:00Z",
      last_seen_at: "2026-10-17T16:45:00Z",
      ended_at: "2026-10-17T16:45:00Z",
      feature: "F-007",
      task: null,
      features: [],
      ...done("2026-10-17T14:30:00Z", "2026-10-17T16:45:00Z"),
      goal: "Build F-007",
      skill: "build",
    }),
  ];
}

/** expectedIndex with `live` replaced (structuredClone), plus overrides. */
export function indexWithLive(live: LiveSession[], over: Partial<Index> = {}): Index {
  const base: Index = expectedIndex;
  return structuredClone({ ...base, live, ...over });
}

const text = (...lines: string[]): TranscriptText => ({ lines, truncated: false });

export const transcriptPage1: TranscriptPage = {
  ok: true,
  claude_session: "c1201",
  agent: null,
  entries: [
    { kind: "message", role: "user", text: "Build T-005.4", at: at("12:01:04") },
    {
      kind: "message",
      role: "assistant",
      text: "Picking up T-005.4 from the handoff.",
      at: at("12:01:09"),
    },
    {
      kind: "tool",
      tool_use_id: "toolu_read",
      name: "Read",
      target: "src/retry/policy.test.ts",
      summary: null,
      status: "ok",
      diff: null,
      output: null,
      at: at("12:01:12"),
    },
    {
      kind: "spawn",
      tool_use_id: "toolu_explore",
      description: "Find every caller of decideRetry()",
      agent_type: "explorer",
      agent_id: "a2",
      status: "ok",
      output: text("Found 1 caller: src/worker/deliver.ts"),
      at: at("12:01:20"),
    },
    {
      kind: "tool",
      tool_use_id: "toolu_edit",
      name: "Edit",
      target: "src/retry/policy.ts",
      summary: null,
      status: "ok",
      diff: {
        ...text(
          "@@ -12,2 +12,5 @@",
          "-  if (attempt > policy.maxAttempts) return exhausted;",
          "+  if (attempt >= policy.maxAttempts) {",
          "+    return exhausted;",
          "+  }",
          "+  // retryable",
        ),
        added: 4,
        removed: 1,
      },
      output: null,
      at: at("12:04:12"),
    },
    {
      kind: "tool",
      tool_use_id: "toolu_test",
      name: "Bash",
      target: "pnpm vitest run src/retry/policy.test.ts",
      summary: "Run the policy tests",
      status: "ok",
      diff: null,
      output: text("✓ S-005.2.1 marks delivery exhausted"),
      at: at("12:04:14"),
    },
    {
      kind: "tool",
      tool_use_id: "toolu_lint",
      name: "Bash",
      target: "pnpm lint",
      summary: null,
      status: "error",
      diff: null,
      output: text("src/retry/policy.ts:14 error no-unused-vars"),
      at: at("12:04:16"),
    },
    {
      kind: "tool",
      tool_use_id: "toolu_build",
      name: "Bash",
      target: "pnpm build",
      summary: null,
      status: "running",
      diff: null,
      output: null,
      at: at("12:04:18"),
    },
    {
      kind: "spawn",
      tool_use_id: "toolu_runner",
      description: "Re-run policy.test.ts after each edit",
      agent_type: "test-runner",
      agent_id: "a1",
      status: "running",
      output: null,
      at: at("12:04:20"),
    },
  ],
  next: 48213,
  skipped: false,
};

export const transcriptPage2: TranscriptPage = {
  ok: true,
  claude_session: "c1201",
  agent: null,
  entries: [
    {
      kind: "result",
      tool_use_id: "toolu_runner",
      status: "ok",
      diff: null,
      output: text("3 passed"),
      agent_id: "a1",
      at: at("12:05:10"),
    },
    { kind: "message", role: "assistant", text: "All three scenarios pass.", at: at("12:05:12") },
  ],
  next: 50112,
  skipped: false,
};
