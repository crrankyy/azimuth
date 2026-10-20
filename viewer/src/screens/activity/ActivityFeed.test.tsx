import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index } from "../../../../src/core/types";
import { FIXTURE_NOW, fixtureIndex, timelineLive } from "../../../../test/fixtures/live/timeline";
import { UiProvider } from "../../components/Ui";
import { IndexContext } from "../../data/IndexProvider";
import { localDay } from "../../lib/format";
import { ActivityFeed } from "./ActivityFeed";
import { buildFeed, matchesFeature, type ActivityKind, type FeedItem } from "./feed";
import { liveCards } from "./LiveCards";
import { activityData, type ActivitySession } from "./sessions";
import { sessionThreads } from "./thread";

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

function render(
  index: Index,
  items: FeedItem[],
  cards: ActivitySession[],
  expanded: string[] = [],
): string {
  const now = FIXTURE_NOW;
  const data = activityData(index, now);
  const threads = sessionThreads(index, data, { now, kinds: ALL_KINDS });
  const value = {
    index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: now,
    changed: new Set<string>(),
    now,
    act: async () => ({ ok: true, status: 200 }),
  };
  const state = {
    now,
    expanded: new Set(expanded),
    onToggle: () => undefined,
    changed: new Set<string>(),
    threads,
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <ActivityFeed items={items} cards={cards} state={state} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** Each period section's markup, up to where the next one begins (cards hold sections too). */
const sections = (html: string) => html.split('<section class="feed-period"').slice(1);

/** Markup without tags, spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A section heading's two parts: "Today" and "Sunday, Oct 18" ("Earlier" has no second part). */
function heading(section: string): [string, string] {
  const h2 = /<h2[^>]*>(.*?)<\/h2>/.exec(section)?.[1] ?? "";
  const at = h2.indexOf("<span");
  const lead = textOf(at < 0 ? h2 : h2.slice(0, at));
  const rest = at < 0 ? "" : textOf(h2.slice(at)).replace(/^· /, "");
  return [lead, rest];
}

/** Offsets of the elements whose class list includes `cls`, in markup order. */
function withClass(html: string, cls: string): number[] {
  return [...html.matchAll(/ class="([^"]*)"/g)]
    .filter((m) => (m[1] ?? "").split(" ").includes(cls))
    .map((m) => m.index);
}

/** The feed row whose markup mentions `text`, up to where the next row begins. */
const row = (html: string, text: string) =>
  html.split('<li class="feed-item').find((part) => part.includes(text)) ?? "";

describe("F-016 activity feed", () => {
  it("S-016.7.3 renders the cards first under Today and dates the Earlier rows", () => {
    const index = fixtureIndex();
    const data = activityData(index, FIXTURE_NOW);
    const html = render(index, buildFeed(index, data), liveCards(data), ["SES-20261018-1100"]);
    const [today = ""] = sections(html);
    expect(heading(today)).toEqual(["Today", "Sunday, Oct 18"]);
    const cards = withClass(today, "live-card");
    expect(cards).toHaveLength(3);
    const [firstSession] = withClass(today, "ses-card");
    expect(firstSession).toBeDefined();
    expect(Math.max(...cards)).toBeLessThan(firstSession ?? -1);
    expect(withClass(html, "feed-rail")).toEqual([]);
    expect(row(html, "d5a8f31")).toContain("Oct 15, 09:05");
    expect(row(html, 'id="ses-SES-20261016-1320"')).toContain("Oct 16, 13:20–13:40");
  });

  it("S-016.7.4 gives the cards a Today group of their own", () => {
    const index = fixtureIndex();
    const data = activityData(index, FIXTURE_NOW);
    const today = localDay(new Date(FIXTURE_NOW).toISOString());
    const items = buildFeed(index, data).filter((i) => localDay(i.at) !== today);
    const card = liveCards(data).filter((s) => s.key === "SES-20261018-1201");
    expect(card).toHaveLength(1);
    const [first = "", second = ""] = sections(render(index, items, card));
    expect(heading(first)).toEqual(["Today", "Sunday, Oct 18"]);
    expect(withClass(first, "live-card")).toHaveLength(1);
    expect(withClass(first, "ses-card")).toEqual([]);
    expect(heading(second)[0]).toBe("Yesterday");
  });

  it("S-016.3.2 files a feed session under the features its live data names, as the timeline does", () => {
    // c1100 is SES-20261018-1100's live side; its session touched only F-005's IDs.
    const live = timelineLive().map((s) =>
      s.claude_session === "c1100" ? { ...s, features: ["F-010"] } : s,
    );
    const index = fixtureIndex(live);
    const data = activityData(index, FIXTURE_NOW);
    const session = buildFeed(index, data).find((i) => i.key === "SES-20261018-1100");
    expect(session?.features).toEqual(data.byKey.get("SES-20261018-1100")?.features);
    expect(session && matchesFeature(session, "F-010")).toBe(true);
    expect(session && matchesFeature(session, "F-005")).toBe(true);
  });
});
