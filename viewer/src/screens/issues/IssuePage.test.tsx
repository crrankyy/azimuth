import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Issue } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { Screen } from "../../App";
import { UiProvider } from "../../components/Ui";
import { IndexContext, type Connection } from "../../data/IndexProvider";
import { parseRoute } from "../../lib/router";
import { issuePageTargets } from "./model";

const NOW = Date.parse("2026-10-18T12:00:00Z");

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

const issue = (index: Index, id: string): Issue => index.issues.find((i) => i.id === id)!;

function render(hash: string, index = fixture(), connection: Connection = "live"): string {
  const value = {
    index,
    connection,
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

/** The markup after the opening tag that contains `mark`, up to the first `end`. */
const inside = (html: string, mark: string, end: string) =>
  (html.split(mark)[1] ?? "").replace(/^[^>]*>/, "").split(end)[0] ?? "";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const header = (html: string) => inside(html, 'class="ip-head"', "</header>");
const triage = (html: string) => inside(html, 'aria-label="Triage"', "</section>");
const description = (html: string) => inside(html, 'aria-label="Description"', "</section>");

/** A select's opening tag and its selected option's label. */
function select(html: string, label: string) {
  const options = inside(html, `aria-label="${label}"`, "</select>");
  return {
    tag: new RegExp(`<select[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? "",
    selected: /<option[^>]*selected=""[^>]*>([^<]*)</.exec(options)?.[1] ?? null,
  };
}

describe("F-017 an issue's page", () => {
  it("S-017.2.1 renders the issue's page for its route", () => {
    const html = render("#/issues/BUG-0001/page");
    const crumb = inside(html, 'aria-label="Breadcrumb"', "</nav>");
    expect(crumb).toContain('<a href="#/issues/BUG-0001">Issues</a>');
    expect(text(crumb)).toBe("Issues / BUG-0001");
    expect(text(inside(html, 'class="hints"', "<button"))).toBe(
      "j k previous / next issue esc back to list",
    );
    expect(text(inside(html, "<h1", "</h1>"))).toBe(
      "Worker can double-send when SQLite returns SQLITE_BUSY after the request",
    );
    expect(html).not.toContain("iss-table");
  });

  it("S-017.2.2 shows an empty state for an unknown ID", () => {
    const html = render("#/issues/BUG-9999/page");
    expect(html).toContain("<h3>BUG-9999 isn&#x27;t in this index</h3>");
    expect(html).toContain('<a href="#/issues">Back to all issues</a>');
  });

  it("S-017.2.3 leads j, k and Esc to the neighbours and the list", () => {
    expect(issuePageTargets(fixture().issues, "DEBT-0001")).toEqual({
      previous: "#/issues/BUG-0001/page",
      next: "#/issues/RISK-0001/page",
      back: "#/issues/DEBT-0001",
    });
  });

  it("S-017.2.4 stops j and k at either end of the list", () => {
    const issues = fixture().issues;
    expect(issuePageTargets(issues, "BUG-0001").previous).toBeNull();
    expect(issuePageTargets(issues, "BUG-0002").next).toBeNull();
  });

  it("S-017.2.5 lays out the header, Triage, description, Related work, History and the aside", () => {
    const html = render("#/issues/BUG-0001/page");
    const main = inside(html, "<article", "</article>");
    const marks = [
      'class="ip-head"',
      'aria-label="Triage"',
      'aria-label="Description"',
      'aria-label="Related work"',
      'aria-label="History"',
    ].map((m) => main.indexOf(m));
    expect(marks.every((at) => at >= 0)).toBe(true);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
    expect(html.split("</article>")[1]).toContain('<aside aria-label="Issue details"');
  });

  it("S-017.3.1 names the issue in the header", () => {
    expect(text(header(render("#/issues/BUG-0001/page")))).toBe(
      "Bug BUG-0001 Open High severity Found by you · Oct 14 · open 4 days Worker can double-send when SQLite returns SQLITE_BUSY after the request",
    );
  });

  it("S-017.3.2 reads differently for risks, sessions and closed issues", () => {
    const risk = render("#/issues/RISK-0001/page");
    expect(text(header(risk))).toContain("Likelihood medium · Impact high");
    expect(header(risk)).not.toContain("severity");
    expect(text(header(render("#/issues/DEBT-0001/page")))).toContain(
      "Found by SES-20261017-1430 · Oct 17 · open 1 day",
    );
    expect(text(header(render("#/issues/BUG-0002/page")))).toContain(
      "Found by you · Sep 12 · closed Sep 15",
    );
  });

  it("S-017.3.3 triages in place from the Triage card", () => {
    const card = triage(render("#/issues/BUG-0001/page"));
    const severity = select(card, "Severity");
    const status = select(card, "Status");
    expect(severity.selected).toBe("High");
    expect(severity.tag).not.toContain("disabled");
    expect(status.selected).toBe("Open");
    expect(status.tag).not.toContain("disabled");
    expect(text(card)).toContain("Changes write .azimuth/issues/BUG-0001-double-send-on-busy.md");
  });

  it("S-017.3.4 disables triage when the viewer can't act", () => {
    const card = triage(render("#/issues/BUG-0001/page", fixture(), "disconnected"));
    for (const label of ["Severity", "Status"]) {
      const { tag } = select(card, label);
      expect(tag).toContain('disabled=""');
      expect(tag).toContain('title="Disconnected from azimuth view."');
    }
  });

  it("S-017.3.5 renders the description as prose without its Status notes", () => {
    const index = fixture();
    const bug = issue(index, "BUG-0001");
    bug.body = `${bug.body}\n\n## Status notes\n- 2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers\n`;
    const desc = description(render("#/issues/BUG-0001/page", index));
    const headings = [...desc.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => text(m[1] ?? ""));
    expect(headings).toEqual(["Repro", "Expected", "Actual"]);
    expect(desc).not.toContain("Status notes");
    expect(desc).not.toContain("Reproduced with two workers");
  });

  it("S-017.3.6 says when an issue has no description", () => {
    const index = fixture();
    issue(index, "BUG-0001").body =
      "## Status notes\n- 2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers\n";
    expect(text(description(render("#/issues/BUG-0001/page", index)))).toBe("No description yet.");
  });
});
