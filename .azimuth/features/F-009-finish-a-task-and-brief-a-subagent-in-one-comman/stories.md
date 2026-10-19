# F-009: Stories

Notation: in this file ⟦?⟧ stands for the open placeholder (an opening brace, a question mark and
a closing brace) and ⟦=v⟧ for the value v settled (an opening brace, an equals sign, v and a
closing brace); tests write the real characters. Written literally here they would be live
placeholders in this repository's own stories.

Unless a scenario says otherwise, the project is a git repository whose HEAD holds a
`.gitignore` with `.azimuth/cache/`, the files `src/a.ts`, `test/a.test.ts` and `src/other.ts`,
and F-001 in progress in `.azimuth/features/F-001-thing/` (story ST-001.1 with S-001.1.1
{happy} and S-001.1.2 {negative}), whose T-001.1 is in progress with
`files: [src/a.ts, test/a.test.ts]`, `covers: [S-001.1.1, S-001.1.2]` and verify
`echo S-001.1.1 ok`. Every scenario of F-001 is covered by a task, since an uncovered scenario
of an in-progress feature is an error.
"The task's files changed" means `src/a.ts` and `test/a.test.ts` differ from HEAD. `finishTask`
runs with `actor: "agent"` and the message `feat(F-001): add a`. In a THEN, `<sha>` is HEAD's
7-character SHA after the call and `<n>` a duration with one decimal; steps are written
`<step> <status>`.

## ST-009.1 · The commit names its task
**Intent:** As an orchestrator, I want finish to add the Refs trailer my message lacks without breaking the trailers it has, so that every task commit links to its task.

### S-009.1.1 · A subject-only message gains a Refs trailer {happy}
- **GIVEN** the message `feat(F-001): add a`
- **WHEN** `withRefsTrailer(message, "T-001.1")` runs
- **THEN** it returns `feat(F-001): add a\n\nRefs: T-001.1`

### S-009.1.2 · Refs joins an existing trailer block {happy}
- **GIVEN** the message `feat(F-001): add a\n\nWhy it matters.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n`
- **WHEN** `withRefsTrailer(message, "T-001.1")` runs
- **THEN** it returns `feat(F-001): add a\n\nWhy it matters.\n\nRefs: T-001.1\nCo-Authored-By: Claude <noreply@anthropic.com>`

### S-009.1.3 · A message with a Refs line keeps it {edge}
- **GIVEN** the message `fix(F-001): handle empty input\n\nrefs: T-001.1, T-001.2\n`
- **WHEN** `withRefsTrailer(message, "T-001.1")` runs
- **THEN** it returns `fix(F-001): handle empty input\n\nrefs: T-001.1, T-001.2`

### S-009.1.4 · A last paragraph of prose stays prose {edge}
- **GIVEN** the message `feat(F-001): add a\n\nNote: the parser counts the BOM.\nIt starts at byte 3.`
- **WHEN** `withRefsTrailer(message, "T-001.1")` runs
- **THEN** it returns `feat(F-001): add a\n\nNote: the parser counts the BOM.\nIt starts at byte 3.\n\nRefs: T-001.1`

## ST-009.2 · Only the task's files and the feature's records are staged
**Intent:** As an orchestrator with several lanes in one working tree, I want finish to pick only what belongs to the task, so that one task's commit never carries another lane's work.

### S-009.2.1 · Task files and records are staged, the rest listed {happy}
- **GIVEN** the changed paths `src/a.ts`, `src/other.ts`, `test/a.test.ts`, `.azimuth/features/F-001-thing/plan.md` and `.azimuth/features/F-002-more/log.md`, and a task with `files: [src/a.ts, test/a.test.ts]`
- **WHEN** `selectPaths(changed, task, ".azimuth/features/F-001-thing/")` runs
- **THEN** `staged` is `[".azimuth/features/F-001-thing/plan.md", "src/a.ts", "test/a.test.ts"]` and `not_staged` is `[".azimuth/features/F-002-more/log.md", "src/other.ts"]`

### S-009.2.2 · A directory entry covers only the files under it {edge}
- **GIVEN** the changed paths `src/parser/inline.ts`, `src/parser.ts` and `src/parserx/a.ts`, and a task with `files: ["./src/parser/"]`
- **WHEN** `selectPaths(changed, task, ".azimuth/features/F-001-thing/")` runs
- **THEN** `staged` is `["src/parser/inline.ts"]` and `not_staged` is `["src/parser.ts", "src/parserx/a.ts"]`

### S-009.2.3 · A task without files stages only the records {edge}
- **GIVEN** the changed paths `src/a.ts` and `.azimuth/features/F-001-thing/notes.md`, and a task with `files: []`
- **WHEN** `selectPaths(changed, task, ".azimuth/features/F-001-thing/")` runs
- **THEN** `staged` is `[".azimuth/features/F-001-thing/notes.md"]` and `not_staged` is `["src/a.ts"]`

