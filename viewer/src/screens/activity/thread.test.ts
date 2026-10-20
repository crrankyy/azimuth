import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index } from "../../../../src/core/types";
import { FIXTURE_NOW, fixtureIndex } from "../../../../test/fixtures/live/timeline";
import type { ActivityKind } from "./feed";
import { activityData } from "./sessions";
import { sessionThreads, type SessionThread, type ThreadEntry } from "./thread";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const ALL_KINDS: ReadonlySet<ActivityKind> = new Set([
  "session",
  "subagent",
  "commit",
  "run",
  "action",
]);

function threadsOf(index: Index, kinds: ReadonlySet<ActivityKind> = ALL_KINDS) {
  return sessionThreads(index, activityData(index, FIXTURE_NOW), { now: FIXTURE_NOW, kinds });
}

function threadOf(threads: Map<string, SessionThread>, id: string): SessionThread {
  const thread = threads.get(id);
  if (!thread) throw new Error(`No thread for ${id}`);
  return thread;
}

const kinds = (thread: SessionThread) => thread.entries.map((e) => e.kind);
const runTexts = (thread: SessionThread) =>
  thread.entries.flatMap((e) => (e.kind === "run" ? [e.text] : []));

/** fixtureIndex() with SES-20261018-0930 listing a commit the index doesn't have. */
function withMissingCommit(): Index {
  const index = fixtureIndex();
  return {
    ...index,
    sessions: index.sessions.map((s) =>
      s.id === "SES-20261018-0930" ? { ...s, commits: ["2f9c7a0", "0000000"] } : s,
    ),
  };
}

describe("F-016 session threads", () => {
  it("S-016.6.1 lists a session's subagents, commits, runs and raised items in time order", () => {
    const thread = threadOf(threadsOf(fixtureIndex()), "SES-20261018-1100");
    expect(thread.status).toBe("done");
    expect(thread.subagents).toBe(1);
    expect(thread.runs).toEqual({ total: 3, failed: 1 });
    expect(thread.pickedUp).toEqual({ id: "SES-20261018-1201", at: "2026-10-18T12:01:00Z" });
    expect(thread.transcript).toBeNull();
    expect(kinds(thread)).toEqual([
      "subagent",
      "commit",
      "run",
      "commit",
      "run",
      "question",
      "commit",
      "run",
      "adr",
    ]);
    expect(thread.entries[0]).toEqual({
      kind: "subagent",
      at: "2026-10-18T11:02:00Z",
      agent: "explorer",
      text: "map retry call sites",
      duration: "4m",
      href: "#/agents/c1100/a5",
    });
    expect(runTexts(thread)).toEqual([
      "R-0140 passed · 1.3 s",
      "R-0141 passed · 1.3 s",
      "R-0142 failed · 2.1 s",
    ]);
    const question = thread.entries.find((e) => e.kind === "question");
    expect(question).toMatchObject({ id: "Q-0002", at: "2026-10-18T11:45:00Z" });
    expect(thread.entries.at(-1)).toEqual({
      kind: "adr",
      at: null,
      id: "ADR-0004",
      title: "30-second lease for in-flight attempts",
    });
  });

  it("S-016.6.2 threads a session without live data from its question and commit", () => {
    const thread = threadOf(threadsOf(fixtureIndex()), "SES-20261018-0930");
    const expected: ThreadEntry[] = [
      {
        kind: "question",
        at: "2026-10-18T10:12:00Z",
        id: "Q-0003",
        title: "Re-sign replayed payloads with the current or the original secret?",
      },
      {
        kind: "commit",
        at: "2026-10-18T10:20:00Z",
        sha: "2f9c7a0",
        subject: "docs(F-008): draft delivery replay spec",
        refs: ["F-008"],
      },
    ];
    expect(thread.entries).toEqual(expected);
    expect(thread.subagents).toBe(0);
    expect(thread.runs).toEqual({ total: 0, failed: 0 });
    expect(thread.pickedUp).toEqual({ id: "SES-20261018-1100", at: "2026-10-18T11:00:00Z" });
  });

  it("S-016.6.3 puts issues and commits missing from the index after the timed entries", () => {
    const threads = threadsOf(withMissingCommit());
    const yesterday = threadOf(threads, "SES-20261017-1430");
    expect(kinds(yesterday)).toEqual(["commit", "commit", "run", "run", "issue"]);
    expect(runTexts(yesterday)).toEqual(["R-0137 passed · 1.7 s", "R-0138 failed · 8.4 s"]);
    expect(yesterday.entries.at(-1)).toEqual({
      kind: "issue",
      at: null,
      id: "DEBT-0001",
      title: "Delivery worker logs unstructured strings",
    });
    expect(threadOf(threads, "SES-20261018-0930").entries.at(-1)).toEqual({
      kind: "commit",
      at: null,
      sha: "0000000",
      subject: "Not in the index",
      refs: [],
    });
  });

  it("S-016.6.4 narrows a thread's entries to the kind chips but keeps its counts", () => {
    const thread = threadOf(
      threadsOf(fixtureIndex(), new Set<ActivityKind>(["session", "action"])),
      "SES-20261018-1100",
    );
    expect(kinds(thread)).toEqual(["question", "adr"]);
    expect(thread.subagents).toBe(1);
    expect(thread.runs).toEqual({ total: 3, failed: 1 });
  });
});
