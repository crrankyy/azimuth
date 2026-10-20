import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index } from "../../../../src/core/types";
import { FIXTURE_NOW, fixtureIndex } from "../../../../test/fixtures/live/timeline";
import { AgentTimeline } from "./AgentTimeline";
import type { ActivityKind } from "./feed";
import { layoutTimeline, type TimelineRange } from "./timeline";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const ALL_KINDS = new Set<ActivityKind>(["session", "subagent", "commit", "run", "action"]);

function render(index: Index = fixtureIndex(), now = FIXTURE_NOW, range: TimelineRange = "75m") {
  const layout = layoutTimeline(index, { now, range, kinds: ALL_KINDS, feature: "all" });
  return renderToStaticMarkup(
    <AgentTimeline layout={layout} range={range} onRange={() => undefined} />,
  );
}

/** Text without markup, whitespace collapsed. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Each `<a class="tl-row …">…</a>` with the title of its opening tag. */
function rows(html: string): { title: string; html: string }[] {
  return [...html.matchAll(/<a class="tl-row[^"]*"[^>]*>.*?<\/a>/g)].map(([row]) => ({
    title: /^<a [^>]*title="([^"]*)"/.exec(row)?.[1] ?? "",
    html: row,
  }));
}

function rowTitled(html: string, title: string): string {
  const found = rows(html).find((r) => r.title === title);
  if (!found) throw new Error(`No row titled ${title}`);
  return text(found.html);
}

const attr = (tag: string, name: string) => new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];

/** The legend and the earlier line, from the legend to the end of the section. */
const legend = (html: string) => html.slice(html.indexOf('class="tl-legend"'));

const LEGEND = [
  "Running",
  "Waiting on you",
  "Finished",
  "Commit",
  "Run passed",
  "Run failed",
  "Raised a question or ADR",
];

