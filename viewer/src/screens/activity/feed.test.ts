import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index, Session } from "../../../../src/core/types";
import { FIXTURE_NOW, fixtureIndex } from "../../../../test/fixtures/live/timeline";
import { buildFeed, byPeriod, type FeedItem } from "./feed";
import { activityData } from "./sessions";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const feedOf = (index: Index) => buildFeed(index, activityData(index, FIXTURE_NOW));
const keys = (items: FeedItem[] | undefined) => (items ?? []).map((i) => i.key);
const runIds = (items: FeedItem[]) => items.flatMap((i) => (i.kind === "run" ? [i.run.id] : []));

/** The persisted side of c1201: SES-20261018-1201, started at 12:01 and not ended. */
function withSession1201(index: Index): Index {
  const session: Session = {
    ...(index.sessions[0] as Session),
    id: "SES-20261018-1201",
    skill: "pm-build",
    started_at: "2026-10-18T12:01:00Z",
    ended_at: null,
    goal: "Implement retry exhaustion",
    commits: [],
    raised: [],
    touched: [],
    file: ".azimuth/sessions/SES-20261018-1201.md",
  };
  return { ...index, sessions: [...index.sessions, session] };
}

describe("F-016 feed", () => {
  it("S-016.7.1 groups the feed into Today, Yesterday and Earlier by local day", () => {
    const groups = byPeriod(feedOf(fixtureIndex()), FIXTURE_NOW);
    expect(groups.map((g) => g.period)).toEqual(["today", "yesterday", "earlier"]);
    expect(groups.map((g) => g.heading)).toEqual([
      "Today · Sunday, Oct 18",
      "Yesterday · Saturday, Oct 17",
      "Earlier",
    ]);
    expect(keys(groups[0]?.items)).toEqual(["SES-20261018-1100", "SES-20261018-0930"]);
    expect(keys(groups[1]?.items)).toEqual(["SES-20261017-1430", "SES-20261017-0915"]);
    expect(keys(groups[2]?.items).slice(0, 2)).toEqual(["SES-20261016-1320", "d5a8f31"]);
  });

  it("S-016.7.2 leaves card sessions and thread commits and runs out of the feed", () => {
    const feed = feedOf(withSession1201(fixtureIndex()));
    expect(keys(feed)).not.toContain("SES-20261018-1201");
    for (const id of ["R-0137", "R-0138", "R-0140", "R-0141", "R-0142"])
      expect(runIds(feed)).not.toContain(id);
    expect(runIds(feed)).toContain("R-0139");
    expect(keys(feed)).toEqual(expect.arrayContaining(["d5a8f31", "c2d4e18"]));

    const exported = feedOf(withSession1201(fixtureIndex([])));
    expect(exported.find((i) => i.key === "SES-20261018-1201")?.kind).toBe("session");
  });
});
