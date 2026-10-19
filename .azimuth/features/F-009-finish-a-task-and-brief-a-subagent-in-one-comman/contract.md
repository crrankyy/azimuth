---
language: typescript
---
# F-009: Contract

## Data structures

```ts
// src/core/finish.ts (new)

export type FinishStepName = "check" | "note" | "stage" | "commit" | "verify" | "done" | "log";
export type FinishStepStatus = "done" | "failed" | "not-run";

export interface FinishStep {
  step: FinishStepName;
  status: FinishStepStatus;
  /** One line: what the step did, or why it failed; "" when not run. */
  detail: string;
  /** Further lines: the feature's errors, git's output or a verify output tail; "" otherwise. */
  output: string;
}

export interface FinishResult {
  task: Id;
  /** featureOf(task). */
  feature: Id;
  /** True when the task ended done. */
  ok: boolean;
  /**
   * check, note, stage, commit, verify, done, log, in this order, every one of them (status
   * "not-run" for those that didn't run); "note" only when a note was given.
   */
  steps: FinishStep[];
  /** Paths staged and committed, sorted; [] until the stage step ran. */
  staged: string[];
  /** Changed paths left out of the commit, sorted; [] until the stage step ran. */
  not_staged: string[];
  /** The new commit's 7-character SHA; null until the commit step succeeded. */
  commit: string | null;
  /** The recorded run; null when none was (failed prebuild, interruption, earlier failure). */
  run: Id | null;
  /** True when `signal` aborted the verify step. */
  interrupted: boolean;
}

export interface FinishOptions extends Who {
  /** The commit message as given; withRefsTrailer adds `Refs: <T-ID>` when it has no Refs line. */
  message: string;
  /** Appended to the feature's notes.md (F-008 addNote) before staging; null or absent: no note step. */
  note?: string | null;
  /** Aborting kills the running verify command (verifyBatch); done and log don't run. */
  signal?: AbortSignal;
}

export interface PathSelection {
  /** Changed paths that are the task's files (or under one) or under the feature's folder, sorted. */
  staged: string[];
  /** Every other changed path, sorted. */
  not_staged: string[];
}
```

## Public signatures

```ts
// src/core/finish.ts

/**
 * The message with trailing whitespace removed and, unless a line after the first starts with
 * "Refs:" (any case), `Refs: <taskId>` added: as the first line of the last paragraph when that
 * paragraph isn't the first and every line of it matches /^[A-Za-z][A-Za-z0-9-]*: \S/, else as
 * a new last paragraph after a blank line.
 */
export function withRefsTrailer(message: string, taskId: string): string;

/**
 * Splits changed paths (repo-relative, as `git status --porcelain` prints them) into the ones to
 * stage and the ones to leave. A path is the task's when runScope(task, { impact: [] }, [], [])
 * is non-null and inScope(path, scope) holds (equal to a file, or under it as a directory, after
 * removing a leading "./" and a trailing "/"); it is a record when it starts with `featureDir`
 * (a feature's `dir`, with its trailing slash).
 */
export function selectPaths(
  changed: string[],
  task: Pick<TaskRaw, "files">,
  featureDir: string,
): PathSelection;

/**
 * Runs the steps in order and stops at the first that fails; after a failed verify only the log
 * step still runs. Never throws for a failing step (AzimuthErrors from the writers it calls
 * become that step's detail); unexpected errors propagate.
 *
 * check   read-only: git repository, feature and task exist, both in progress, the task has a
 *         verify command (verifyTargets), no error related to the feature in analyzeProject's
 *         problems, nothing staged outside selectPaths' `staged`.
 * note    addNote(root, taskId, note, opts).
 * stage   selectPaths over `git status --porcelain=v1 -z --untracked-files=all`, then
 *         `git add -A -- <staged>`; fails when `staged` is empty.
 * commit  `git commit -F -` with withRefsTrailer(message, taskId) on stdin; hooks run.
 * verify  verifyBatch(root, verifyTargets(root, [taskId]), { ses: opts.session ?? null, signal }).
 * done    moveTask(root, taskId, "done", { ...opts, note: <log detail> }) when the run passed.
 * log     after a pass, the move's entry carries the result; after a failed run or prebuild,
 *         addLogEntry(root, taskId, "note", <log detail>, opts).
 */
export function finishTask(root: string, taskId: string, opts: FinishOptions): Promise<FinishResult>;

// src/core/task-brief.ts (new)

/**
 * The prompt for a subagent building one task, in Markdown, built from the model only (no git,
 * no clock): the same model gives the same text. No trailing newline.
 * Throws AzimuthError("not-found", …) for an unknown feature or task.
 */
export function taskBrief(model: Model, taskId: string): string;

// src/cli/commands/work.ts: unchanged, now exported for task finish.
export function abortOnSignals(): {
  signal: AbortSignal;
  received: () => NodeJS.Signals | null;
  dispose: () => void;
};

// src/cli/commands/task.ts (new); src/cli/main.ts adds `task` and `brief` to COMMANDS after
// `verify`.
export const task: Command;
//   usage:   'task finish <T-ID> --commit "<message>" [--note "<text>"] [--json]'
//   summary: "Finish a task: commit its files with Refs, verify it and move it to done"
//   options: commit (string), note (string), json (boolean)
export const brief: Command;
//   usage:   "brief <T-ID> [--json]"
//   summary: "Print the prompt for a subagent building a task, from the records"
//   options: json (boolean)
```

