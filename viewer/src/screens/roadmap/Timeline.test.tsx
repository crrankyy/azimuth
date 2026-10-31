import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Commit, Index, Milestone } from "../../../../src/core/types";
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

/** A collapsed lane's markup; its toggle offers to expand the milestone. */
const closedLane = (html: string, id: string) =>
  html.split('class="rm-lane').find((part) => part.includes(`aria-label="Expand ${id}"`)) ?? "";

const commitRows = (html: string) =>
  html.match(/<span class="rm-commit"[^>]*>.*?<\/span><\/span>/g) ?? [];

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

const commit = (sha: string, subject: string, refs: string[], at: string): Commit => ({
  sha,
  at,
  actor: "agent",
  session: null,
  subject,
  refs,
  files_changed: 1,
});

describe("F-028 the Roadmap's release and commits", () => {
  it("S-028.7.6 shows M-02's commit row and M-01's release on its collapsed lane", () => {
    const index = fixture();
    Object.assign(milestone(index, "M-01"), { tag: "v1.0.0", released_commit: "c0ffee1" });
    index.commits = [
      commit("def5678", "chore(azimuth): plan M-02", ["M-02", "F-005"], "2026-10-17T10:00:00Z"),
      commit("c0ffee1", "chore(azimuth): release M-01", ["M-01"], "2026-09-28T10:00:00Z"),
      ...index.commits,
    ];
    const html = render("#/roadmap", index);
    const rows = commitRows(lane(html, "M-02"));
    expect(rows.map(text)).toEqual(["def5678 chore(azimuth): plan M-02"]);
    const m01 = closedLane(html, "M-01");
    expect(text(m01)).toContain("Released Sep 28 · v1.0.0 · c0ffee1 · 3 of 3 done");
    expect(m01).not.toContain("rm-commit");
  });

  it("S-028.7.7 lists five of seven commits on an expanded lane, then the rest's count", () => {
    const index = fixture();
    const shas = ["b000001", "b000002", "b000003", "b000004", "b000005", "b000006", "b000007"];
    index.commits = [
      ...shas.map((sha) => commit(sha, "chore: step", ["M-02"], "2026-10-17T10:00:00Z")),
      ...index.commits,
    ];
    const m02 = lane(render("#/roadmap", index), "M-02");
    const rows = commitRows(m02);
    expect(rows.map((r) => text(r).split(" ")[0])).toEqual(shas.slice(0, 5));
    const last = rows.at(-1) ?? "";
    expect(text(m02.slice(m02.indexOf(last) + last.length))).toMatch(/^and 2 more/);
  });
});
