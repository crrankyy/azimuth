import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Milestone } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { Screen } from "../../App";
import { UiProvider } from "../../components/Ui";
import { IndexContext } from "../../data/IndexProvider";
import { parseRoute } from "../../lib/router";

const NOW = Date.parse("2026-10-18T12:00:00Z");

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

const milestone = (index: Index, id: string): Milestone =>
  index.milestones.find((m) => m.id === id)!;

function render(hash: string, index = fixture()): string {
  const value = {
    index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <Screen route={parseRoute(hash)} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** A milestone lane's markup, cut at the next lane; its toggle names the milestone. */
const lane = (html: string, id: string) =>
  html.split('class="rm-lane').find((part) => part.includes(`aria-label="Collapse ${id}"`)) ?? "";

const releaseButtons = (html: string) => html.match(/<button[^>]*>Release…<\/button>/g) ?? [];

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("F-028 releasing from the Roadmap", () => {
  it("S-028.6.4 shows an enabled Release… on a finished planned milestone only", () => {
    const index = fixture();
    milestone(index, "M-03").progress = { done: 3, total: 3, by_status: { done: 3 } };
    const finished = releaseButtons(lane(render("#/roadmap", index), "M-03"));
    expect(finished).toHaveLength(1);
    expect(finished[0]).not.toContain("disabled");

    const html = render("#/roadmap");
    expect(releaseButtons(lane(html, "M-03"))).toEqual([]);
    const active = lane(html, "M-02");
    const buttons = releaseButtons(active);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('disabled=""');
    expect(text(active)).toContain("Release… 3 features not done");
  });
});
