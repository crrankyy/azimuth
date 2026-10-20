import { afterEach, describe, expect, it } from "vitest";
import { derive } from "../../src/core/derive";
import { nextGate } from "../../src/core/gates";
import { specHash } from "../../src/core/spec-hash";
import type { Problem } from "../../src/core/types";
import { HINT_CODES, isHint, sortProblems, validate } from "../../src/core/validate";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";
import { MINIMAL_CONFIG } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const STRICT = `${MINIMAL_CONFIG}autonomy:\n  strict: true\n`;

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

/**
 * The gate to `approved` for the draft F-001 of S-023.4.1 with the given stories.md, and the
 * feature's warnings as approveGate selects them: its file is in the feature's folder, or its ref
 * is the feature or one of its stories, scenarios or tasks.
 */
function strictApproval(stories: string) {
  const tree = loadTree(
    {
      ...featureFiles({
        id: "F-001",
        status: "draft",
        tasks: [
          { id: "T-001.1", covers: ["S-001.1.1", "S-001.1.2"] },
          { id: "T-001.2", covers: [] },
        ],
      }),
      ".azimuth/features/F-001-thing/stories.md": stories,
    },
    STRICT,
  );
  cleanup = tree.cleanup;
  const model = tree.model;
  const f = model.features[0]!;
  const facts = makeFacts({
    git: { available: true, headSpecHash: new Map([["F-001", f.spec ? specHash(f.spec) : null]]) },
  });
  const derived = derive(model, facts);
  const problems = sortProblems([...model.problems, ...validate(model, facts, derived)]);
  const ofFeature = (p: Problem) =>
    p.file.startsWith(f.dir) || p.ref === f.id || /^(ST|S|T)-001\./.test(p.ref ?? "");
  return {
    gate: nextGate({ model, facts, derived, problems }, f),
    warnings: problems.filter((p) => p.severity === "warning" && ofFeature(p)),
  };
}

describe("ST-023.4 hints and strict approval", () => {
  it("S-023.4.1 strict approval passes a draft whose only warnings are hints", () => {
    const { gate, warnings } = strictApproval(FIXTURE_A);
    expect(warnings.map((p) => `${p.code} ${p.ref} ${p.line}`).sort()).toEqual([
      "W-MEASURED S-001.1.1 8",
      "W-MEASURED S-001.1.1 9",
      "W-NO-COVERS T-001.2 null",
    ]);
    expect(gate?.to).toBe("approved");
    expect(gate?.checks.filter((c) => !c.ok)).toEqual([]);
    expect(gate?.checks.at(-1)).toEqual({
      id: "approve.no-warnings",
      rule: "No warnings in this feature",
      ok: true,
    });
  });

  it("S-023.4.2 strict approval still counts a warning that isn't a hint", () => {
    const lines = FIXTURE_A.split("\n");
    lines[14] = "- **THEN** it works correctly";
    const { gate } = strictApproval(lines.join("\n"));
    expect(gate?.checks.filter((c) => !c.ok)).toEqual([
      {
        id: "approve.no-warnings",
        rule: "No warnings in this feature",
        ok: false,
        detail: "1 warning",
      },
    ]);
  });

  it("S-023.4.3 HINT_CODES lists the two hint codes and isHint reads it", () => {
    const codes = ["W-MEASURED", "W-NO-COVERS", "W-NO-NEGATIVE", "W-VAGUE", "W-MILESTONE-READY"];
    expect(HINT_CODES).toEqual(["W-MEASURED", "W-NO-COVERS"]);
    expect(codes.map((code) => isHint({ code }))).toEqual([true, true, false, false, false]);
  });
});
