import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index, Session } from "../../../../src/core/types";
import { FIXTURE_NOW, fixtureIndex } from "../../../../test/fixtures/live/timeline";
import type { ActivityKind } from "./feed";
import {
  actionFitsAfter,
  layoutTimeline,
  timelineWindow,
  type TimelineLayout,
  type TimelineOptions,
  type TimelineRow,
} from "./timeline";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const ALL_KINDS: ActivityKind[] = ["session", "subagent", "commit", "run", "action"];

function layout(
  index: Index = fixtureIndex(),
  over: Partial<TimelineOptions> = {},
): TimelineLayout {
  return layoutTimeline(index, {
    now: FIXTURE_NOW,
    range: "75m",
    kinds: new Set(ALL_KINDS),
    feature: "all",
    ...over,
  });
}

function row(l: TimelineLayout, key: string): TimelineRow {
  const found = l.rows.find((r) => r.key === key);
  if (!found) throw new Error(`No timeline row ${key}`);
  return found;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** A persisted session SES-20261018-1150, started at 11:50 and not ended. */
function withOpenSession(index: Index): Index {
  const session: Session = {
    ...(index.sessions[0] as Session),
    id: "SES-20261018-1150",
    started_at: "2026-10-18T11:50:00Z",
    ended_at: null,
    commits: [],
    raised: [],
    touched: [],
  };
  return { ...index, sessions: [...index.sessions, session] };
}

function withAdrDecidedAt(decidedAt: string): Index {
  const index = fixtureIndex();
  const adr = index.decisions.find((d) => d.id === "ADR-0004");
  if (!adr) throw new Error("No ADR-0004");
  adr.decided_at = decidedAt;
  return index;
}

describe("F-016 timeline window", () => {
  it("S-016.2.1 ends Last 75 min at the next quarter hour", () => {
    const w = timelineWindow("75m", FIXTURE_NOW);
    expect(iso(w.start)).toBe("2026-10-18T11:00:00.000Z");
    expect(iso(w.end)).toBe("2026-10-18T12:15:00.000Z");
    expect(w.ticks).toEqual([
      { left: 0, label: "11:00" },
      { left: 20, label: "11:15" },
      { left: 40, label: "11:30" },
      { left: 60, label: "11:45" },
      { left: 80, label: "12:00" },
    ]);
    expect(w.label).toBe("Today, 11:00 – 12:15");
    expect(layout().now).toBe(86.67);

    const noon = Date.parse("2026-10-18T12:00:00Z");
    expect(timelineWindow("75m", noon)).toEqual(w);
    expect(layout(fixtureIndex(), { now: noon }).now).toBe(80);
  });

  it("S-016.2.2 follows local midnights for Today and 3 days", () => {
    const saved = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const now = Date.parse("2026-10-18T19:05:00Z"); // 12:05 local
      const today = timelineWindow("today", now);
      expect(iso(today.start)).toBe("2026-10-18T07:00:00.000Z");
      expect(iso(today.end)).toBe("2026-10-19T07:00:00.000Z");
      expect(today.ticks.map((t) => t.label)).toEqual([
        "00:00",
        "03:00",
        "06:00",
        "09:00",
        "12:00",
        "15:00",
        "18:00",
        "21:00",
      ]);
      expect(today.ticks.map((t) => t.left)).toEqual([0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5]);
      expect(today.label).toBe("Today · Sunday, Oct 18");

      const days = timelineWindow("3d", now);
      expect(iso(days.start)).toBe("2026-10-16T07:00:00.000Z");
      expect(iso(days.end)).toBe("2026-10-19T07:00:00.000Z");
      expect(days.ticks).toEqual([
        { left: 0, label: "Fri Oct 16" },
        { left: 33.33, label: "Sat Oct 17" },
        { left: 66.67, label: "Sun Oct 18" },
      ]);
      expect(days.label).toBe("Oct 16 – Oct 18");
    } finally {
      process.env.TZ = saved;
    }
  });
});

