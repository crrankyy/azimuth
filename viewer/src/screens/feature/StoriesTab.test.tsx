import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Scenario } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { IndexContext } from "../../data/IndexProvider";
import { ScenarioCard } from "./StoriesTab";

const NOW = Date.parse("2026-10-21T12:00:00Z");

function withIndex(children: ReactNode) {
  const value = {
    index: structuredClone(expectedIndex) as unknown as Index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return <IndexContext.Provider value={value}>{children}</IndexContext.Provider>;
}

const render = (then: string) => {
  const scenario: Scenario = {
    id: "S-001.1.1",
    title: "Finds the heading",
    kind: "happy",
    given: "the text # Hi",
    when: "it is parsed",
    then,
    coverage: { status: "untested", tests: [] },
  };
  return renderToStaticMarkup(withIndex(<ScenarioCard scenario={scenario} />));
};

const SETTLED_17 =
  '<span class="fd-ph settled" title="settled by test">17<span class="fd-ph-mark" aria-hidden="true">✓</span><span class="sr-only"> (settled by test)</span></span>';

describe("ST-008.11 the viewer marks settled and open values", () => {
  it("S-008.11.1 gives a settled value a mark and a title", () => {
    expect(render("the heading starts at byte {=17}")).toContain(
      `the heading starts at byte ${SETTLED_17}`,
    );
  });

  it("S-008.11.2 reads an open placeholder as to be settled", () => {
    const html = render("it ends at byte {?}");
    expect(html).toContain(
      'it ends at byte <span class="fd-ph open" title="to be settled by the first passing test">to be settled</span>',
    );
    expect(html).not.toContain("?}");
  });

  it("S-008.11.3 marks placeholders inside code spans", () => {
    expect(render("it returns `{ start: {=17} }`")).toContain(
      `<code class="az-c">{ start: ${SETTLED_17} }</code>`,
    );
  });

  it("S-008.11.4 renders text without placeholders as before", () => {
    const html = render("it returns `{ a: 1 }` and {x}");
    expect(html).toContain('it returns <code class="az-c">{ a: 1 }</code> and {x}');
    expect(html).not.toContain("fd-ph");
  });
});
