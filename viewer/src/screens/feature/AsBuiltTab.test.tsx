import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AsBuilt, Feature, Index } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { IndexContext } from "../../data/IndexProvider";
import { AsBuiltTab } from "./AsBuiltTab";
import { asBuiltOpen } from "./featureData";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const NOTES = "### T-001.1 · 2026-10-20\n\nCounts the BOM.";

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

function withIndex(children: ReactNode) {
  const value = {
    index: fixture(),
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return <IndexContext.Provider value={value}>{children}</IndexContext.Provider>;
}

/** F-001, built from the fixture's F-005 (the feature with a detail), with this as-built and notes. */
function feature(asBuilt: AsBuilt | null, notes: string | null): Feature {
  const f = fixture().features.find((x) => x.id === "F-005");
  if (!f?.detail) throw new Error("The fixture's F-005 has no detail");
  return { ...f, id: "F-001", detail: { ...f.detail, as_built: asBuilt, notes } };
}

const AS_BUILT: AsBuilt = {
  completed_at: "2026-10-21",
  files_changed: [{ path: "src/a.ts", change: "modify" }],
  deviations: [],
  follow_ups: [],
  body: "",
};

const render = (f: Feature) => renderToStaticMarkup(withIndex(<AsBuiltTab f={f} />));

/** Whether `parts` appear in `html` in this order. */
function inOrder(html: string, parts: string[]): boolean {
  let at = 0;
  for (const part of parts) {
    const found = html.indexOf(part, at);
    if (found === -1) return false;
    at = found + part.length;
  }
  return true;
}

describe("ST-008.4 notes in the As-built tab", () => {
  it("S-008.4.1 shows notes before close-out", () => {
    const html = render(feature(null, NOTES));
    expect(
      inOrder(html, [
        "As-built is written at close-out, once F-001 reaches verifying.",
        '<h2 class="fd-sec-title">Notes</h2>',
        "<p>Counts the BOM.</p>",
      ]),
    ).toBe(true);
    expect(html).not.toContain("Not written yet");
  });

  it("S-008.4.2 shows notes after the as-built sections", () => {
    const html = render(feature(AS_BUILT, NOTES));
    expect(
      inOrder(html, [
        "Completed",
        ">Files changed</h2>",
        '<h2 class="fd-sec-title">Notes</h2>',
        "<p>Counts the BOM.</p>",
      ]),
    ).toBe(true);
  });

  it("S-008.4.3 leaves the tab unchanged without notes", () => {
    const html = render(feature(null, null));
    expect(html).toContain("Not written yet");
    expect(html).not.toContain(">Notes</h2>");
  });

  it("S-008.4.4 opens the tab once there are notes", () => {
    expect([
      asBuiltOpen(feature(null, NOTES)),
      asBuiltOpen(feature(AS_BUILT, null)),
      asBuiltOpen(feature(null, null)),
    ]).toEqual([true, true, false]);
  });
});