describe("BUG-0078 room for running rows' actions", () => {
  const at = (time: string) => Date.parse(`2026-10-18T${time}Z`);

  it("BUG-0078 ends Last 75 min at the first quarter hour at least 10 minutes after now", () => {
    const cases: [string, string][] = [
      ["12:05:00", "12:15"],
      ["12:14:00", "12:30"],
      ["12:20:00", "12:30"],
      ["12:21:00", "12:45"],
      ["12:50:00", "13:00"],
      ["12:52:00", "13:15"],
      // Ten minutes and a half after 12:05:30 is past 12:15.
      ["12:05:30", "12:30"],
    ];
    for (const [now, end] of cases) {
      const w = timelineWindow("75m", at(now));
      expect(iso(w.end), now).toBe(`2026-10-18T${end}:00.000Z`);
      expect(w.end - w.start, now).toBe(75 * 60_000);
    }
  });

  it("BUG-0078 keeps quarter-hour ticks and puts the now line before the last 10 minutes", () => {
    const w = timelineWindow("75m", at("12:14:00"));
    expect(iso(w.start)).toBe("2026-10-18T11:15:00.000Z");
    expect(w.ticks).toEqual([
      { left: 0, label: "11:15" },
      { left: 20, label: "11:30" },
      { left: 40, label: "11:45" },
      { left: 60, label: "12:00" },
      { left: 80, label: "12:15" },
    ]);
    expect(w.label).toBe("Today, 11:15 – 12:30");
    expect(layout(fixtureIndex(), { now: at("12:14:00") }).now).toBe(78.67);
  });

  it("BUG-0078 leaves Today and 3 days as they were", () => {
    const now = at("12:52:00");
    const today = timelineWindow("today", now);
    expect(iso(today.start)).toBe("2026-10-18T00:00:00.000Z");
    expect(iso(today.end)).toBe("2026-10-19T00:00:00.000Z");
    expect(today.ticks.map((t) => t.label)).toEqual([
      "00:00",
      "03:00",
      "06:00",
      "09:00",
      "12:00",
      "15:00",
      "18:00",
      "21:00",
    ]);
    const days = timelineWindow("3d", now);
    expect(iso(days.start)).toBe("2026-10-16T00:00:00.000Z");
    expect(iso(days.end)).toBe("2026-10-19T00:00:00.000Z");
    expect(days.ticks.map((t) => t.label)).toEqual(["Fri Oct 16", "Sat Oct 17", "Sun Oct 18"]);
  });

  it("BUG-0078 fits an action after its span when the track leaves room for it", () => {
    // 1000 px track, span ending at 80%: 200 px to the edge, 192 px after the 8 px gap.
    expect(actionFitsAfter(1000, 80, "Edit policy.ts")).toBe(true);
    expect(actionFitsAfter(1000, 80, "Read attempts.ts")).toBe(true);
  });

  it("BUG-0078 doesn't fit an action the room after its span would cut", () => {
    // 50 px to the edge, 42 px after the gap: too narrow for 14 characters at 11 px.
    expect(actionFitsAfter(1000, 95, "Edit policy.ts")).toBe(false);
    // The same room takes a short label but not a long one.
    expect(actionFitsAfter(600, 80, "Edit a.ts")).toBe(true);
    expect(actionFitsAfter(600, 80, "Edit src/retry/policy.ts and more")).toBe(false);
  });

  it("BUG-0078 puts an action after its span while the track's width is unknown", () => {
    expect(actionFitsAfter(null, 80, "Edit policy.ts")).toBe(true);
    expect(actionFitsAfter(null, 99, "Edit src/retry/policy.ts and more")).toBe(true);
  });
});

