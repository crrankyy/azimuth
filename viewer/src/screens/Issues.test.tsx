import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { UiProvider } from "../components/Ui";
import { IndexContext } from "../data/IndexProvider";
import { parseRoute, routeForId } from "../lib/router";
import { IssuesScreen } from "./Issues";
import { issuePageHref } from "./issues/model";

const NOW = Date.parse("2026-10-18T12:00:00Z");

function render(hash: string): string {
  const value = {
    index: structuredClone(expectedIndex) as unknown as Index,
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
        <IssuesScreen route={parseRoute(hash)} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** The table row that holds an issue's ID chip. */
const row = (html: string, id: string) =>
  html.split("<tr").find((r) => r.includes(`>${id}</a>`)) ?? "";

/** Every link in some markup, as its href and its text. */
const links = (html: string) =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map(([, href, inner]) => ({
    href,
    text: (inner ?? "").replace(/<[^>]+>/g, "").trim(),
  }));

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("F-017 the Issues list opens an issue's page", () => {
  it("S-017.1.1 links a row's ID and title to the issue's page", () => {
    const bug = row(render("#/issues"), "BUG-0001");
    expect(bug).toContain('<a class="az-id" href="#/issues/BUG-0001/page">BUG-0001</a>');
    expect(links(bug)).toContainEqual({
      href: "#/issues/BUG-0001/page",
      text: "Worker can double-send when SQLite returns SQLITE_BUSY after the request",
    });
  });

  it("S-017.1.2 links the preview card to the full page", () => {
    const html = render("#/issues/BUG-0001");
    const card = html.split('aria-label="BUG-0001 detail"')[1] ?? "";
    expect(links(card)).toContainEqual({ href: "#/issues/BUG-0001/page", text: "Open full page" });
  });

  it("S-017.1.3 offers Enter to open the selected issue", () => {
    const html = render("#/issues/DEBT-0001");
    const hints = html.split('class="hints"')[1]?.split("</header>")[0] ?? "";
    expect(text(`<span ${hints}`)).toContain("j k move ↵ open");
    expect(row(html, "DEBT-0001")).toContain('aria-selected="true"');
    expect(row(html, "BUG-0001")).toContain('aria-selected="false"');
    expect(issuePageHref("DEBT-0001")).toBe("#/issues/DEBT-0001/page");
  });

  it("S-017.1.4 keeps ID chips elsewhere landing on the list", () => {
    expect(routeForId("BUG-0001")).toBe("#/issues/BUG-0001");
  });
});
