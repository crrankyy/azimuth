import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IDLE_REASON } from "../../../src/core/live-agents";
import type { Index, LiveSession } from "../../../src/core/types";
import { AGENTS_NOW, agentsLive, indexWithLive } from "../../../test/fixtures/live/agents";
import { UiProvider } from "../components/Ui";
import { IndexContext, type Connection } from "../data/IndexProvider";
import { parseRoute } from "../lib/router";
import { AgentsScreen } from "./Agents";
import { needsYou, plannedOverlaps } from "./agents/model";

// The fixture's times are UTC, and "today" is the viewer's local day.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

function render(index: Index, connection: Connection = "live"): string {
  const value = {
    index,
    connection,
    attempts: 0,
    lastUpdate: AGENTS_NOW,
    changed: new Set<string>(),
    now: AGENTS_NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <AgentsScreen route={parseRoute("#/agents")} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** The fixture's session with this Claude Code session ID, from `live`. */
const find = (live: LiveSession[], id: string): LiveSession => {
  const found = live.find((s) => s.claude_session === id);
  if (!found) throw new Error(`No fixture session ${id}`);
  return found;
};

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** The inner markup of the first `tag` element whose aria-label is `label`. */
const labelled = (html: string, tag: string, label: string) =>
  new RegExp(`<${tag}[^>]*aria-label="${label}"[^>]*>(.*?)</${tag}>`).exec(html)?.[1] ?? "";

const card = (html: string, label: string) => labelled(html, "article", label);
const panel = (html: string, label: string) => labelled(html, "section", label);
const main = (html: string) => html.split("<aside")[0] ?? "";
const aside = (html: string) => /<aside[^>]*>.*<\/aside>/.exec(html)?.[0] ?? "";

/** Links as [href, text] pairs. */
const links = (html: string) =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map(([, to, inner]) => [
    to ?? "",
    text(inner ?? ""),
  ]);

/** The text of the first element with this class. */
const byClass = (html: string, cls: string) =>
  text(new RegExp(`<(\\w+) class="${cls}"[^>]*>(.*?)</\\1>`).exec(html)?.[2] ?? "");

describe("F-015 the Agents screen", () => {
  it("S-015.2.1 counts sessions in the header and in the filter", () => {
    const html = render(indexWithLive(agentsLive()));
    expect(text(html)).toContain("3 sessions · 4 subagents");
    expect(text(html)).toContain("Live · 12:05");
    const filter = /<div class="az-seg" role="group" aria-label="Filter agents">(.*?)<\/div>/.exec(
      html,
    )?.[1];
    expect(
      [...(filter ?? "").matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([b]) => text(b)),
    ).toEqual(["Active 3", "Running 2", "Waiting on you 1", "Finished today 2"]);
    expect(filter).toContain('<button type="button" aria-pressed="true">Active');
  });

  it("S-015.2.2 groups running, then waiting, then finished-today sessions", () => {
    const html = render(indexWithLive(agentsLive()));
    const sections = [...main(html).matchAll(/<section[^>]*aria-label="([^"]*)"/g)].map(
      ([, label]) => label,
    );
    expect(sections).toEqual(["Running", "Waiting on you", "Finished today"]);
    const articles = (section: string) =>
      [...panel(html, section).matchAll(/<article[^>]*aria-label="([^"]*)"/g)].map(([, l]) => l);
    expect(articles("Running")).toEqual(["SES-20261018-1201", "SES-20261018-1202"]);
    expect(articles("Waiting on you")).toEqual(["SES-20261018-1140"]);
    expect(links(panel(html, "Finished today")).map(([, t]) => t?.split(" ")[1])).toEqual([
      "SES-20261018-1100",
      "SES-20261018-0930",
    ]);
    expect(html).not.toContain("SES-20261017-1430");
  });

  it("S-015.2.3 shows a running session's card", () => {
    const html = card(render(indexWithLive(agentsLive())), "SES-20261018-1201");
    expect(html).toContain(
      '<span class="agent-status running"><span class="az-run" aria-hidden="true"></span>Running</span>',
    );
    expect(html).toContain('<span class="az-tag">build</span>');
    const t = text(html);
    expect(t).toContain("started 12:01 · 3m 56s");
    expect(t).toContain("Turn S-005.2.1 green: implement retry exhaustion");
    expect(byClass(html, "agent-working")).toBe(
      "Working on F-005 T-005.4 Exhaustion & policy validation (red → green)",
    );
    expect(byClass(html, "agent-action az-mono")).toBe(
      "▸ Edit src/retry/policy.ts +4 −1 · 48s ago",
    );
    expect(links(html)).toContainEqual(["#/agents/c1201", "Transcript"]);
  });

  it("S-015.2.4 says what a waiting session's card waits for", () => {
    const html = card(render(indexWithLive(agentsLive())), "SES-20261018-1140");
    expect(text(html)).toContain("Waiting on you");
    expect(byClass(html, "agent-wait")).toBe(
      "Permission prompt: WebFetch prometheus.io · since 12:00",
    );
    expect(html).not.toContain("agent-action");
    expect(byClass(html, "agent-working")).toBe("Working on F-010 Prometheus metrics");
  });

  it("S-015.2.5 lists each subagent in the card's tree", () => {
    const html = card(render(indexWithLive(agentsLive())), "SES-20261018-1201");
    const tree = links(html.split('class="az-tree')[1] ?? "");
    expect(tree.map(([to]) => to)).toEqual(["#/agents/c1201/a1", "#/agents/c1201/a2"]);
    for (const part of [
      "Running",
      "test-runner",
      "Re-run policy.test.ts after each edit",
      "pnpm vitest run src/retry/policy.test.ts",
      "40s",
    ])
      expect(tree[0]?.[1]).toContain(part);
    for (const part of ["Done", "explorer", "Find every caller of decideRetry()", "1m 12s"])
      expect(tree[1]?.[1]).toContain(part);
  });

  it("S-015.2.6 shows a session without an SES, goal or work by its short ID", () => {
    const live = agentsLive();
    Object.assign(find(live, "c1202"), {
      claude_session: "7f3a9c2e-1202-4b1d-9c55-0d1e2f3a4b5c",
      ses: null,
      goal: null,
      skill: null,
      feature: null,
      task: null,
      features: [],
    });
    const html = card(render(indexWithLive(live)), "7f3a9c2e");
    expect(text(html)).toContain("7f3a9c2e");
    expect(text(html)).toContain("No goal recorded");
    expect(html).not.toContain("az-tag");
    expect(html).not.toContain("Working on");
    expect(links(html)).toContainEqual([
      "#/agents/7f3a9c2e-1202-4b1d-9c55-0d1e2f3a4b5c",
      "Transcript",
    ]);
  });

  it("S-015.2.7 shows an action without sizes, and a failed one", () => {
    const html = render(indexWithLive(agentsLive()));
    const action = byClass(card(html, "SES-20261018-1202"), "agent-action az-mono");
    expect(action).toBe("▸ Edit src/api/attempts.ts · 21s ago");
    expect(action).not.toMatch(/[+−]/);
    const live = agentsLive();
    find(live, "c1201").main.current!.error = "Exit code 1";
    const failed = card(render(indexWithLive(live)), "SES-20261018-1201");
    expect(byClass(failed, "agent-action az-mono")).toContain("failed");
  });

  it("S-015.2.8 shows sessions finished today as rows", () => {
    const rows = links(panel(render(indexWithLive(agentsLive())), "Finished today"));
    expect(rows).toEqual([
      [
        "#/activity/SES-20261018-1100",
        "Done SES-20261018-1100 Build F-005 tasks T-005.2 to T-005.4 · 2 subagents · left a handoff 11:00–11:58",
      ],
      [
        "#/activity/SES-20261018-0930",
        "Done SES-20261018-0930 Write the F-008 spec · left a handoff 09:30–10:25",
      ],
    ]);
  });

  it("S-015.2.10 shows an empty state without agents or in a snapshot", () => {
    const empty = text(render(indexWithLive([])));
    expect(empty).toContain("No agent is working right now");
    expect(empty).toContain("Sessions show up here while Claude Code works.");
    const snapshot = text(render(indexWithLive(agentsLive()), "export"));
    expect(snapshot).toContain("Agents are only shown in the live viewer");
    expect(snapshot).not.toContain("SES-20261018-1201");
  });
});

describe("F-015 the Agents side panel", () => {
  it("S-015.3.1 counts what is running, waiting and done today", () => {
    expect(text(panel(render(indexWithLive(agentsLive())), "Right now"))).toBe(
      "Right now Running 2 sessions · 2 subagents Waiting on you 1 session Done today 2 sessions · 4 subagents",
    );
  });

  it("S-015.3.2 lists the files being edited without a conflict", () => {
    expect(text(panel(render(indexWithLive(agentsLive())), "Files being edited"))).toBe(
      "Files being edited src/retry/policy.ts …1201 src/api/attempts.ts …1202 No two agents are editing the same file",
    );
  });

  it("S-015.3.5 names features in flight that plan the same file", () => {
    expect(text(panel(render(indexWithLive(agentsLive())), "Planned overlaps"))).toBe(
      "Planned overlaps F-005 and F-007 both plan changes to src/worker/deliver.ts",
    );
  });

  it("S-015.3.6 shows no overlap when one of the features isn't in flight", () => {
    const live = agentsLive();
    const c1202 = find(live, "c1202");
    c1202.status = "done";
    c1202.main.status = "done";
    c1202.main.ended_at = "2026-10-18T12:04:40Z";
    const index = indexWithLive(live);
    expect(plannedOverlaps(index)).toEqual([]);
    expect(text(panel(render(index), "Planned overlaps"))).toBe(
      "Planned overlaps No in-flight features plan changes to the same file",
    );
  });

  it("S-015.3.7 links a permission prompt to its agent without answering it", () => {
    const side = aside(render(indexWithLive(agentsLive())));
    const items = links(panel(side, "Needs you"));
    expect(items).toEqual([
      [
        "#/agents/c1140",
        // The wait mark's label is for screen readers.
        "Waiting on you SES-20261018-1140 · 5m Permission prompt: WebFetch prometheus.io Answer it in the Claude Code terminal running this session",
      ],
    ]);
    expect(side).not.toContain("<button");
  });

  it("S-015.3.8 doesn't count waiting for your next prompt as a permission prompt", () => {
    const live = agentsLive();
    const c1140 = find(live, "c1140");
    c1140.waiting = { reason: IDLE_REASON, since: "2026-10-18T12:00:00Z" };
    c1140.main.waiting = { reason: IDLE_REASON, since: "2026-10-18T12:00:00Z" };
    expect(needsYou(live)).toEqual([]);
    const html = render(indexWithLive(live));
    expect(text(panel(html, "Needs you"))).toBe("Needs you Nothing is waiting on you");
    expect(panel(html, "Waiting on you")).toContain('aria-label="SES-20261018-1140"');
  });
});
