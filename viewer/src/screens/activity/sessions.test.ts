import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Commit, Index, LiveSession, Session, VerifyRun } from "../../../../src/core/types";
import { liveSession } from "../../../../test/fixtures/live/agents";
import { FIXTURE_NOW, fixtureIndex } from "../../../../test/fixtures/live/timeline";
import {
  activitySessions,
  attribute,
  pickedUpBy,
  shortSessionId,
  type ActivitySession,
} from "./sessions";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const at = (time: string) => `2026-10-18T${time}Z`;

function find(sessions: ActivitySession[], key: string): ActivitySession {
  const found = sessions.find((s) => s.key === key);
  if (!found) throw new Error(`No activity session ${key}`);
  return found;
}

/** A persisted session SES-20261018-1150, started at 11:50 and not ended. */
function withOpenSession(index: Index): Index {
  const session: Session = {
    ...(index.sessions[0] as Session),
    id: "SES-20261018-1150",
    started_at: at("11:50:00"),
    ended_at: null,
    commits: [],
    raised: [],
    touched: [],
  };
  return { ...index, sessions: [...index.sessions, session] };
}

const commit = (over: Partial<Commit> & Pick<Commit, "sha" | "at" | "actor">): Commit => ({
  session: null,
  subject: "chore: something",
  refs: [],
  files_changed: 1,
  ...over,
});

const ids = <T>(items: T[] | undefined, id: (item: T) => string) => (items ?? []).map(id);

