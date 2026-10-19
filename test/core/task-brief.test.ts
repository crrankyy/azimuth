import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { loadProject } from "../../src/core/model";
import { taskBrief } from "../../src/core/task-brief";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const DIR = ".azimuth/features/F-001-thing/";

const FEATURE = [
  "---",
  "id: F-001",
  "title: Parse headings",
  "status: in-progress",
  "size: M",
  "created: 2026-10-01",
  "---",
  "## Objective",
  "Find headings.",
  "",
  "## Invariants",
  "- The parser never allocates per character.",
  "",
].join("\n");

const STORIES = [
  "# F-001: Stories",
  "",
  "## ST-001.1 · Headings",
  "**Intent:** As a reader, I want headings found, so that the outline works.",
  "",
  "### S-001.1.1 · Finds an ATX heading {happy}",
  "- **GIVEN** the text `# Hi`",
  "- **WHEN** it is parsed",
  "- **THEN** one heading of level 1 is returned",
  "- **AND** its text is `Hi`",
  "",
  "### S-001.1.2 · Ignores a hash without a space {negative}",
  "- **GIVEN** the text `#Hi`",
  "- **WHEN** it is parsed",
  "- **THEN** no heading is returned",
  "",
  "### S-001.1.3 · Stops at level 6 {edge}",
  "- **GIVEN** the text `####### Hi`",
  "- **WHEN** it is parsed",
  "- **THEN** no heading is returned",
  "",
].join("\n");

const CONTRACT = [
  "---",
  "language: typescript",
  "---",
  "# F-001: Contract",
  "",
  "## Public signatures",
  "",
  "```ts",
  "export function headings(text: string): Heading[];",
  "```",
  "",
  "## Config",
  "",
  "```yaml",
  "# headings.yaml",
  "max_level: 6",
  "```",
  "",
].join("\n");

const PLAN = [
  "---",
  "tasks:",
  "  - id: T-001.1",
  "    title: Heading type",
  "    status: done",
  "    after: []",
  "    covers: [S-001.1.3]",
  "    files: [src/heading.ts]",
  "    verify: pnpm typecheck",
  "    note: null",
  "  - id: T-001.2",
  "    title: Heading recognizer (red → green)",
  "    status: in-progress",
  "    after: [T-001.1]",
  "    covers: [S-001.1.1, S-001.1.2]",
  "    files: [src/headings.ts, test/headings.test.ts]",
  "    verify: pnpm exec vitest run test/headings.test.ts --reporter=verbose",
  "    note: null",
  "---",
  "",
].join("\n");

const NOTES = "# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nHeading levels are 1-based.\n";

const OPEN_RULE =
  "- `{?}` marks a value the spec leaves to the first passing test: make the test assert the value the code produces, and report it as `<scenario ID>: <value>`.";

/** The brief of contract.md's "Brief example", without a trailing newline. */
const EXAMPLE_BRIEF = [
  "# T-001.2 · Heading recognizer (red → green)",
  "",
  "Feature: F-001 · Parse headings",
  "After: T-001.1 (done)",
  "",
  "## Scenarios",
  "",
  "### S-001.1.1 · Finds an ATX heading {happy}",
  "- **GIVEN** the text `# Hi`",
  "- **WHEN** it is parsed",
  "- **THEN** one heading of level 1 is returned",
  "- **AND** its text is `Hi`",
  "",
  "### S-001.1.2 · Ignores a hash without a space {negative}",
  "- **GIVEN** the text `#Hi`",
  "- **WHEN** it is parsed",
  "- **THEN** no heading is returned",
  "",
  "## Contract",
  "",
  "### Public signatures",
  "",
  "```ts",
  "export function headings(text: string): Heading[];",
  "```",
  "",
  "### Config",
  "",
  "```yaml",
  "# headings.yaml",
  "max_level: 6",
  "```",
  "",
  "## Invariants",
  "",
  "- The parser never allocates per character.",
  "",
  "## Files you may change",
  "",
  "- src/headings.ts",
  "- test/headings.test.ts",
  "",
  "## Verify",
  "",
  "```sh",
  "pnpm exec vitest run test/headings.test.ts --reporter=verbose",
  "```",
  "",
  "## Notes from earlier tasks",
  "",
  "### T-001.1 · 2026-10-20",
  "",
  "Heading levels are 1-based.",
  "",
  "## Rules",
  "",
  '- Start each test name with the scenario it covers: `it("S-001.1.1 <what it checks>", …)`.',
  "- Give every test a name that no other test in the project has.",
  "- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.",
  '- Change only the files under "Files you may change".',
  "- Never run git or azimuth, and never edit anything under .azimuth/.",
  "- When you are done, report the files you changed and the verify command's result.",
].join("\n");

