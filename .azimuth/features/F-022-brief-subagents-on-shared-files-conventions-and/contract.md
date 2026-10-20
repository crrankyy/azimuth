---
language: typescript
---
# F-022: Contract

## Data structures

None new. `taskBrief` reads `Model.config.parallel.shared_files` (`string[]`, globs) and
`Model.knowledge.conventions` (`KnowledgeDoc`: `file`, `updated`, `body`).

## Public signatures

```ts
// src/core/init.ts

/**
 * conventions.md as `azimuth init` writes it after the frontmatter: the `# Conventions` title,
 * the sections Error handling, Testing, Naming, Logging, Dependencies and Commits, and the two
 * default lines under Testing and Commits, ending in a newline. projectDocs writes
 * `---\nupdated: <date>\n---\n` followed by it: the same bytes as before.
 */
export const CONVENTIONS_TEMPLATE: string;

// src/core/task-brief.ts: signature and errors unchanged (F-009)

/**
 * The prompt for a subagent building one task, in Markdown, built from the model only (no git,
 * no clock): the same model gives the same text. No trailing newline.
 * Throws AzimuthError("invalid", …) for an ID that isn't a task ID, and
 * AzimuthError("not-found", …) for an unknown feature or task.
 */
export function taskBrief(model: Model, taskId: string): string;

// src/core/task-brief.ts: module-private helpers (not exported)

/**
 * Every heading line (`#` to `#####`, then a space) outside fenced code one `#` deeper, so the
 * text nests under a `## ` section of the brief. contractText applies it after removing the
 * frontmatter and the title, as before.
 */
function nestHeadings(text: string): string;

/**
 * One rule per path of `files` that matches a glob of `sharedFiles` (globToRegExp, matchesAny;
 * paths as written), in `files` order, each path once; then SHARED_RULES. [] when none matches.
 */
function sharedFileRules(files: string[], sharedFiles: string[]): string[];

/**
 * The Conventions section's body: null when `doc.body` is "" or equals the template (see
 * isConventionsTemplate); the pointer line when the body has more than CONVENTIONS_MAX_WORDS
 * whitespace-separated words; else nestHeadings(doc.body).
 */
function conventionsBody(doc: KnowledgeDoc): string | null;

/**
 * Whether `body` is stripTitle(CONVENTIONS_TEMPLATE) once both lose trailing whitespace on each
 * line and their blank lines.
 */
function isConventionsTemplate(body: string): boolean;

/** CLOSING_RULE; when `open`, its final "." replaced by CLOSING_OPEN_CLAUSE. */
function closingRule(open: boolean): string;
```

### Rule and section texts

```ts
// src/core/task-brief.ts (module constants). OPEN_PLACEHOLDER is "{?}" (placeholders.ts).

/** Was "…the value the code produces, and report it as `<scenario ID>: <value>`." */
const OPEN_RULE =
  "- `{?}` marks a value the spec leaves to the first passing test: make the test assert the value the code produces.";

/** F-009's standing rules without the last one, which CLOSING_RULE replaces. */
const STANDING_RULES = [
  "- Give every test a name that no other test in the project has.",
  "- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.",
  '- Change only the files under "Files you may change".',
  "- Never run git or azimuth, and never edit anything under .azimuth/.",
];

/** The rule for one shared path, e.g. sharedFileRule("src/registry.ts"). */
const sharedFileRule = (path: string) =>
  `- \`${path}\` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).`;

const SHARED_RULES = [
  "- Never edit or reorder another task's insertion in a shared file.",
  "- Don't run a formatter over a shared file or its package.",
];

const CLOSING_RULE =
  "- When you are done, report: the files you changed; the verify command's result; what the task taught that later tasks should know (a constraint the code revealed, a choice the spec left open); each file you had to change outside \"Files you may change\", and why.";

const CLOSING_OPEN_CLAUSE =
  "; the value each `{?}` took in a passing test, as `<scenario ID>: <value>`.";

const CONVENTIONS_MAX_WORDS = 1500;

/** `file` is knowledge.conventions.file: ".azimuth/project/conventions.md". */
const conventionsPointer = (file: string) =>
  `The project's conventions are too long to include here: read \`${file}\` and follow what applies to this task.`;
```

### The brief

F-009's order, with `## Conventions` added before `## Rules` and the Rules extended (blank lines
between parts; a part with nothing to show is left out unless marked "always"):

1. `# <T-ID> · <task title>`, `Feature: …`, `After: …` (unchanged).
2. `## Scenarios` (unchanged).
3. `## Contract` (unchanged text; its demotion is now nestHeadings).
4. `## Invariants` (unchanged).
5. `## Files you may change` (always, unchanged).
6. `## Verify` (always, unchanged).
7. `## Notes from earlier tasks` (unchanged).
8. `## Conventions` (new): conventionsBody(model.knowledge.conventions); left out when null.
9. `## Rules` (always), in this order:
   - the test-name rules for `stack.languages` (unchanged);
   - STANDING_RULES;
   - sharedFileRules(task.files, model.config.parallel.shared_files);
   - OPEN_RULE, when a covered scenario holds `{?}` outside fenced code;
   - closingRule(<the same condition>), always last.

### Brief example

The project is F-009's brief example (`exampleFiles()` in `test/core/task-brief.test.ts`) with
two changes: `.azimuth/config.yaml` is

```ts
`${MINIMAL_CONFIG}stack:\n  languages: [typescript]\nparallel:\n  shared_files: [src/headings.ts]\n`;
```

and `.azimuth/project/conventions.md` is

```ts
const CONVENTIONS = [
  "---",
  "updated: 2026-10-01",
  "---",
  "# Conventions",
  "",
  "## Testing",
  "Vitest, one test file per module.",
  "",
  "~~~sh",
  "# run one file",
  "pnpm exec vitest run test/x.test.ts",
  "~~~",
  "",
].join("\n");
```

`taskBrief(model, "T-001.2")` returns exactly:

```ts
const F022_EXAMPLE_BRIEF = [
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
  "## Conventions",
  "",
  "### Testing",
  "Vitest, one test file per module.",
  "",
  "~~~sh",
  "# run one file",
  "pnpm exec vitest run test/x.test.ts",
  "~~~",
  "",
  "## Rules",
  "",
  '- Start each test name with the scenario it covers: `it("S-001.1.1 <what it checks>", …)`.',
  "- Give every test a name that no other test in the project has.",
  "- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.",
  '- Change only the files under "Files you may change".',
  "- Never run git or azimuth, and never edit anything under .azimuth/.",
  "- `src/headings.ts` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).",
  "- Never edit or reorder another task's insertion in a shared file.",
  "- Don't run a formatter over a shared file or its package.",
  "- When you are done, report: the files you changed; the verify command's result; what the task taught that later tasks should know (a constraint the code revealed, a choice the spec left open); each file you had to change outside \"Files you may change\", and why.",
].join("\n");
```

## Errors

None new. `taskBrief` throws as before: `AzimuthError("invalid", "<ID> is not a task ID.")`,
`AzimuthError("not-found", "<F-ID> does not exist.")` and
`AzimuthError("not-found", "<T-ID> is not a task in <plan.md path>.")`. A missing, empty or
template conventions.md and an empty `parallel.shared_files` are not errors: the parts are left
out.

## State transitions
None.
