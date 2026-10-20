import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Scenario, ScenarioTest } from "../../../src/core/types";
import { ScenarioRow } from "./Verification";

const NOW = Date.parse("2026-10-21T12:00:00Z");

const COMMITTED_TEST: ScenarioTest = {
  file: "test/a.test.ts",
  name: "S-001.1.1 works",
  status: "passing",
  confidence: "marker",
  committed: true,
};
const UNCOMMITTED_TEST: ScenarioTest = {
  file: "test/b.test.ts",
  name: "S-001.1.1 also works",
  status: "passing",
  confidence: "marker",
  committed: false,
};

/** The coverage table's row for a passing S-001.1.1 with these tests. */
const renderRow = (tests: ScenarioTest[]) => {
  const scenario: Scenario = {
    id: "S-001.1.1",
    title: "Finds the heading",
    kind: "happy",
    given: "the text # Hi",
    when: "it is parsed",
    then: "it finds the heading",
    coverage: { status: "passing", tests },
  };
  return renderToStaticMarkup(<ScenarioRow scenario={scenario} now={NOW} onRun={() => {}} />);
};

/** The Test column's cell with this title and content. */
const testCell = (title: string, content: string) =>
  `<span role="cell" class="vf-cell mono vf-test" title="${title}">${content}</span>`;

describe("ST-020.5 the coverage table tags an uncommitted test", () => {
  it("S-020.5.3 ends the test cell with the tag and marks the test in its title", () => {
    const html = renderRow([COMMITTED_TEST, UNCOMMITTED_TEST]);
    expect(html).toContain(
      testCell(
        "test/a.test.ts › S-001.1.1 works\ntest/b.test.ts › S-001.1.1 also works (uncommitted)",
        '<span class="vf-test-name">a.test.ts +1</span><span class="az-tag vf-uncommitted" title="Not committed: the done gate counts only tests in HEAD">uncommitted</span>',
      ),
    );
  });

  it("S-020.5.4 renders a test cell of committed tests without a tag", () => {
    const html = renderRow([COMMITTED_TEST]);
    expect(html).toContain(
      testCell("test/a.test.ts › S-001.1.1 works", '<span class="vf-test-name">a.test.ts</span>'),
    );
    expect(html).not.toContain("uncommitted");
  });
});
