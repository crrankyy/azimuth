import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveSession } from "../../../../test/fixtures/live/agents";
import { FIXTURE_NOW, fixtureIndex, timelineLive } from "../../../../test/fixtures/live/timeline";
import { LiveCards, liveCards } from "./LiveCards";
import { activityData, type ActivitySession } from "./sessions";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const at = (time: string) => `2026-10-18T${time}Z`;

const render = (sessions: ActivitySession[]) =>
  renderToStaticMarkup(<LiveCards sessions={sessions} now={FIXTURE_NOW} />);

/** Each anchor in the markup, in order; cards hold no nested links. */
const anchors = (markup: string) => markup.match(/<a [^>]*>.*?<\/a>/g) ?? [];

/** An attribute of the element's opening tag, or null. */
function attr(element: string, name: string): string | null {
  const open = element.slice(0, element.indexOf(">"));
  return new RegExp(` ${name}="([^"]*)"`).exec(open)?.[1] ?? null;
}

const classes = (element: string) => (attr(element, "class") ?? "").split(" ");

/** The fixture's three cards: c1201 and c1202 running, c1140 waiting on a permission prompt. */
function fixtureCards(): string[] {
  return anchors(render(liveCards(activityData(fixtureIndex(), FIXTURE_NOW))));
}

describe("F-016 live cards", () => {
  it("S-016.5.1 shows running cards with their goal, work and latest action", () => {
    const cards = fixtureCards();
    expect(cards.map((card) => classes(card).includes("live-card"))).toEqual([true, true, true]);
    expect(cards.map((card) => attr(card, "id"))).toEqual([
      "ses-SES-20261018-1201",
      "ses-SES-20261018-1202",
      "ses-SES-20261018-1140",
    ]);
    const [first = "", second = ""] = cards;
    expect(attr(first, "href")).toBe("#/agents/c1201");
    for (const text of [
      "Running",
      ">…1201<",
      ">4m<",
      ">Implement retry exhaustion<",
      ">F-005 · T-005.4 · 2 subagents<",
      ">▸ test-runner: pnpm vitest run<",
    ])
      expect(first).toContain(text);
    for (const text of [">3m<", ">F-007 · T-007.4 · 1 subagent<", ">▸ Edit src/api/attempts.ts<"])
      expect(second).toContain(text);
  });

  it("S-016.5.2 says what a waiting card waits for, without an action", () => {
    const third = fixtureCards()[2] ?? "";
    expect(classes(third)).toContain("s-waiting");
    for (const text of [
      "Waiting on you",
      ">…1140<",
      ">5m<",
      ">Write the F-010 spec<",
      ">F-010 · 1 subagent<",
      ">Permission prompt: Bash pnpm vitest run<",
    ])
      expect(third).toContain(text);
    expect(third).not.toContain("▸");
  });

  it("S-016.5.3 shows a session without a goal or a SES by its Claude Code ID", () => {
    const live = liveSession({ claude_session: "c9abcdef12", started_at: at("12:03:00") });
    const session = activityData(fixtureIndex([live]), FIXTURE_NOW).byKey.get("c9abcdef12");
    expect(session).toBeDefined();
    const markup = render(session ? [session] : []);
    expect(anchors(markup)).toHaveLength(1);
    for (const text of [">c9abcdef<", ">2m<", ">No goal recorded<"]) expect(markup).toContain(text);
    expect(markup).not.toMatch(/ id="/);
    expect(markup).not.toContain("live-card-facts");
    expect(markup).not.toContain("▸");
  });

  it("S-016.5.4 has no cards for finished sessions or an export", () => {
    const finished = timelineLive().map((s) =>
      ["c1201", "c1202", "c1140"].includes(s.claude_session)
        ? { ...s, status: "done" as const }
        : s,
    );
    for (const index of [fixtureIndex(finished), fixtureIndex([])]) {
      const sessions = liveCards(activityData(index, FIXTURE_NOW));
      expect(sessions).toEqual([]);
      expect(render(sessions)).toBe("");
    }
  });
});