/**
 * The example project of contract.md ("Brief example"). It adds an impact.md, which the example
 * leaves out: without one the model has no spec, and so no stories or contract text.
 */
function exampleFiles(
  options: { languages?: string; stories?: string } = {},
): Record<string, string> {
  return {
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}stack:\n  languages: ${options.languages ?? "[typescript]"}\n`,
    [`${DIR}feature.md`]: FEATURE,
    [`${DIR}impact.md`]: "---\nfiles: []\n---\n",
    [`${DIR}stories.md`]: options.stories ?? STORIES,
    [`${DIR}contract.md`]: CONTRACT,
    [`${DIR}plan.md`]: PLAN,
    [`${DIR}notes.md`]: NOTES,
  };
}

function load(files: Record<string, string>) {
  const tree = writeTree(files);
  cleanup = tree.cleanup;
  return loadProject(tree.root);
}

const lines = (text: string) => text.split("\n");

describe("ST-009.7 taskBrief", () => {
  it("S-009.7.1 builds the full brief of the example", () => {
    expect(taskBrief(load(exampleFiles()), "T-001.2")).toBe(EXAMPLE_BRIEF);
  });

  it("S-009.7.2 prints settled values and keeps open placeholders, with the open-value rule", () => {
    const stories = STORIES.replace(
      "- **THEN** one heading of level 1 is returned\n",
      "- **THEN** one heading starts at byte {?}\n- **AND** it ends at byte {=4}\n",
    );
    const brief = taskBrief(load(exampleFiles({ stories })), "T-001.2");
    expect(lines(brief)).toContain("- **THEN** one heading starts at byte {?}");
    expect(lines(brief)).toContain("- **AND** it ends at byte 4");
    expect(lines(brief).at(-1)).toBe(OPEN_RULE);
  });

  it("S-009.7.3 leaves out the parts with nothing to show", () => {
    const model = load({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      [`${DIR}feature.md`]: FEATURE.replace(
        "## Invariants\n- The parser never allocates per character.\n",
        "",
      ),
      [`${DIR}impact.md`]: "---\nfiles: []\n---\n",
      [`${DIR}stories.md`]: STORIES,
      [`${DIR}contract.md`]: "---\nlanguage: typescript\n---\n# F-001: Contract\n",
      [`${DIR}plan.md`]: [
        "---",
        "tasks:",
        "  - id: T-001.1",
        "    title: Heading type",
        "    status: in-progress",
        "    covers: [S-001.9.9]",
        "    verify: echo ok",
        "---",
        "",
      ].join("\n"),
    });
    const brief = taskBrief(model, "T-001.1");
    expect(brief).not.toContain("After:");
    for (const heading of ["## Contract", "## Invariants", "## Notes from earlier tasks"]) {
      expect(lines(brief)).not.toContain(heading);
    }
    expect(brief).toContain("## Scenarios\n\n### S-001.9.9\nNot in stories.md.\n\n");
    expect(brief).toContain("## Files you may change\n\nNone listed.\n\n");
    expect(brief.split("## Rules\n\n")[1]?.split("\n")[0]).toBe(
      "- Put a `// scenario: S-001.9.9` comment on the line above each test.",
    );
  });

  it("S-009.7.4 follows the project's languages in the test-name rules", () => {
    const brief = taskBrief(load(exampleFiles({ languages: "[python, rust]" })), "T-001.2");
    expect(brief.split("## Rules\n\n")[1]?.split("\n").slice(0, 2)).toEqual([
      '- Mark each test with the scenario it covers: `@pytest.mark.scenario("S-001.1.1")`.',
      "- Put a `// scenario: S-001.1.1` comment on the line above each test.",
    ]);
  });

  it("S-009.7.5 throws not-found for an unknown task or feature", () => {
    const model = load(exampleFiles());
    const failure = (taskId: string) => {
      try {
        taskBrief(model, taskId);
      } catch (e) {
        return e;
      }
      return null;
    };
    const unknownTask = failure("T-001.9");
    const unknownFeature = failure("T-009.1");
    expect(unknownTask).toBeInstanceOf(AzimuthError);
    expect(unknownTask).toMatchObject({
      code: "not-found",
      message: "T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.",
    });
    expect(unknownFeature).toBeInstanceOf(AzimuthError);
    expect(unknownFeature).toMatchObject({ code: "not-found", message: "F-009 does not exist." });
  });
});