## ST-009.3 · One call commits, verifies and finishes a task
**Intent:** As an orchestrator, I want one command to commit a task's work, verify it and move it to done, so that a task costs one call and one commit instead of six to ten calls and two commits.

### S-009.3.1 · The common path {happy}
- **GIVEN** the task's files changed and `src/other.ts` changed
- **WHEN** `finishTask(root, "T-001.1", { message: "feat(F-001): add a", actor: "agent" })` runs
- **THEN** `ok` is true and the steps are `check done, stage done, commit done, verify done, done done, log done`
- **AND** HEAD's message is `feat(F-001): add a\n\nRefs: T-001.1` and HEAD changes exactly `src/a.ts` and `test/a.test.ts`
- **AND** run R-0001 targets T-001.1 with `ok` true and `commit` `<sha>`, T-001.1's status in plan.md is `done`, and the last log.md entry's body is `T-001.1: in-progress → done. Committed <sha>; R-0001 passed.`
- **AND** `not_staged` is `["src/other.ts"]` and `git status --porcelain` still shows ` M src/other.ts`

### S-009.3.2 · The note and the feature's records ride in the task's commit {happy}
- **GIVEN** the task's files changed and `.azimuth/features/F-001-thing/stories.md` changed since HEAD (a settled value)
- **WHEN** `finishTask(root, "T-001.1", { message: "feat(F-001): add a", note: "Counts the BOM.", actor: "agent", now: new Date("2026-10-20T09:00:00Z") })` runs
- **THEN** the steps are `check done, note done, stage done, commit done, verify done, done done, log done`
- **AND** HEAD changes exactly `.azimuth/features/F-001-thing/notes.md`, `.azimuth/features/F-001-thing/stories.md`, `src/a.ts` and `test/a.test.ts`, and notes.md at HEAD ends with `### T-001.1 · 2026-10-20\n\nCounts the BOM.\n`

### S-009.3.3 · A shared file is committed whole with the first task that lists it {edge}
- **GIVEN** F-001's T-001.1 (`files: [src/registry.ts, src/a.ts]`) and T-001.2 (`files: [src/registry.ts, src/b.ts]`), both in progress, with `src/registry.ts` holding one new line from each lane (`a,` and `b,`) and `src/a.ts` and `src/b.ts` changed
- **WHEN** `finishTask` runs for T-001.1 with the message `feat(F-001): add a`, then for T-001.2 with the message `feat(F-001): add b`
- **THEN** both results have `ok` true; the first commit changes exactly `src/a.ts` and `src/registry.ts`, and its `src/registry.ts` holds both `a,` and `b,`
- **AND** the second commit changes exactly `.azimuth/features/F-001-thing/feature.md`, `.azimuth/features/F-001-thing/log.md`, `.azimuth/features/F-001-thing/plan.md` and `src/b.ts`, and both tasks are `done` in plan.md

## ST-009.4 · finish stops at the first failure
**Intent:** As an orchestrator, I want finish to stop at the first failing step and say which steps ran, so that I know what is done and what remains.

### S-009.4.1 · Warnings don't stop it {happy}
- **GIVEN** the task's files changed, and F-001's stories.md gives S-001.1.2 the THEN `it works correctly` (a `W-VAGUE` warning)
- **WHEN** `finishTask` runs for T-001.1
- **THEN** `ok` is true and the check step is `{ step: "check", status: "done", detail: "F-001 has no errors", output: "" }`

### S-009.4.2 · An error in the feature stops it before anything changes {negative}
- **GIVEN** the task's files changed, and F-001's stories.md has a scenario S-001.1.2 without a THEN line
- **WHEN** `finishTask` runs for T-001.1 with `note: "Counts the BOM."`
- **THEN** `ok` is false and the steps are `check failed, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run`
- **AND** the check's detail is `F-001 has 1 error` and its output contains `S-001.1.2 is missing THEN.`; HEAD and the index are unchanged, notes.md doesn't exist and `.azimuth/cache/runs/` holds no file

### S-009.4.3 · A task that isn't in progress {negative}
- **GIVEN** HEAD holds T-001.1 with status `todo`, and the task's files changed
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the check step fails with detail ``T-001.1 is todo. Move it to in-progress first (`azimuth move T-001.1 in-progress`).``, every later step is `not-run`, and `git diff --cached --name-only` prints nothing

### S-009.4.4 · Something else is already staged {negative}
- **GIVEN** the task's files changed, and `src/other.ts` changed and staged with `git add src/other.ts`
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the check step fails with detail `Already staged, but not T-001.1's files or F-001's records: src/other.ts. Unstage them (git restore --staged <path>) or commit them first.`, and `git diff --cached --name-only` still prints only `src/other.ts`

