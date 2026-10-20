/**
 * F-016's live sessions: the four F-014-shaped sessions behind the design's Activity timeline
 * (contract.md, Live fixture), built with F-015's builders. They are F-016's own, so its expected
 * values don't move when F-015's fixture does. Times are 2026-10-18 UTC: tests set TZ=UTC and use
 * now = FIXTURE_NOW against the Hookline index.
 */
import type {
  Index,
  LiveActivity,
  LiveAgent,
  LiveEvent,
  LiveSession,
  LiveWait,
} from "../../../src/core/types";
import { indexWithLive, liveAgent, liveEvent, liveSession } from "./agents";

export const FIXTURE_NOW = Date.parse("2026-10-18T12:05:00Z");

const at = (time: string) => `2026-10-18T${time}Z`;

/** A main agent; no transcript is served anywhere in this fixture. */
const mainAgent = (over: Partial<LiveActivity> & { started_at: string }): LiveActivity => ({
  status: "running",
  waiting: null,
  current: null,
  ended_at: null,
  edits: [],
  waits: [],
  transcript: false,
  ...over,
});

/** A subagent still at work, last seen at its current event. */
const runningAgent = (over: Partial<LiveAgent> & { started_at: string; current: LiveEvent }) =>
  liveAgent({ transcript: false, last_seen_at: over.current.at, ...over });

/** A subagent that has finished: stopped, ended and last seen at `ended_at`. */
const doneAgent = (over: Partial<LiveAgent> & { started_at: string; ended_at: string }) =>
  liveAgent({
    status: "done",
    transcript: false,
    stopped_at: over.ended_at,
    last_seen_at: over.ended_at,
    ...over,
  });

// Builders rather than shared constants, so no two places in a session share one object.
const explorerGrep = () =>
  liveEvent({
    at: at("12:02:10"),
    tool: "Grep",
    summary: 'Searched for "decideRetry("',
    agent_id: "a1",
  });
const policyEdit = () =>
  liveEvent({
    at: at("12:04:00"),
    tool: "Edit",
    file: "src/retry/policy.ts",
    summary: "Edited src/retry/policy.ts",
  });
const runnerBash = () =>
  liveEvent({ at: at("12:04:50"), tool: "Bash", summary: "pnpm vitest run", agent_id: "a2" });
const reviewerRead = () =>
  liveEvent({
    at: at("12:04:30"),
    tool: "Read",
    file: "src/api/attempts.ts",
    summary: "Read src/api/attempts.ts",
    agent_id: "a4",
  });
const attemptsEdit = () =>
  liveEvent({
    at: at("12:04:40"),
    tool: "Edit",
    file: "src/api/attempts.ts",
    summary: "Edited src/api/attempts.ts",
  });
const researcherRead = () =>
  liveEvent({
    at: at("11:49:00"),
    tool: "Read",
    file: "src/worker/log.ts",
    summary: "Read src/worker/log.ts",
    agent_id: "a3",
  });
const specBash = () => liveEvent({ at: at("11:59:58"), tool: "Bash", summary: "pnpm vitest run" });
const mapperGrep = () =>
  liveEvent({
    at: at("11:05:00"),
    tool: "Grep",
    summary: 'Searched for "deliver("',
    agent_id: "a5",
  });
const promptWait = (): LiveWait => ({
  reason: "Permission prompt: Bash pnpm vitest run",
  since: at("12:00:00"),
});

/**
 * A fresh copy of c1201, c1202, c1140 and c1100 (most recently active first, as index.live is
 * ordered). Each session's `events` holds its agents' current events, oldest first.
 */
export function timelineLive(): LiveSession[] {
  return [
    liveSession({
      claude_session: "c1201",
      ses: "SES-20261018-1201",
      started_at: at("12:01:00"),
      last_seen_at: at("12:04:50"),
      agents: [
        doneAgent({
          agent_id: "a1",
          agent_type: "explorer",
          description: "find decideRetry() callers",
          started_at: at("12:01:20"),
          ended_at: at("12:02:32"),
          current: explorerGrep(),
        }),
        runningAgent({
          agent_id: "a2",
          agent_type: "test-runner",
          description: "re-run policy.test.ts",
          started_at: at("12:04:25"),
          current: runnerBash(),
        }),
      ],
      current: runnerBash(),
      feature: "F-005",
      task: "T-005.4",
      features: ["F-005"],
      events: [explorerGrep(), policyEdit(), runnerBash()],
      main: mainAgent({ started_at: at("12:01:00"), current: policyEdit() }),
      goal: "Implement retry exhaustion",
      skill: "pm-build",
    }),
    liveSession({
      claude_session: "c1202",
      ses: "SES-20261018-1202",
      started_at: at("12:02:00"),
      last_seen_at: at("12:04:40"),
      agents: [
        runningAgent({
          agent_id: "a4",
          agent_type: "code-reviewer",
          description: "review diff",
          started_at: at("12:04:10"),
          current: reviewerRead(),
        }),
      ],
      current: attemptsEdit(),
      feature: "F-007",
      task: "T-007.4",
      features: ["F-007"],
      events: [reviewerRead(), attemptsEdit()],
      main: mainAgent({ started_at: at("12:02:00"), current: attemptsEdit() }),
      goal: "Fix lint errors, re-verify F-007",
      skill: "pm-build",
    }),
    liveSession({
      claude_session: "c1140",
      ses: "SES-20261018-1140",
      started_at: at("11:40:00"),
      // The permission prompt's wait record.
      last_seen_at: at("12:00:00"),
      agents: [
        doneAgent({
          agent_id: "a3",
          agent_type: "researcher",
          description: "survey log fields",
          started_at: at("11:42:00"),
          ended_at: at("11:50:00"),
          current: researcherRead(),
        }),
      ],
      current: specBash(),
      feature: "F-010",
      task: null,
      features: ["F-010"],
      events: [researcherRead(), specBash()],
      main: mainAgent({
        status: "waiting",
        waiting: promptWait(),
        started_at: at("11:40:00"),
        current: specBash(),
        waits: [{ from: at("12:00:00"), to: null, reason: promptWait().reason }],
      }),
      status: "waiting",
      waiting: promptWait(),
      goal: "Write the F-010 spec",
      skill: "pm-spec",
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
          agent_type: "explorer",
          description: "map retry call sites",
          started_at: at("11:02:00"),
          ended_at: at("11:06:00"),
          current: mapperGrep(),
        }),
      ],
      current: null,
      feature: "F-005",
      task: null,
      features: [],
      events: [mapperGrep()],
      main: mainAgent({
        status: "done",
        started_at: at("11:00:00"),
        ended_at: at("11:58:00"),
        waits: [
          {
            from: at("11:20:00"),
            to: at("11:23:00"),
            reason: "Permission prompt: Bash pnpm build",
          },
        ],
      }),
      status: "done",
      goal: "Build F-005 tasks T-005.2 to T-005.4",
      skill: "pm-build",
    }),
  ];
}

/** indexWithLive(live): the Hookline expected index (a structuredClone) with `live` set. */
export function fixtureIndex(live: LiveSession[] = timelineLive()): Index {
  return indexWithLive(live);
}