### `azimuth task finish`

```text
azimuth task finish <T-ID> --commit "<message>" [--note "<text>"] [--json]
```

What each step reports:

| Step   | Detail when done                     | Detail when failed                                                                 | Output                                      |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| check  | `F-001 has no errors`                | the first failing check's message (see Errors)                                     | for errors: `<code> <file>[:<line>] <message>`, one per line |
| note   | `T-001.1: note added` (addNote's)    | the AzimuthError's message                                                         | ""                                          |
| stage  | the staged paths joined with `, `    | `Nothing to commit: none of T-001.1's files and none of F-001's records changed.` or `git add failed (exit <n>)` | git's output on a git failure |
| commit | `<sha> <subject>`                    | `git commit failed (exit <n>)`                                                     | git's output, hooks' included              |
| verify | `R-0001 passed in 1.2s`              | `R-0001 failed (exit 1) in 0.4s`, `prebuild failed (exit 2) in 3.1s` or `interrupted` | the run's or the prebuild's `output_tail` |
| done   | `T-001.1: in-progress → done`        | the AzimuthError's message                                                         | ""                                          |
| log    | `Committed <sha>; R-0001 passed.`, `Committed <sha>; R-0001 failed (exit 1).` or `Committed <sha>; prebuild failed (exit 2).` | the AzimuthError's message | "" |

Git output is stdout followed by stderr, its last `verify.output_tail_lines` lines. Seconds have
one decimal, as in `azimuth verify`.

Printed lines (✓ green, ✗ red, - dim, output dim; colour only on a TTY):

```text
✓ <step>: <detail>          a step that ran
✗ <step>: <detail>          the step that failed
    <output line>           each line of a step's output, indented four spaces
  not staged: <a>, <b>      after the stage step, when not_staged isn't empty
- <step>: not run           a step that didn't run
```

```text
$ azimuth task finish T-001.1 --commit "feat(F-001): add a" --note "Counts the BOM."
✓ check: F-001 has no errors
✓ note: T-001.1: note added
✓ stage: .azimuth/features/F-001-thing/notes.md, src/a.ts, test/a.test.ts
  not staged: src/other.ts
✓ commit: 1a2b3c4 feat(F-001): add a
✓ verify: R-0001 passed in 1.2s
✓ done: T-001.1: in-progress → done
✓ log: Committed 1a2b3c4; R-0001 passed.

$ azimuth task finish T-001.1 --commit "feat(F-001): add a"
✓ check: F-001 has no errors
✓ stage: src/a.ts
✓ commit: 1a2b3c4 feat(F-001): add a
✗ verify: R-0001 failed (exit 1) in 0.4s
    S-001.1.1 boom
- done: not run
✓ log: Committed 1a2b3c4; R-0001 failed (exit 1).
```

With `--json`, stdout is the `FinishResult` and nothing else, whatever the outcome.

Exit codes: 0 when the task is done; 1 when a step failed; 2 for usage errors; 128 + the signal
number (130, 143) when SIGINT or SIGTERM interrupted it. The session's `touched` gains
`[F-ID, T-ID]` unless the check step failed.

### `azimuth brief`

```text
azimuth brief <T-ID> [--json]
```

stdout is `taskBrief(…)` and a newline; with `--json`, `{ "task": <T-ID>, "feature": <F-ID>,
"text": <the brief> }`.

The brief, in this order (blank lines between parts; a part with nothing to show is left out
unless marked "always"):

1. `# <T-ID> · <task title>`, then the lines `Feature: <F-ID> · <feature title>` and
   `After: <ID> (<status>), …` (status from plan.md; `(not in the plan)` for an unknown ID).
2. `## Scenarios`: per covered ID in `covers` order, its stories.md lines from the `### `
   heading to the next `## ` or `### ` heading outside fenced code, as written, without leading
   or trailing blank lines; scenarios separated by a blank line. Outside fences, `{=v}` prints as
   `v` and `{?}` stays (F-008 `placeholderParts`). An ID missing from stories.md prints
   `### <ID>` and `Not in stories.md.`
3. `## Contract`: contract.md without its frontmatter and its first non-blank line when that
   starts with `# `, trimmed, every heading line (`#` to `#####` then a space) outside fenced code
   one `#` deeper.
4. `## Invariants`: feature.md's Invariants section, trimmed.
5. `## Files you may change` (always): one `- <path>` per task file, or `None listed.`
6. `## Verify` (always): the command in a `sh` fence, or `None.`
7. `## Notes from earlier tasks`: FeatureEntity.notes (F-008), as is.
8. `## Rules` (always), one bullet each, `<S>` being the first covered scenario ID, else
   `S-NNN.1.1`:
   - when `stack.languages` holds typescript or javascript:
     ``- Start each test name with the scenario it covers: `it("<S> <what it checks>", …)`.``
   - when it holds python:
     ``- Mark each test with the scenario it covers: `@pytest.mark.scenario("<S>")`.``
   - when it holds any other language, or none:
     ``- Put a `// scenario: <S>` comment on the line above each test.``
   - `- Give every test a name that no other test in the project has.`
   - `- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.`
   - `- Change only the files under "Files you may change".`
   - `- Never run git or azimuth, and never edit anything under .azimuth/.`
   - `- When you are done, report the files you changed and the verify command's result.`
   - the open-value rule, last, when a covered scenario holds `{?}` outside fences:
     ``- `{?}` marks a value the spec leaves to the first passing test: make the test assert the value the code produces, and report it as `<scenario ID>: <value>`.``

### Brief example

The project (MINIMAL_CONFIG from `test/helpers/tree.ts` plus `stack: { languages: [typescript] }`),
in `.azimuth/features/F-001-thing/`:

~~~~markdown
<!-- feature.md -->
---
id: F-001
title: Parse headings
status: in-progress
size: M
created: 2026-10-01
---
## Objective
Find headings.

## Invariants
- The parser never allocates per character.

<!-- stories.md -->
# F-001: Stories

## ST-001.1 · Headings
**Intent:** As a reader, I want headings found, so that the outline works.

### S-001.1.1 · Finds an ATX heading {happy}
- **GIVEN** the text `# Hi`
- **WHEN** it is parsed
- **THEN** one heading of level 1 is returned
- **AND** its text is `Hi`

### S-001.1.2 · Ignores a hash without a space {negative}
- **GIVEN** the text `#Hi`
- **WHEN** it is parsed
- **THEN** no heading is returned

### S-001.1.3 · Stops at level 6 {edge}
- **GIVEN** the text `####### Hi`
- **WHEN** it is parsed
- **THEN** no heading is returned

<!-- contract.md -->
---
language: typescript
---
# F-001: Contract

## Public signatures

```ts
export function headings(text: string): Heading[];
```

## Config

```yaml
# headings.yaml
max_level: 6
```

<!-- plan.md -->
---
tasks:
  - id: T-001.1
    title: Heading type
    status: done
    after: []
    covers: [S-001.1.3]
    files: [src/heading.ts]
    verify: pnpm typecheck
    note: null
  - id: T-001.2
    title: Heading recognizer (red → green)
    status: in-progress
    after: [T-001.1]
    covers: [S-001.1.1, S-001.1.2]
    files: [src/headings.ts, test/headings.test.ts]
    verify: pnpm exec vitest run test/headings.test.ts --reporter=verbose
    note: null
---

<!-- notes.md -->
# F-001: Notes

### T-001.1 · 2026-10-20

Heading levels are 1-based.
~~~~

`taskBrief(model, "T-001.2")` returns exactly:

~~~~markdown
# T-001.2 · Heading recognizer (red → green)

Feature: F-001 · Parse headings
After: T-001.1 (done)

## Scenarios

### S-001.1.1 · Finds an ATX heading {happy}
- **GIVEN** the text `# Hi`
- **WHEN** it is parsed
- **THEN** one heading of level 1 is returned
- **AND** its text is `Hi`

### S-001.1.2 · Ignores a hash without a space {negative}
- **GIVEN** the text `#Hi`
- **WHEN** it is parsed
- **THEN** no heading is returned

## Contract

### Public signatures

```ts
export function headings(text: string): Heading[];
```

### Config

```yaml
# headings.yaml
max_level: 6
```

## Invariants

- The parser never allocates per character.

## Files you may change

- src/headings.ts
- test/headings.test.ts

## Verify

```sh
pnpm exec vitest run test/headings.test.ts --reporter=verbose
```

## Notes from earlier tasks

### T-001.1 · 2026-10-20

Heading levels are 1-based.

## Rules

- Start each test name with the scenario it covers: `it("S-001.1.1 <what it checks>", …)`.
- Give every test a name that no other test in the project has.
- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.
- Change only the files under "Files you may change".
- Never run git or azimuth, and never edit anything under .azimuth/.
- When you are done, report the files you changed and the verify command's result.
~~~~

## Errors

`task finish`: every failing step is reported in the result (exit 1), never thrown. The check
step's messages, in the order they are checked:

| Check                          | Detail                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| git repository                 | `Not a git repository: task finish commits with git.`                                                                  |
| feature exists                 | `F-009 does not exist.`                                                                                                |
| task exists                    | `T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.`                                                      |
| feature in progress            | ``F-001 is approved. Move it to in-progress first (`azimuth move F-001 in-progress`).``                                |
| task in progress               | ``T-001.1 is todo. Move it to in-progress first (`azimuth move T-001.1 in-progress`).``                                |
| verify command                 | `T-001.1 has no verify command to run.`                                                                                |
| feature errors                 | `F-001 has 1 error` / `F-001 has 2 errors` (output: the errors)                                                        |
| nothing else staged            | `Already staged, but not T-001.1's files or F-001's records: src/other.ts. Unstage them (git restore --staged <path>) or commit them first.` |

Usage errors (exit 2, stderr `<message>` then the usage line, nothing changed):

| Command      | Message                                       |
| ------------ | --------------------------------------------- |
| task         | `Missing <action>.`                           |
| task         | `Unknown task action "close". Use finish.`    |
| task finish  | `Missing <T-ID>.`                             |
| task finish  | `F-001 is not a task ID.`                     |
| task finish  | `task finish needs --commit "<message>".` (missing or blank) |
| brief        | `Missing <T-ID>.`                             |
| brief        | `F-001 is not a task ID.`                     |

`brief` refusals (exit 1, stderr `✗ <message>`): `AzimuthError("not-found", "F-009 does not
exist.")` and `AzimuthError("not-found", "T-001.9 is not a task in
.azimuth/features/F-001-thing/plan.md.")`.

## State transitions

```mermaid
stateDiagram-v2
  [*] --> check
  check --> [*]: failed (exit 1, nothing changed)
  check --> note: passed, --note given
  check --> stage: passed, no --note
  note --> [*]: failed (exit 1)
  note --> stage
  stage --> [*]: nothing to commit, git add failed (exit 1)
  stage --> commit
  commit --> [*]: hook or git failed (exit 1, files stay staged)
  commit --> verify
  verify --> done: run passed
  verify --> log: run or prebuild failed
  verify --> [*]: interrupted (exit 130 or 143)
  done --> [*]: move refused (exit 1)
  done --> log: move wrote the result
  log --> [*]: exit 0 when done, else 1
```