describe("F-016 timeline rows, spans and markers", () => {
  it("S-016.2.3 has a row per session in the window, with its subagents beneath", () => {
    const l = layout();
    expect(l.rows.map((r) => r.key)).toEqual([
      "SES-20261018-1100",
      "SES-20261018-1100/a5",
      "SES-20261018-1140",
      "SES-20261018-1140/a3",
      "SES-20261018-1201",
      "SES-20261018-1201/a1",
      "SES-20261018-1201/a2",
      "SES-20261018-1202",
      "SES-20261018-1202/a4",
    ]);
    expect(l.rows.map((r) => r.depth)).toEqual([0, 1, 0, 1, 0, 1, 1, 0, 1]);
    expect(l.rows.map((r) => r.statusLabel)).toEqual([
      "done",
      "done",
      "waiting on you",
      "done",
      "running",
      "done",
      "running",
      "running",
      "running",
    ]);
    expect(row(l, "SES-20261018-1140")).toMatchObject({
      name: "…1140",
      id: "SES-20261018-1140",
      skill: "pm-spec",
      feature: "F-010",
      detail: null,
    });
    expect(row(l, "SES-20261018-1140/a3")).toMatchObject({
      name: "researcher",
      id: "a3",
      detail: "survey log fields",
      skill: null,
    });
  });

  it("S-016.2.4 colours spans by status and stripes the waits on you", () => {
    const l = layout();
    expect(row(l, "SES-20261018-1100").spans).toEqual([
      { kind: "done", left: 0, width: 77.33, title: "Finished · 11:00–11:58" },
      {
        kind: "waiting",
        left: 26.67,
        width: 4,
        title: "Waiting on you · 11:20–11:23 · Permission prompt: Bash pnpm build",
      },
    ]);
    expect(row(l, "SES-20261018-1140").spans).toEqual([
      { kind: "running", left: 53.33, width: 33.33, title: "Running · 11:40–now" },
      {
        kind: "waiting",
        left: 80,
        width: 6.67,
        title: "Waiting on you · 12:00–now · Permission prompt: Bash pnpm vitest run",
      },
    ]);
    expect(row(l, "SES-20261018-1100/a5").spans).toEqual([
      { kind: "done", left: 2.67, width: 5.33, title: "Finished · 11:02–11:06" },
    ]);
    expect(row(l, "SES-20261018-1201/a2").spans).toEqual([
      { kind: "running", left: 85.89, width: 0.78, title: "Running · 12:04–now" },
    ]);
  });

  it("S-016.2.5 puts markers at their time on their session's row", () => {
    const l = layout();
    expect(
      row(l, "SES-20261018-1100").markers.map(({ kind, id, left, title }) => ({
        kind,
        id,
        left,
        title,
      })),
    ).toEqual([
      {
        kind: "commit",
        id: "a41f2b9",
        left: 16,
        title: "Commit a41f2b9 · feat(F-005): exponential backoff with full jitter",
      },
      { kind: "run-pass", id: "R-0140", left: 17.33, title: "R-0140 passed · T-005.2" },
      {
        kind: "commit",
        id: "6c0e3d8",
        left: 41.33,
        title: "Commit 6c0e3d8 · feat(F-005): classify responses as retryable or permanent",
      },
      { kind: "run-pass", id: "R-0141", left: 42.67, title: "R-0141 passed · T-005.3" },
      {
        kind: "question",
        id: "Q-0002",
        left: 60,
        title: "Q-0002 raised · Should 429 responses count toward maxAttempts?",
      },
      {
        kind: "commit",
        id: "9f3c2e1",
        left: 73.33,
        title: "Commit 9f3c2e1 · test(F-005): add red tests for retry exhaustion",
      },
      { kind: "run-fail", id: "R-0142", left: 74.67, title: "R-0142 failed · T-005.4" },
    ]);
    const others = l.rows.filter((r) => r.key !== "SES-20261018-1100");
    expect(others.flatMap((r) => r.markers)).toEqual([]);
  });

  it("S-016.2.6 draws a persisted session without live data as a plain span", () => {
    const l = layout(withOpenSession(fixtureIndex([])));
    expect(row(l, "SES-20261018-1150")).toMatchObject({
      status: "open",
      statusLabel: "open",
      href: "#/activity/SES-20261018-1150",
      spans: [{ kind: "open", left: 66.67, width: 20, title: "Open · 11:50–now · no live data" }],
    });
    expect(l.rows.filter((r) => r.depth === 1)).toEqual([]);
    expect(row(l, "SES-20261018-1100").spans).toEqual([
      { kind: "done", left: 0, width: 77.33, title: "Finished · 11:00–11:58" },
    ]);
  });

  it("S-016.2.7 lists today's sessions before the window as earlier today", () => {
    const recent = layout();
    expect(recent.earlier).toEqual([
      { id: "SES-20261018-0930", label: "09:30–10:25", href: "#/activity/SES-20261018-0930" },
    ]);
    expect(
      recent.rows.filter(
        (r) => r.key.startsWith("SES-20261018-0930") || r.key.startsWith("SES-20261017"),
      ),
    ).toEqual([]);

    const today = layout(fixtureIndex(), { range: "today" });
    expect(today.earlier).toEqual([]);
    expect(row(today, "SES-20261018-0930").spans).toEqual([
      { kind: "done", left: 39.58, width: 3.82, title: "Finished · 09:30–10:25" },
    ]);
  });

  it("S-016.2.8 names running rows' current action and links rows to their pages", () => {
    const l = layout();
    // The row shows the file's name, as the design does; its title keeps the whole path.
    expect(row(l, "SES-20261018-1201").action).toBe("Edit policy.ts");
    expect(row(l, "SES-20261018-1201").actionTitle).toBe("Edit src/retry/policy.ts");
    expect(row(l, "SES-20261018-1201/a2").action).toBe("pnpm vitest run");
    expect(row(l, "SES-20261018-1201/a2").actionTitle).toBe("pnpm vitest run");
    expect(row(l, "SES-20261018-1202/a4").action).toBe("Read attempts.ts");
    expect(row(l, "SES-20261018-1202/a4").actionTitle).toBe("Read src/api/attempts.ts");
    expect(row(l, "SES-20261018-1140").action).toBeNull();
    expect(row(l, "SES-20261018-1140").actionTitle).toBeNull();
    expect(row(l, "SES-20261018-1100").action).toBeNull();

    expect(row(l, "SES-20261018-1100").href).toBe("#/activity/SES-20261018-1100");
    expect(row(l, "SES-20261018-1201").href).toBe("#/agents/c1201");
    expect(row(l, "SES-20261018-1201/a2").href).toBe("#/agents/c1201/a2");
  });

  it("S-016.2.9 marks an ADR only when its time is known", () => {
    const timed = row(layout(withAdrDecidedAt("2026-10-18T11:30:00Z")), "SES-20261018-1100");
    expect(timed.markers).toContainEqual({
      kind: "adr",
      id: "ADR-0004",
      at: "2026-10-18T11:30:00Z",
      left: 40,
      title: "ADR-0004 proposed · 30-second lease for in-flight attempts",
    });
    const untimed = row(layout(), "SES-20261018-1100");
    expect(untimed.markers.filter((m) => m.kind === "adr")).toEqual([]);
  });
});