### S-009.4.5 · Nothing to commit {edge}
- **GIVEN** only `src/other.ts` changed
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the steps are `check done, stage failed, commit not-run, verify not-run, done not-run, log not-run`, the stage detail is `Nothing to commit: none of T-001.1's files and none of F-001's records changed.`, `not_staged` is `["src/other.ts"]`, HEAD is unchanged and T-001.1 is still `in-progress`

### S-009.4.6 · A failing pre-commit hook stops at the commit {negative}
- **GIVEN** the task's files changed and an executable `.git/hooks/pre-commit` that prints `lint failed` and exits 1
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the steps are `check done, stage done, commit failed, verify not-run, done not-run, log not-run`, the commit's detail is `git commit failed (exit 1)` and its output contains `lint failed`
- **AND** HEAD is unchanged, `git diff --cached --name-only` prints `src/a.ts` and `test/a.test.ts`, and `.azimuth/cache/runs/` holds no file

## ST-009.5 · The verify run decides done
**Intent:** As an orchestrator, I want a failing verify to keep the commit and leave the task in progress, so that I can fix it and finish again without losing work.

### S-009.5.1 · A fixed task finishes on the second call {happy}
- **GIVEN** T-001.1's verify is `grep -q fixed src/a.ts && echo S-001.1.1 ok`, a `finishTask` that committed `src/a.ts` holding `broken` and recorded R-0001 failed, and then `src/a.ts` changed to hold `fixed`
- **WHEN** `finishTask` runs for T-001.1 with the message `fix(F-001): fix a`
- **THEN** `ok` is true, HEAD's subject is `fix(F-001): fix a` and it changes exactly `.azimuth/features/F-001-thing/log.md` and `src/a.ts`, run R-0002 has `ok` true, and T-001.1 is `done`

### S-009.5.2 · A failing verify keeps the commit {negative}
- **GIVEN** T-001.1's verify is `echo S-001.1.1 boom; exit 1`, and the task's files changed
- **WHEN** `finishTask` runs for T-001.1
- **THEN** `ok` is false and the steps are `check done, stage done, commit done, verify failed, done not-run, log done`
- **AND** the verify detail is `R-0001 failed (exit 1) in <n>s` with output `S-001.1.1 boom`, HEAD's subject is `feat(F-001): add a`, T-001.1 is still `in-progress`, and the last log.md entry's body is `T-001.1: Committed <sha>; R-0001 failed (exit 1).`

### S-009.5.3 · A failed prebuild records no run {negative}
- **GIVEN** `verify.prebuild` `echo no compiler; exit 2`, and the task's files changed
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the steps are `check done, stage done, commit done, verify failed, done not-run, log done`, the verify detail is `prebuild failed (exit 2) in <n>s` with output `no compiler`, `run` is null, `.azimuth/cache/runs/` holds no file, T-001.1 is still `in-progress`, and the last log.md entry's body is `T-001.1: Committed <sha>; prebuild failed (exit 2).`

### S-009.5.4 · An interruption during verify {edge}
- **GIVEN** T-001.1's verify is `sleep 60 & echo $! > child.pid; wait`, and the task's files changed
- **WHEN** the `signal` passed to `finishTask` aborts after `child.pid` appears
- **THEN** `interrupted` is true, `ok` is false and the steps are `check done, stage done, commit done, verify failed, done not-run, log not-run` with verify detail `interrupted`
- **AND** HEAD's subject is `feat(F-001): add a`, `.azimuth/cache/runs/` holds no file, T-001.1 is still `in-progress` and the pid in `child.pid` no longer exists

## ST-009.6 · azimuth task finish on the command line
**Intent:** As an orchestrator, I want `azimuth task finish` to print one line per step and exit by the CLI's rules, so that one tool call tells me the task's state.

### S-009.6.1 · A finished task prints its steps and exits 0 {happy}
- **GIVEN** the task's files changed, `src/other.ts` changed, and an open session `SES-20261020-0900` (part of HEAD) whose `touched` is `[]`, selected with `AZIMUTH_SESSION`
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a"` runs
- **THEN** it exits 0 and stdout is exactly the lines `✓ check: F-001 has no errors`, `✓ stage: src/a.ts, test/a.test.ts`, `  not staged: src/other.ts`, `✓ commit: <sha> feat(F-001): add a`, `✓ verify: R-0001 passed in <n>s`, `✓ done: T-001.1: in-progress → done` and `✓ log: Committed <sha>; R-0001 passed.`
- **AND** the session's `touched` is `["F-001", "T-001.1"]`

