import { describe, expect, it } from "vitest";
import { measuredValue, parseStories } from "../../src/core/parse/stories";

/** Fixture A of F-023's stories.md: line 1 is the story heading. */
const FIXTURE_A = [
  "## ST-001.1 · Spans",
  "**Intent:** As an editor, I want bold spans found so that they render bold.",
  "",
  "### S-001.1.1 · A bold span {happy}",
  "- **GIVEN** the text `a **b**`",
  "- **AND** the caret at offset 3",
  "- **WHEN** it is parsed",
  "- **THEN** the bold token spans range `9..12`",
  "- **AND** the view reports caret: 24",
  "- **AND** the error list is empty",
  "",
  "### S-001.1.2 · Plain text {edge}",
  "- **GIVEN** the text `ab`",
  "- **WHEN** it is parsed",
  "- **THEN** the output is byte-for-byte equal to the input",
  "",
].join("\n");

describe("ST-023.2 a draft's THEN hints at a measured value", () => {
  it("S-023.2.1 measuredValue returns the decided examples as written", () => {
    const lines = [
      "the bold token spans range `9..12`",
      "the parse error is `Unclosed { offset: Some(63) }`",
      "the view reports caret: 24",
      "the span `byte_range: 34..39` is highlighted",
      "lines `2..=5` are folded",
      "the cursor has position = 7",
    ];
    expect(lines.map(measuredValue)).toEqual([
      "9..12",
      "offset: Some(63)",
      "caret: 24",
      "byte_range: 34..39",
      "2..=5",
      "position = 7",
    ]);
  });

  it("S-023.2.2 measuredValue skips placeholders, byte-for-byte, function names and versions", () => {
    const lines = [
      "the output is byte-for-byte equal to the input",
      "the bold token spans range `{=9..12}`",
      "the parse error has `offset: {?}`",
      "it ends at byte {=30}",
      "the call `byte_to_char(5)` returns 2",
      "version `0.3.0` passes S-023.1.1",
    ];
    expect(lines.map(measuredValue)).toEqual([null, null, null, null, null, null]);
  });

  it("S-023.2.3 parseStories lists the THEN line and the AND lines after it", () => {
    const { stories } = parseStories(FIXTURE_A, "stories.md", "F-001");
    const [first, second] = stories[0]?.scenarios ?? [];
    expect(first?.thenLines).toEqual([
      { text: "the bold token spans range `9..12`", line: 8 },
      { text: "the view reports caret: 24", line: 9 },
      { text: "the error list is empty", line: 10 },
    ]);
    expect(second?.thenLines).toEqual([
      { text: "the output is byte-for-byte equal to the input", line: 15 },
    ]);
    expect(first?.then).toBe(
      "the bold token spans range `9..12` and the view reports caret: 24 and the error list is empty",
    );
  });
});