describe("F-016 activity sessions", () => {
  it("S-016.1.1 joins persisted and live sessions by SES, oldest first", () => {
    const sessions = activitySessions(fixtureIndex());
    expect(sessions.map((s) => s.key)).toEqual([
      "SES-20261007-1010",
      "SES-20261016-1320",
      "SES-20261017-0915",
      "SES-20261017-1430",
      "SES-20261018-0930",
      "SES-20261018-1100",
      "SES-20261018-1140",
      "SES-20261018-1201",
      "SES-20261018-1202",
    ]);
    const s1100 = find(sessions, "SES-20261018-1100");
    expect(s1100.live?.claude_session).toBe("c1100");
    expect(s1100.session?.id).toBe("SES-20261018-1100");
    expect(s1100).toMatchObject({ status: "done", end: "2026-10-18T11:58:00Z" });
    const s1201 = find(sessions, "SES-20261018-1201");
    expect(s1201.live?.claude_session).toBe("c1201");
    expect(s1201).toMatchObject({
      ses: "SES-20261018-1201",
      session: null,
      status: "running",
      start: "2026-10-18T12:01:00Z",
      end: null,
      features: ["F-005"],
      skill: "pm-build",
      goal: "Implement retry exhaustion",
    });
  });

  it("S-016.1.2 takes an open session's status and end from its live data", () => {
    const alone = find(activitySessions(withOpenSession(fixtureIndex([]))), "SES-20261018-1150");
    expect(alone).toMatchObject({ status: "open", end: null, live: null });

    const base = liveSession({ claude_session: "c1150", started_at: at("11:50:00") });
    const c1150: LiveSession = {
      ...base,
      ses: "SES-20261018-1150",
      last_seen_at: at("11:57:00"),
      status: "done",
      main: { ...base.main, status: "done", ended_at: at("11:57:00") },
    };
    const joined = find(
      activitySessions(withOpenSession(fixtureIndex([c1150]))),
      "SES-20261018-1150",
    );
    expect(joined).toMatchObject({ status: "done", end: "2026-10-18T11:57:00Z" });
    expect(joined.live?.claude_session).toBe("c1150");
  });

  it("S-016.1.3 keys a live session without a SES by its Claude Code ID", () => {
    const sessions = activitySessions(
      fixtureIndex([
        liveSession({ claude_session: "c9abcdef12", ses: null }),
        liveSession({ claude_session: "c1100b", ses: "SES-20261018-1100-2" }),
      ]),
    );
    const bare = find(sessions, "c9abcdef12");
    expect(bare).toMatchObject({ key: "c9abcdef12", ses: null, session: null });
    expect(shortSessionId(bare)).toBe("c9abcdef");
    expect(shortSessionId(find(sessions, "SES-20261018-1100"))).toBe("…1100");
    const second = find(sessions, "SES-20261018-1100-2");
    expect(second.session).toBeNull();
    expect(shortSessionId(second)).toBe("…1100-2");
  });

  it("S-016.1.4 gives commits, runs and questions to their session", () => {
    const index = fixtureIndex();
    const { commits, runs, questions, owner } = attribute(
      index,
      activitySessions(index),
      FIXTURE_NOW,
    );
    expect(ids(commits.get("SES-20261018-1100"), (c) => c.sha)).toEqual([
      "a41f2b9",
      "6c0e3d8",
      "9f3c2e1",
    ]);
    // R-0140 to R-0142 have no `ses`: they go to the session that owns their commit.
    expect(ids(runs.get("SES-20261018-1100"), (r) => r.id)).toEqual(["R-0140", "R-0141", "R-0142"]);
    expect(ids(questions.get("SES-20261018-1100"), (q) => q.id)).toEqual(["Q-0002"]);
    expect(ids(runs.get("SES-20261017-1430"), (r) => r.id)).toEqual(["R-0137", "R-0138"]);
    expect(owner.get("a41f2b9")).toBe("SES-20261018-1100");
    expect(owner.get("R-0142")).toBe("SES-20261018-1100");
    expect(owner.has("R-0139")).toBe(false);
    expect(owner.has("c2d4e18")).toBe(false);
    expect(owner.has("d5a8f31")).toBe(false);
  });

  it("S-016.1.5 leaves ambiguous and sessionless commits and runs without an owner", () => {
    const base = fixtureIndex();
    const run: VerifyRun = {
      ...(base.runs[0] as VerifyRun),
      id: "R-0150",
      at: at("11:20:00"),
      // Its commit is SES-20261018-1100's, but `ses: null` says it ran outside any session.
      commit: "9f3c2e1",
      ses: null,
    };
    const index: Index = {
      ...base,
      commits: [
        ...base.commits,
        commit({ sha: "abc1234", at: at("12:03:00"), actor: "agent" }),
        commit({ sha: "def5678", at: at("11:20:00"), actor: "you" }),
        commit({ sha: "aaa1111", at: at("11:20:00"), actor: "agent" }),
      ],
      runs: [...base.runs, run],
    };
    const { owner } = attribute(index, activitySessions(index), FIXTURE_NOW);
    expect(owner.has("abc1234")).toBe(false);
    expect(owner.has("def5678")).toBe(false);
    expect(owner.has("R-0150")).toBe(false);
    expect(owner.get("aaa1111")).toBe("SES-20261018-1100");
  });

  it("S-016.1.6 places a raised ADR at its decision only within its session", () => {
    const adrAt = (decidedAt: string | null) => {
      const index = fixtureIndex();
      const adr = index.decisions.find((d) => d.id === "ADR-0004");
      if (!adr) throw new Error("No ADR-0004");
      adr.decided_at = decidedAt;
      const attribution = attribute(index, activitySessions(index), FIXTURE_NOW);
      return {
        decisions: (attribution.decisions.get("SES-20261018-1100") ?? []).map((d) => ({
          id: d.decision.id,
          at: d.at,
        })),
        issues: ids(attribution.issues.get("SES-20261017-1430"), (i) => i.id),
      };
    };
    expect(adrAt(null)).toEqual({
      decisions: [{ id: "ADR-0004", at: null }],
      issues: ["DEBT-0001"],
    });
    expect(adrAt("2026-10-18T11:30:00Z")).toEqual({
      decisions: [{ id: "ADR-0004", at: "2026-10-18T11:30:00Z" }],
      issues: ["DEBT-0001"],
    });
    expect(adrAt("2026-10-18T13:00:00Z")).toEqual({
      decisions: [{ id: "ADR-0004", at: null }],
      issues: ["DEBT-0001"],
    });
  });

  it("S-016.1.7 names the session that picked up a handoff", () => {
    const sessions = activitySessions(fixtureIndex());
    expect(pickedUpBy(sessions, find(sessions, "SES-20261018-1100"))).toEqual({
      id: "SES-20261018-1201",
      at: "2026-10-18T12:01:00Z",
    });
    expect(pickedUpBy(sessions, find(sessions, "SES-20261018-0930"))).toEqual({
      id: "SES-20261018-1100",
      at: "2026-10-18T11:00:00Z",
    });
  });

  it("S-016.1.8 has no pick-up for an open session or the latest one", () => {
    const live = activitySessions(fixtureIndex());
    expect(pickedUpBy(live, find(live, "SES-20261018-1201"))).toBeNull();
    const exported = activitySessions(fixtureIndex([]));
    expect(pickedUpBy(exported, find(exported, "SES-20261018-1100"))).toBeNull();
  });
});
