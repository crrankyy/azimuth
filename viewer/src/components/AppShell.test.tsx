import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LiveSession } from "../../../src/core/types";
import { AGENTS_NOW, agentsLive, indexWithLive } from "../../../test/fixtures/live/agents";
import { IndexContext } from "../data/IndexProvider";
import type { Section } from "../lib/router";
import { Sidebar } from "./AppShell";
import { UiProvider } from "./Ui";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

function render(live: LiveSession[], current: Section = "inbox"): string {
  const value = {
    index: indexWithLive(live),
    connection: "live" as const,
    attempts: 0,
    lastUpdate: AGENTS_NOW,
    changed: new Set<string>(),
    now: AGENTS_NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <Sidebar current={current} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** The fixture's sessions with these Claude Code session IDs, in fixture order. */
const only = (...ids: string[]) => agentsLive().filter((s) => ids.includes(s.claude_session));

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The section links' opening tags and their text. */
const navLinks = (html: string) => {
  const nav = /<nav class="nav"[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? "";
  return [...nav.matchAll(/(<a [^>]*>)(.*?)<\/a>/g)].map(([, open, inner]) => ({
    open: open ?? "",
    text: text(inner ?? ""),
  }));
};

const strip = (html: string) => /<a class="live-strip"[^>]*>.*?<\/a>/.exec(html)?.[0] ?? "";

describe("F-015 Agents in the sidebar", () => {
  it("S-015.1.1 lists Agents second with the number of sessions not done", () => {
    const agents = navLinks(render(agentsLive(), "agents"))[1];
    expect(agents?.open).toContain('href="#/agents"');
    expect(agents?.open).toContain('aria-current="page"');
    expect(agents?.text).toBe("Agents 3");
  });

  it("S-015.1.2 shows no count when every session is done", () => {
    const agents = navLinks(render(only("c1100", "c0930", "c1430")))[1];
    expect(agents?.text).toBe("Agents");
  });

  it("S-015.1.5 shows the first session still working in the footer strip", () => {
    const html = strip(render(agentsLive()));
    expect(html).toContain('href="#/agents"');
    expect(text(/<span class="live-text">(.*?)<\/span>/.exec(html)?.[1] ?? "")).toBe(
      "T-005.4 · pnpm vitest run src/retry/policy.test.ts",
    );
    expect(html).toContain(
      '<span class="agent-status running"><span class="az-run" aria-hidden="true"></span><span class="sr-only">Running</span></span>',
    );
  });

  it("S-015.1.6 says what a waiting session waits for in the footer strip", () => {
    const html = strip(render(only("c1140", "c1100", "c0930")));
    expect(text(/<span class="live-text">(.*?)<\/span>/.exec(html)?.[1] ?? "")).toBe(
      "F-010 · Permission prompt: WebFetch prometheus.io",
    );
    expect(html).toContain(
      '<span class="agent-status waiting"><span class="az-wait" aria-hidden="true"></span><span class="sr-only">Waiting on you</span></span>',
    );
  });

  it("S-015.1.7 leaves no footer strip for a recently seen done session", () => {
    const [c0930] = only("c0930");
    const live = [{ ...c0930!, last_seen_at: new Date(AGENTS_NOW - 30_000).toISOString() }];
    expect(render(live)).not.toContain("live-strip");
  });
});