### S-009.6.2 · A failed verify exits 1 and says what remains {negative}
- **GIVEN** T-001.1's verify is `echo S-001.1.1 boom; exit 1`, and the task's files changed
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a"` runs
- **THEN** it exits 1 and stdout ends with the lines `✗ verify: R-0001 failed (exit 1) in <n>s`, `    S-001.1.1 boom`, `- done: not run` and `✓ log: Committed <sha>; R-0001 failed (exit 1).`

### S-009.6.3 · --json prints the result {edge}
- **GIVEN** the task's files changed
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a" --json` runs
- **THEN** it exits 0 and stdout parses to an object with `task` `"T-001.1"`, `feature` `"F-001"`, `ok` true, `commit` `<sha>`, `run` `"R-0001"`, `staged` `["src/a.ts", "test/a.test.ts"]`, `not_staged` `[]`, `interrupted` false, and `steps` whose `step` values are `["check", "stage", "commit", "verify", "done", "log"]`, each with `status` `"done"`

### S-009.6.4 · Usage errors exit 2 {negative}
- **GIVEN** the task's files changed
- **WHEN** `azimuth task finish T-001.1`, `azimuth task finish F-001 --commit "x"` and `azimuth task close T-001.1 --commit "x"` run
- **THEN** each exits 2 with HEAD unchanged, and their stderr starts with `task finish needs --commit "<message>".`, `F-001 is not a task ID.` and `Unknown task action "close". Use finish.` respectively

## ST-009.7 · azimuth brief builds a subagent's prompt from the records
**Intent:** As an orchestrator, I want a subagent's prompt generated from the task's records, so that I stop writing 600- to 1,200-word briefs by hand and every lane gets the same rules.

### S-009.7.1 · The full brief {happy}
- **GIVEN** the example project in contract.md ("Brief example": TypeScript, T-001.2 after T-001.1 done, covering S-001.1.1 and S-001.1.2, with a contract, an invariant and a note)
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** it returns exactly the example brief in contract.md, whose contract headings read `### Public signatures` and `### Config`, and whose YAML block keeps its `# headings.yaml` line

### S-009.7.2 · Placeholders are marked {edge}
- **GIVEN** the example project, with S-001.1.1's THEN `one heading starts at byte ⟦?⟧` and an AND `it ends at byte ⟦=4⟧` after it
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief holds the lines `- **THEN** one heading starts at byte ⟦?⟧` and `- **AND** it ends at byte 4`, and its last line is the open-value rule of contract.md

### S-009.7.3 · Parts with nothing to show are left out {edge}
- **GIVEN** a project without `stack.languages` whose F-001 has no Invariants section, a contract.md holding only frontmatter and its title, and no notes.md, and whose T-001.1 has no `after`, no `files`, `covers: [S-001.9.9]` (not in stories.md) and verify `echo ok`
- **WHEN** `taskBrief(loadProject(root), "T-001.1")` runs
- **THEN** the brief has no `After:` line and no `## Contract`, `## Invariants` or `## Notes from earlier tasks` heading, its Scenarios section is `### S-001.9.9` then `Not in stories.md.`, its Files section reads `None listed.`, and its first rule is ``- Put a `// scenario: S-001.9.9` comment on the line above each test.``

### S-009.7.4 · The test-name rule follows the project's languages {edge}
- **GIVEN** the example project with `stack.languages: [python, rust]`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** its first two rules are ``- Mark each test with the scenario it covers: `@pytest.mark.scenario("S-001.1.1")`.`` and ``- Put a `// scenario: S-001.1.1` comment on the line above each test.``

### S-009.7.5 · An unknown task or feature {negative}
- **GIVEN** the example project, whose F-001 has T-001.1 and T-001.2
- **WHEN** `taskBrief` runs for `T-001.9`, and separately for `T-009.1`
- **THEN** the first throws an `AzimuthError` with code `not-found` and message `T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.`, and the second one with code `not-found` and message `F-009 does not exist.`

## ST-009.8 · azimuth brief on the command line
**Intent:** As an orchestrator, I want `azimuth brief <T-ID>` to print the prompt I hand to a subagent, so that delegating a task is one call.

### S-009.8.1 · The brief is printed {happy}
- **GIVEN** the example project in contract.md
- **WHEN** `azimuth brief T-001.2` runs
- **THEN** it exits 0 and stdout is the example brief followed by one newline

### S-009.8.2 · --json wraps the brief {edge}
- **GIVEN** the example project
- **WHEN** `azimuth brief T-001.2 --json` runs
- **THEN** it exits 0 and stdout parses to `{ "task": "T-001.2", "feature": "F-001", "text": <the example brief> }`

### S-009.8.3 · An unknown task or a non-task ID {negative}
- **GIVEN** the example project
- **WHEN** `azimuth brief T-001.9` runs, and separately `azimuth brief F-001`
- **THEN** the first exits 1 with empty stdout and stderr `✗ T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.\n`, and the second exits 2 with stderr starting with `F-001 is not a task ID.`
