import { describe, expect, it } from "vitest";
import { parseStories } from "../../src/core/parse/stories";
import {
  openPlaceholderScenarios,
  placeholderParts,
  settleText,
} from "../../src/core/placeholders";
import { specHash } from "../../src/core/spec-hash";

const FILE = ".azimuth/features/F-001-thing/stories.md";

const scenario = (id: string, kind: string, then: string, ...more: string[]) =>
  [
    `### ${id} · Scenario ${id} {${kind}}`,
    "- **GIVEN** the text `# Hi`",
    "- **WHEN** it is parsed",
    `- **THEN** ${then}`,
    ...more,
    "",
  ].join("\n");

const story = (id: string, ...scenarios: string[]) =>
  [`## ${id} · Story ${id}`, "**Intent:** As a reader, I want headings found.", "", ...scenarios]
    .join("\n")
    .concat("\n");

/** S-001.1.1 with an open THEN and AND, S-001.1.2 with an open THEN. */
const TWO_OPEN = story(
  "ST-001.1",
  scenario("S-001.1.1", "happy", "the heading starts at byte {?}", "- **AND** it ends at byte {?}"),
  scenario("S-001.1.2", "negative", "the heading ends at byte {?}"),
);

describe("ST-008.5 placeholders in scenarios", () => {
  it("S-008.5.1 lets a placeholder THEN through without a warning", () => {
    const text = story(
      "ST-001.1",
      [
        "### S-001.1.1 · Finds the heading {happy}",
        "- **GIVEN** the text # Hi",
        "- **WHEN** it is parsed",
        "- **THEN** the heading starts at byte {?}",
        "",
      ].join("\n"),
    );
    const { stories, problems } = parseStories(text, FILE, "F-001");
    expect(problems).toEqual([]);
    expect(stories[0]?.scenarios[0]?.then).toBe("the heading starts at byte {?}");
  });

  it("S-008.5.2 lists the scenarios with an open placeholder in file order", () => {
    const text =
      story(
        "ST-001.1",
        scenario("S-001.1.1", "happy", "the heading starts at byte {?}"),
        scenario("S-001.1.2", "negative", "the heading starts at byte {=17}"),
      ) +
      "\n" +
      story(
        "ST-001.2",
        scenario("S-001.2.1", "happy", "it is found", "- **AND** it ends at byte {?}"),
      );
    expect(openPlaceholderScenarios(text)).toEqual(["S-001.1.1", "S-001.2.1"]);
  });

  it("S-008.5.3 ignores a placeholder in a fenced block", () => {
    const text = story(
      "ST-001.1",
      scenario("S-001.1.1", "happy", "the heading starts at byte 2", "```", "{?}", "```"),
    );
    expect(openPlaceholderScenarios(text)).toEqual([]);
  });

  it("S-008.5.4 splits text into plain text, settled values and open placeholders", () => {
    expect(placeholderParts("starts at {=17}, ends at {?}")).toEqual([
      { kind: "text", text: "starts at " },
      { kind: "settled", value: "17" },
      { kind: "text", text: ", ends at " },
      { kind: "open" },
    ]);
  });

  it("S-008.5.5 keeps other braces as text", () => {
    const text = "returns { a: 1 }, {x}, {=} and {=a{b}";
    expect(placeholderParts(text)).toEqual([{ kind: "text", text }]);
  });
});

describe("ST-008.6 settling replaces one placeholder", () => {
  it("S-008.6.1 settles the scenario's first open placeholder", () => {
    const result = settleText(TWO_OPEN, "S-001.1.1", " 17 ");
    expect(result).toEqual({
      ok: true,
      left: 1,
      text: TWO_OPEN.replace(
        "- **THEN** the heading starts at byte {?}",
        "- **THEN** the heading starts at byte {=17}",
      ),
    });
  });

  it("S-008.6.2 keeps CRLF line endings", () => {
    const crlf = TWO_OPEN.replace(/\n/g, "\r\n");
    const result = settleText(crlf, "S-001.1.1", "17");
    expect(result.ok && result.text).toBe(crlf.replace("{?}", "{=17}"));
    expect(result.ok && result.text.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
  });

  it("S-008.6.3 refuses a scenario with no placeholder left", () => {
    const text = story(
      "ST-001.1",
      scenario("S-001.1.1", "happy", "the heading starts at byte {=17}"),
      scenario("S-001.1.2", "negative", "the heading ends at byte {?}"),
    );
    expect(settleText(text, "S-001.1.1", "18")).toEqual({ ok: false, reason: "no-placeholder" });
  });

  it("S-008.6.4 refuses an unknown scenario", () => {
    expect(settleText(TWO_OPEN, "S-001.1.9", "17")).toEqual({ ok: false, reason: "no-scenario" });
  });

  it("S-008.6.5 refuses a value that can't be written", () => {
    for (const value of ["", "  ", "a}b", "a{b", "a\nb"]) {
      expect(settleText(TWO_OPEN, "S-001.1.1", value)).toEqual({
        ok: false,
        reason: "bad-value",
      });
    }
  });
});

describe("ST-008.8 settling never changes the spec hash", () => {
  const parts = (stories: string, featureBody = "# F-001: Thing") => ({
    featureBody,
    impact: "",
    stories,
    contract: "",
  });

  it("S-008.8.1 hashes a spec without placeholders as before", () => {
    expect(specHash(parts("- **THEN** the heading starts at byte 2"))).toBe(
      "sha256:2e83d331006685ad63a4722db1efadad5b7aabc05d45310978dcabf6f81144d8",
    );
  });

  it("S-008.8.2 hashes open and settled values the same", () => {
    const hash = "sha256:3baf12d6f9859469eb98f904a0b41062042a98d091e4bfdd56065e3cd4a0dc9e";
    expect(specHash(parts("- **THEN** the heading starts at byte {?}"))).toBe(hash);
    expect(specHash(parts("- **THEN** the heading starts at byte {=17}"))).toBe(hash);
  });

  it("S-008.8.3 still changes the hash for other story edits", () => {
    const hash = specHash(parts("- **THEN** the heading ends at byte {=17}"));
    expect(hash).toBe("sha256:cb99dbcda60bb011c0c9ba28a15a82412644218d64ca7510ad1f41592bd49a67");
    expect(hash).not.toBe(specHash(parts("- **THEN** the heading starts at byte {=17}")));
  });

  it("S-008.8.4 hashes placeholders outside stories.md as written", () => {
    expect(specHash(parts("", "# F-001: Thing {?}"))).toBe(
      "sha256:d494e36babaaa75cb5cc626c1f49a831e828e088c484be0f0749ed70918c1925",
    );
    expect(specHash(parts("", "# F-001: Thing {=17}"))).toBe(
      "sha256:8d1e97734010805a125333174976e4cf4f04afda20ca4185d6d349a4c6aa73c3",
    );
  });
});
