import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { FIXTURE_NOW, fixtureIndex } from "../../../test/fixtures/live/timeline";
import { UiProvider } from "../components/Ui";
import { IndexContext } from "../data/IndexProvider";
import { parseRoute } from "../lib/router";
import { ActivityScreen } from "./Activity";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

function render(index: Index, hash = "#/activity"): string {
  const value = {
    index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: FIXTURE_NOW,
    changed: new Set<string>(),
    now: FIXTURE_NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <ActivityScreen route={parseRoute(hash)} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** Offsets of the elements whose class list includes `cls`, in markup order. */
function withClass(html: string, cls: string): number[] {
  return [...html.matchAll(/ class="([^"]*)"/g)]
    .filter((m) => (m[1] ?? "").split(" ").includes(cls))
    .map((m) => m.index);
}

/** The opening tag of the element with this id, or "". */
const openTag = (html: string, id: string) =>
  new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";

const classesOf = (tag: string) => (/ class="([^"]*)"/.exec(tag)?.[1] ?? "").split(" ");

/** The chips in the header: their labels and aria-pressed, in order. */
const chips = (html: string) =>
  [
    ...html.matchAll(
      /<button type="button" class="az-chip[^"]*" aria-pressed="(\w+)"[^>]*>(.*?)<\/button>/g,
    ),
  ].map((m) => [m[2], m[1]]);

const css = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("F-016 Activity screen", () => {
  it("S-016.8.1 shows the five chips, the active count, then the timeline, the cards and the feed", () => {
    const html = render(fixtureIndex());
    expect(chips(html)).toEqual([
      ["Sessions", "true"],
      ["Subagents", "true"],
      ["Commits", "true"],
      ["Verify runs", "true"],
      ["Your actions", "true"],
    ]);
    expect(html).toContain("3 sessions active");
    const timeline = html.indexOf('aria-label="Agent timeline"');
    const [card] = withClass(html, "live-card");
    const [session] = withClass(html, "ses-card");
    expect(timeline).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(timeline);
    expect(session).toBeGreaterThan(card ?? Infinity);
    expect(html).not.toContain('aria-label="Live agent sessions"');
    expect(html).not.toContain("No agent is working right now.");
  });

  it("S-016.8.2 expands the finished session the route names and collapses the others", () => {
    const html = render(fixtureIndex(), "#/activity/SES-20261018-0930");
    expect(html).toContain('<article id="ses-SES-20261018-0930"');
    const other = openTag(html, "ses-SES-20261018-1100");
    expect(classesOf(other)).toEqual(expect.arrayContaining(["ses-card", "collapsed"]));
  });

  it("S-016.8.3 targets a running session's card from its route", () => {
    const html = render(fixtureIndex(), "#/activity/SES-20261018-1201");
    expect(classesOf(openTag(html, "ses-SES-20261018-1201"))).toContain("live-card");
    expect(html).not.toContain('<article id="ses-SES-20261018-1201"');
  });

  it("S-016.8.4 shows persisted sessions only in an export and empty states in an empty project", () => {
    const exported = render(fixtureIndex([]));
    expect(exported).not.toContain("sessions active");
    expect(withClass(exported, "live-card")).toEqual([]);
    expect(exported).toMatch(/<a class="tl-row [^"]*"[^>]* title="SES-20261018-1100"/);

    const empty = structuredClone(expectedIndex) as unknown as Index;
    empty.sessions = [];
    empty.commits = [];
    empty.runs = [];
    empty.live = [];
    empty.features = [];
    const html = render(empty);
    expect(html).toContain("No activity yet");
    expect(html).toContain("No agent sessions in this range.");
  });

  it("S-016.8.5 keeps the timeline and the cards still, and stops the running mark under reduced motion", () => {
    for (const path of ["./activity/timeline.css", "./activity/live-cards.css"]) {
      const text = css(path);
      expect(text).not.toContain("animation");
      expect(text).not.toContain("@keyframes");
    }
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([^{}]*\{[^{}]*\})*[^{}]*\}/g;
    const blocks = [...css("../styles/azimuth.css").matchAll(reduced)].map((m) => m[0]);
    expect(blocks.some((b) => /\.az-run\s*\{[^}]*animation:\s*none/.test(b))).toBe(true);
  });
});