describe("F-016 the Agent timeline", () => {
  it("S-016.4.1 shows the header, range toggle, ticks and now line", () => {
    const html = render();
    expect(html).toMatch(/^<section [^>]*aria-label="Agent timeline"/);
    expect(text(html)).toContain("Agent timeline");
    expect(text(html)).toContain(
      "Today, 11:00 – 12:15 · each row is a session, indented rows are its subagents",
    );
    const group = /<div class="az-seg" role="group" aria-label="Range">(.*?)<\/div>/.exec(html);
    expect(group?.[1]).toBe(
      '<button type="button" aria-pressed="true">Last 75 min</button>' +
        '<button type="button" aria-pressed="false">Today</button>' +
        '<button type="button" aria-pressed="false">3 days</button>',
    );
    for (const label of ["11:00", "11:15", "11:30", "11:45", "12:00"])
      expect(html).toMatch(new RegExp(`<span class="tl-tick"[^>]*>${label}</span>`));
    expect(html).toContain('<div class="tl-now" style="left:86.67%"><span>now</span></div>');
  });

  it("S-016.4.1 gives each tick label only the room the now label leaves it", () => {
    // Today at 12:05: the now line is at 50.35%, just after the 12:00 tick.
    const today = render(fixtureIndex(), FIXTURE_NOW, "today");
    const room = (html: string, label: string) =>
      new RegExp(`<span class="tl-tick" style="[^"]*max-width:([^"]*)">${label}</span>`).exec(
        html,
      )?.[1];
    // Before the line: up to the now label, which reaches 20 px left of it.
    expect(room(today, "09:00")).toBe("calc(12.85% - 26px)");
    expect(room(today, "12:00")).toBe("calc(0.35% - 26px)");
    // After it: none while the label would start under the now label, else plenty.
    expect(room(today, "15:00")).toBe("calc((12.15% - 18px) * 1000)");
    const threeDays = render(fixtureIndex(), FIXTURE_NOW, "3d");
    expect(room(threeDays, "Sun Oct 18")).toBe("calc(16.78% - 26px)");
  });

  it("S-016.4.2 says each row's status in words", () => {
    const html = render();
    expect(rows(html)).toHaveLength(9);
    const waiting = rowTitled(html, "SES-20261018-1140");
    for (const part of ["…1140", "pm-spec", "F-010", "waiting on you"])
      expect(waiting).toContain(part);
    expect(rowTitled(html, "SES-20261018-1100")).toContain("done");
    const running = rowTitled(html, "SES-20261018-1201");
    expect(running).toContain("running");
    expect(running).toContain("Edit policy.ts");
    expect(html).toContain('<span class="tl-action" title="Edit src/retry/policy.ts"');
    const subagent = rowTitled(html, "a3");
    for (const part of ["└", "researcher", "survey log fields"]) expect(subagent).toContain(part);
  });

  it("S-016.4.3 gives every span and marker its meaning in text", () => {
    const html = render();
    const tags = [...html.matchAll(/<span [^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) =>
        (attr(tag, "class") ?? "").split(" ").some((c) => c === "tl-span" || c === "tl-mark"),
      );
    // 11 spans (2 rows also have a wait) and the 7 markers of SES-20261018-1100.
    expect(tags).toHaveLength(18);
    for (const tag of tags) {
      expect(attr(tag, "title")).toBeTruthy();
      expect(attr(tag, "aria-label")).toBe(attr(tag, "title"));
    }
    expect(
      tags.some(
        (tag) =>
          /class="[^"]*\bk-waiting\b/.test(tag) &&
          attr(tag, "title") ===
            "Waiting on you · 12:00–now · Permission prompt: Bash pnpm vitest run",
      ),
    ).toBe(true);
    expect(html).toMatch(
      /<span class="tl-mark m-run-fail"[^>]* title="R-0142 failed · T-005.4"[^>]*><\/span><span [^>]*>R-0142 ✕<\/span>/,
    );
  });

  it("S-016.4.4 shows the legend and the earlier line", () => {
    const html = legend(render());
    for (const label of LEGEND) expect(text(html)).toContain(label);
    expect(html).toMatch(
      /Earlier today:.*?<a [^>]*href="#\/activity\/SES-20261018-0930"[^>]*>SES-20261018-0930<\/a>.*?09:30–10:25/,
    );
  });

  it("BUG-0078 puts each action after its span until the track is measured", () => {
    const html = render();
    const actions = [...html.matchAll(/<span [^>]*class="tl-action[^"]*"[^>]*>([^<]*)<\/span>/g)];
    expect(actions.map(([, label]) => label)).toEqual([
      "Edit policy.ts",
      "pnpm vitest run",
      "Edit attempts.ts",
      "Read attempts.ts",
    ]);
    for (const [tag] of actions) {
      expect(attr(tag, "class")).toBe("tl-action");
      expect(attr(tag, "style")).toMatch(
        /^left:calc\([\d.]+% \+ 8px\);max-width:calc\([\d.]+% - 8px\)$/,
      );
    }
    // Session …1201's span ends at the now line, 86.66% across.
    expect(attr(actions[0]?.[0] ?? "", "style")).toMatch(
      /^left:calc\(86\.66% \+ 8px\);max-width:calc\(13\.34\d*% - 8px\)$/,
    );
  });

  it("S-016.4.5 says so when no session falls in the range", () => {
    const html = render(fixtureIndex([]), Date.parse("2026-10-18T20:00:00Z"));
    expect(text(html)).toContain("Today, 19:00 – 20:15");
    expect(text(html)).toContain("No agent sessions in this range.");
    for (const label of LEGEND) expect(text(legend(html))).toContain(label);
    expect(html).not.toContain('class="tl-row');
    expect(text(legend(html))).toMatch(
      /Earlier today: SES-20261018-0930 · 09:30–10:25.*SES-20261018-1100 · 11:00–11:58/,
    );
  });
});
