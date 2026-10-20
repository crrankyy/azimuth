import { afterEach, describe, expect, it } from "vitest";
import { derive } from "../../src/core/derive";
import { validate } from "../../src/core/validate";
import { featureFiles, loadTree, makeFacts, type TaskSpec } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

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

const COVERS_BOTH: TaskSpec = { id: "T-001.1", covers: ["S-001.1.1", "S-001.1.2"] };

function problemsOf(files: Record<string, string>) {
  const tree = loadTree(files);
  cleanup = tree.cleanup;
  const facts = makeFacts();
  return validate(tree.model, facts, derive(tree.model, facts));
}

/** F-001 at the status, with Fixture A as its stories.md and one task covering both scenarios. */
const fixtureA = (status: string) => ({
  ...featureFiles({ id: "F-001", status, tasks: [COVERS_BOTH] }),
  ".azimuth/features/F-001-thing/stories.md": FIXTURE_A,
});

/** F-001 at the status with a complete story, a covering task and the given tasks. */
const withTasks = (status: string, tasks: TaskSpec[]) =>
  featureFiles({ id: "F-001", status, tasks: [COVERS_BOTH, ...tasks] });

const noCovers = (id: string) => ({
  code: "W-NO-COVERS",
  severity: "warning",
  file: ".azimuth/features/F-001-thing/plan.md",
  line: null,
  ref: id,
  message: `${id} covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents.`,
});

describe("ST-023.1 the story rule for an idea with stories", () => {
  it("S-023.1.2 validate gives an idea only W-NO-NEGATIVE", () => {
    const problems = problemsOf({
      ...featureFiles({
        id: "F-072",
        status: "idea",
        stories: { "ST-072.1": ["happy"] },
        tasks: [{ id: "T-072.1", covers: [] }],
        impact: [{ path: "lib/x.ts", change: "create" }],
      }),
      ".azimuth/project/architecture.md": "---\nmodules:\n  - name: app\n    path: src\n---\n",
    });
    expect(problems).toEqual([
      {
        code: "W-NO-NEGATIVE",
        severity: "warning",
        file: ".azimuth/features/F-072-thing/stories.md",
        line: 1,
        ref: "ST-072.1",
        message: "ST-072.1 needs at least one happy and one negative or edge scenario.",
      },
    ]);
    const codes = problems.map((p) => p.code);
    for (const code of ["W-UNCOVERED-SCENARIO", "E-UNCOVERED-SCENARIO", "W-PATH", "W-NO-COVERS"]) {
      expect(codes).not.toContain(code);
    }
  });

  it("S-023.1.3 validate gives an idea with complete or no stories nothing", () => {
    const problems = problemsOf({
      ...featureFiles({
        id: "F-072",
        status: "idea",
        stories: { "ST-072.1": ["happy", "negative"] },
      }),
      ...featureFiles({ id: "F-073", status: "idea", ideaOnly: true }),
    });
    expect(problems).toEqual([]);
  });
});

describe("ST-023.2 W-MEASURED in a draft", () => {
  it("S-023.2.4 validate gives a draft one W-MEASURED per matching THEN or AND line", () => {
    const problems = problemsOf(fixtureA("draft"));
    const hint = (line: number, value: string) => ({
      code: "W-MEASURED",
      severity: "warning",
      file: ".azimuth/features/F-001-thing/stories.md",
      line,
      ref: "S-001.1.1",
      message: `"${value}" looks like a value only the code can measure. If it is, write {?} instead: the first passing test settles it.`,
    });
    expect(problems.filter((p) => p.code === "W-MEASURED")).toEqual([
      hint(8, "9..12"),
      hint(9, "caret: 24"),
    ]);
    expect(problems.filter((p) => p.line === 6 || p.line === 15)).toEqual([]);
  });

  it("S-023.2.5 validate gives no W-MEASURED to an idea, an approved or an in-progress feature", () => {
    for (const status of ["idea", "approved", "in-progress"]) {
      const codes = problemsOf(fixtureA(status)).map((p) => p.code);
      cleanup?.();
      expect(codes, status).not.toContain("W-MEASURED");
    }
  });
});

describe("ST-023.3 W-NO-COVERS in a draft", () => {
  it("S-023.3.1 validate hints at a draft task without covers", () => {
    const problems = problemsOf(withTasks("draft", [{ id: "T-001.2", covers: [] }]));
    expect(problems).toEqual([noCovers("T-001.2")]);
  });

  it("S-023.3.2 validate gives no W-NO-COVERS to an idea, an approved or an in-progress feature", () => {
    for (const status of ["idea", "approved", "in-progress"]) {
      const codes = problemsOf(withTasks(status, [{ id: "T-001.2", covers: [] }])).map(
        (p) => p.code,
      );
      cleanup?.();
      expect(codes, status).not.toContain("W-NO-COVERS");
    }
  });

  it("S-023.3.4 validate spares a draft task whose files are all Markdown", () => {
    const problems = problemsOf(
      withTasks("draft", [
        { id: "T-001.2", covers: [], files: ["docs/guide.md", "plugin/skills/spec/SKILL.md"] },
        { id: "T-001.3", covers: [], files: ["docs/cli.md", "src/core/init.ts"] },
      ]),
    );
    expect(problems).toEqual([noCovers("T-001.3")]);
  });
});
