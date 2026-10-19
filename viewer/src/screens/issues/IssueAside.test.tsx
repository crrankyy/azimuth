import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Issue } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { IssueAside } from "./IssueAside";
import { plannedChanges, plannedChangesLabel } from "./model";

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

const issue = (index: Index, id: string): Issue => index.issues.find((i) => i.id === id)!;

const render = (index: Index, id: string) =>
  renderToStaticMarkup(<IssueAside index={index} issue={issue(index, id)} />);

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The markup of the aside group headed by `title`, up to the next group. */
const group = (html: string, title: string) =>
  html.split(`>${title}</div>`)[1]?.split("</section>")[0] ?? "";

/** The facts card as [label, value] pairs. */
const facts = (html: string) =>
  [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(([, dt, dd]) => [
    text(dt ?? ""),
    text(dd ?? ""),
  ]);

const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([, inner]) => text(inner ?? ""));

describe("F-017 the issue page's aside", () => {
  it("S-017.5.1 lists the issue's facts", () => {
    const index = fixture();
    const bug = render(index, "BUG-0001");
    expect(bug).toContain('<aside aria-label="Issue details"');
    expect(facts(bug)).toEqual([
      ["Type", "Bug"],
      ["Severity", "High"],
      ["Status", "Open"],
      ["Found by", "You"],
      ["Created", "Oct 14, 2026"],
      ["Resolved", "—"],
    ]);
    expect(facts(render(index, "RISK-0001"))).toEqual([
      ["Type", "Risk"],
      ["Likelihood", "Medium"],
      ["Impact", "High"],
      ["Status", "Open"],
      ["Found by", "You"],
      ["Created", "Oct 15, 2026"],
      ["Resolved", "—"],
    ]);
  });

  it("S-017.5.2 shows linked features as cards", () => {
    const cards = [
      ...group(render(fixture(), "BUG-0001"), "Linked features").matchAll(
        /<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g,
      ),
    ].map(([, href, inner]) => ({ href, text: text(inner ?? "") }));
    expect(cards).toEqual([
      {
        href: "#/features/F-003",
        text: "F-003 Delivery worker Done Tasks 7/7 · 9/9 scenarios passing",
      },
      {
        href: "#/features/F-005",
        text: "F-005 Retry with exponential backoff In progress Tasks 3/6 · 4/8 scenarios passing",
      },
    ]);
  });

  it("S-017.5.3 flags the changes planned for the issue's files", () => {
    const index = fixture();
    expect(plannedChanges(index, "src/worker/deliver.ts")).toEqual([
      { feature: "F-005", change: "modify" },
      { feature: "F-007", change: null },
    ]);
    const files = group(render(index, "BUG-0001"), "Files");
    expect(files).toContain(">src/worker/deliver.ts<");
    expect(buttons(files)).toEqual(["Copy path"]);
    expect(text(files)).toContain("Planned changes: F-005 (modify) and F-007");
  });

  it("S-017.5.4 has no flag for a file nobody plans to change", () => {
    const index = fixture();
    expect(plannedChangesLabel(plannedChanges(index, "src/api/endpoints.ts"))).toBeNull();
    const files = group(render(index, "BUG-0002"), "Files");
    expect(files).toContain(">src/api/endpoints.ts<");
    expect(buttons(files)).toEqual(["Copy path"]);
    expect(files).not.toContain("Planned changes");
  });

  it("S-017.5.5 opens the source file in your editor", () => {
    const index = fixture();
    index.project.editor_url = "vscode://file/{abs}:{line}";
    index.project.root = "/work/hookline";
    const source = group(render(index, "BUG-0001"), "Source");
    expect(source).toContain(">.azimuth/issues/BUG-0001-double-send-on-busy.md<");
    expect(source).toMatch(
      /<a [^>]*href="vscode:\/\/file\/\/work\/hookline\/\.azimuth\/issues\/BUG-0001-double-send-on-busy\.md:1"[^>]*>Open in editor<\/a>/,
    );
    expect(buttons(source)).toEqual(["Copy ID"]);
    expect(source).toContain('<a class="lc-btn lc-btn-secondary" href="vscode:');
    expect(source).toContain('class="lc-btn lc-btn-tertiary">Copy ID</button>');
  });

  it("S-017.5.6 has no editor link without a root", () => {
    const index = fixture();
    index.project.editor_url = "vscode://file/{abs}:{line}";
    index.project.root = null;
    const source = group(render(index, "BUG-0001"), "Source");
    expect(source).not.toContain("Open in editor");
    expect(buttons(source)).toEqual(["Copy ID"]);
  });
});
