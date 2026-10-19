import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/core/build-index";
import { evaluateGate } from "../../src/core/gates";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const scenario = (id: string, kind: string, ...lines: string[]) =>
  [`### ${id} · Scenario ${id} {${kind}}`, "- **GIVEN** a", "- **WHEN** b", ...lines, ""].join(
    "\n",
  );

const story = (id: string, ...scenarios: string[]) =>
  [`## ${id} · Story ${id}`, "**Intent:** As a user, I want it so that it works.", "", ...scenarios]
    .join("\n")
    .concat("\n");

/** The done gate of F-001, in verifying with these stories. */
function doneChecks(stories: string) {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({
      id: "F-001",
      status: "verifying",
      stories: { "ST-001.1": ["happy", "negative"], "ST-001.2": ["happy", "edge"] },
    }),
    ".azimuth/features/F-001-thing/stories.md": stories,
  });
  cleanup = tree.cleanup;
  const { ctx, model } = analyzeProject(tree.root, new Date("2026-10-20T12:00:00Z"));
  const f = model.features.find((x) => x.id === "F-001");
  if (!f) throw new Error("F-001 is missing");
  return evaluateGate(ctx, f, "done")?.checks ?? [];
}

const placeholderCheck = (stories: string) =>
  doneChecks(stories).find((c) => c.id === "done.placeholders-settled");

describe("ST-008.9 the done gate waits for every placeholder", () => {
  it("S-008.9.1 fails and names the scenarios with an open placeholder", () => {
    const stories =
      story(
        "ST-001.1",
        scenario("S-001.1.1", "happy", "- **THEN** the heading starts at byte {?}"),
        scenario("S-001.1.2", "negative", "- **THEN** the heading ends at byte {=17}"),
      ) +
      "\n" +
      story(
        "ST-001.2",
        scenario("S-001.2.1", "happy", "- **THEN** it is found", "- **AND** it ends at {?}"),
        scenario("S-001.2.2", "edge", "- **THEN** c = 1"),
      );
    expect(placeholderCheck(stories)).toEqual({
      id: "done.placeholders-settled",
      rule: "Every placeholder value settled",
      ok: false,
      detail: "S-001.1.1, S-001.2.1",
    });
  });

  it("S-008.9.2 passes once every value is settled", () => {
    const stories = story(
      "ST-001.1",
      scenario("S-001.1.1", "happy", "- **THEN** the heading starts at byte {=17}"),
      scenario("S-001.1.2", "negative", "- **THEN** it spans bytes {=3..5}"),
    );
    expect(placeholderCheck(stories)).toEqual({
      id: "done.placeholders-settled",
      rule: "Every placeholder value settled",
      ok: true,
    });
  });

  it("S-008.9.3 sits after the scenarios check", () => {
    const stories = story(
      "ST-001.1",
      scenario("S-001.1.1", "happy", "- **THEN** c = 1"),
      scenario("S-001.1.2", "negative", "- **THEN** c = 2"),
    );
    expect(doneChecks(stories).map((c) => c.id)).toEqual([
      "done.verify-passed",
      "done.scenarios-passing",
      "done.placeholders-settled",
      "done.as-built",
      "done.architecture-reconciled",
    ]);
  });
});