describe("F-016 timeline filters", () => {
  it("S-016.3.1 hides subagent rows and commit and run markers with their chips off", () => {
    const l = layout(fixtureIndex(), { kinds: new Set<ActivityKind>(["session", "action"]) });
    expect(l.rows.map((r) => r.key)).toEqual([
      "SES-20261018-1100",
      "SES-20261018-1140",
      "SES-20261018-1201",
      "SES-20261018-1202",
    ]);
    expect(row(l, "SES-20261018-1100").markers.map((m) => m.kind)).toEqual(["question"]);
  });

  it("S-016.3.2 keeps the sessions of a feature with all their subagents", () => {
    const l = layout(fixtureIndex(), { feature: "F-007" });
    expect(l.rows.map((r) => r.key)).toEqual(["SES-20261018-1202", "SES-20261018-1202/a4"]);
    expect(l.earlier).toEqual([]);
  });

  it("S-016.3.3 is empty without sessions or for Untracked", () => {
    const noSessions = layout(fixtureIndex(), {
      kinds: new Set(ALL_KINDS.filter((k) => k !== "session")),
    });
    expect(noSessions.rows).toEqual([]);
    expect(noSessions.earlier).toEqual([]);
    const untracked = layout(fixtureIndex(), { feature: "untracked" });
    expect(untracked.rows).toEqual([]);
    expect(untracked.earlier).toEqual([]);
  });
});
