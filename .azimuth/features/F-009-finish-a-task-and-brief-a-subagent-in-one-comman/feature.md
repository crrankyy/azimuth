---
id: F-009
title: Finish a task and brief a subagent in one command
summary: azimuth task finish checks the feature, adds an optional note, stages the task's files and the feature's records, commits with a Refs trailer, verifies and moves the task to done in one call; azimuth brief prints a subagent's prompt built from the records.
status: done
priority: P1
size: M
mode: brownfield
milestone: M-01
depends_on: [F-007, F-008]
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:21eea541e6316165bb41e2e6f50bbeba85a023edf74e73b6bca2a6bd2dbbc050
approved_commit: 0d5e90b
review_ack_at: 2026-10-20T11:04:34Z
---
# F-009: Finish a task and brief a subagent in one command

## Objective
Each task cost the orchestrator six to ten CLI and git calls and two commits (move, stage, commit,
record, check, reapprove, prebuild, verify, move, log), and each subagent brief was written by
hand at 600 to 1,200 words (experience report §2, §4.4, §5.3 and §5.6). Two commands replace
that:

- `azimuth task finish <T-ID> --commit "<message>" [--note "<text>"]` does the common path in
  one call and stops at the first failure, printing one line per step so the orchestrator sees
  what is done and what remains: check the feature, append the note (F-008's `addNote`), stage
  the task's changed `files` and the feature's changed records, commit with a `Refs: <T-ID>`
  trailer (hooks run), verify the task with `verifyBatch` (F-007, prebuild included), move the
  task to done when the run passed, and log the result. It exits 0 when the task is done and 1
  when a step failed; after a failed verify the commit stays and the task stays in progress.
- `azimuth brief <T-ID>` prints the subagent's prompt in Markdown from the records: the task and
  the status of its `after` tasks, each covered scenario's GIVEN/WHEN/THEN/AND lines with
  placeholders marked, the contract, the feature's invariants, the files it may change, the
  verify command, the feature's notes and the standing rules.

The build skill's loop and its "Delegating to subagents" section use both commands.

## Out of scope
- Hunk staging (`azimuth stage`, report §5.5): a shared file (F-010) in a task's `files` is
  staged whole, holding every lane's insertions (decided by the user).
- Finishing several tasks in one call, and `--no-prebuild` on `task finish`.
- Pushing, amending, signing or any other git operation beyond `git add` and one `git commit`.
- Settling placeholders from a subagent's report: the orchestrator runs `azimuth settle` (F-008).
- Detecting that a subagent changed files outside its task beyond listing them as "not staged".
- Putting the feature's objective, the architecture, the conventions or the glossary in the brief,
  writing the brief to a file, or launching the subagent.
- Changes to `azimuth verify`, `move`, `log`, `note` or `show --brief` (`showBrief`), and viewer
  changes.

## Integration points
- `src/core/finish.ts` (new): `finishTask` runs the steps; `withRefsTrailer` and `selectPaths`
  are pure helpers. It reads the project with `analyzeProject` (`build-index.ts`), resolves the
  verify target with `verifyTargets` and runs it with `verifyBatch` (`verify.ts`, F-007), writes
  the note with `addNote` (`notes.ts`, F-008), moves the task with `moveTask` and logs a failed
  verify with `addLogEntry` (`transitions.ts`), and matches paths with `runScope` and `inScope`
  (`run-scope.ts`, F-006). Git runs through `spawnSync`, like `git.ts`, whose `isGitRepo` and
  `headSha` it reuses.
- `src/core/task-brief.ts` (new): `taskBrief(model, taskId)` over `loadProject`'s model:
  `FeatureEntity.tasks`, `spec.stories`, `spec.contract`, `context.invariants` and `notes`
  (F-008), `config.stack.languages`, and F-008's `placeholderParts` (`placeholders.ts`).
- `src/cli/commands/task.ts` (new): the `task` command (`task finish`) and the `brief` command,
  registered in `COMMANDS` in `src/cli/main.ts`. `task finish` records `[F-ID, T-ID]` in the
  session's `touched` with `recordInSession`, and turns SIGINT and SIGTERM into an abort with
  `abortOnSignals`, now exported from `src/cli/commands/work.ts`.
- Agent instructions and docs: `plugin/skills/build/SKILL.md` (the loop and "Delegating to
  subagents"), `plugin/skills/azimuth/SKILL.md` (CLI reference), `src/core/protocol.ts` (the
  per-task lines in "Sessions and progress" and "Tests"), `docs/cli.md` and `docs/concepts.md`.

## Invariants
- `task finish` never passes `--no-verify`, never amends, pushes or rewrites history, and makes
  at most one commit. Git runs with the caller's environment and configuration, so hooks run.
- A failed check changes nothing: no file is written, nothing is staged or committed, no run is
  recorded.
- The commit holds exactly the staged set: the task's changed files and the feature's changed
  records. Any other path is never staged or committed by finish.
- A task moves to done only after its verify run passed and was recorded at the new commit. After
  a failed verify, the commit stays and the task stays in progress.
- The steps run in order and stop at the first failure; the only step after a failed verify is
  the log entry.
- `azimuth brief` writes nothing and runs no git, and the same records give the same text: no
  clock, no absolute paths, no git state.
- `azimuth verify`, `move`, `log`, `note`, `show --brief` and every other existing command keep
  their behaviour and output.

## Assumptions
- `task finish` takes an in-progress task of an in-progress feature. A todo task is refused with
  moveTask's wording ("Move it to in-progress first"); the build loop moves a task to in-progress
  when it hands it out.
- The check step, in order: a git repository; the feature and the task exist; the feature and
  the task are in progress; the task has a verify command (`verifyTargets`); the feature has no
  errors, by the rule `azimuth check F-NNN` uses (a problem whose ref is the feature or one of
  its parts, or whose file is in its folder); nothing outside the set is already staged.
  Warnings never stop it. The CLI's rule lives in `read.ts` and can't be imported by core, so
  `finish.ts` applies the same rule itself.
- Changed paths come from `git status --porcelain=v1 -z --untracked-files=all` (modified, added,
  deleted, both paths of a rename, untracked; ignored files never appear). A path belongs to the
  task when it equals one of its `files` or lies under it, after removing a leading `./` and a
  trailing `/` (`runScope(task, { impact: [] }, [], [])` and `inScope`). It is a record when it
  lies under the feature's folder. Like F-006, this assumes the project root is the repository
  root, since porcelain paths are relative to the repository root.
- Refusing up front when anything outside the set is already staged keeps the commit to the
  staged set with a plain `git add -A -- <paths>` and `git commit -F -`, instead of a pathspec
  commit, whose temporary index some hooks handle badly.
- A message has a Refs trailer when any line after its first starts with `Refs:` (any case); it
  is then kept as written. Otherwise `Refs: <T-ID>` becomes the first line of the last paragraph
  when every line of that paragraph is a `Token: value` trailer (so `Co-Authored-By:` stays in
  git's trailer block), or else a new last paragraph. Trailing whitespace is removed.
- The note goes in before staging, so it rides in the task's commit. When a later step fails, the
  note stays in notes.md, and the step lines say so: rerun without `--note`.
- The move to done and its log entry are written after the commit and stay uncommitted. The next
  `task finish` in the feature commits them with its records (close-out does for the last task).
  They change only `.azimuth/`, so they never make a run stale (F-006).
- After a passing verify, the move's own log entry carries the result
  (`T-001.1: in-progress → done. Committed 1a2b3c4; R-0001 passed.`), so a task gets one entry.
  After a failed verify, a note entry does (`T-001.1: Committed 1a2b3c4; R-0001 failed (exit 1).`).
  An interrupted verify logs nothing.
- Each finish runs `verify.prebuild`. Finishing a batch one task at a time runs it once per task,
  but the code in the working tree doesn't change between those calls, so an incremental build
  has little to redo. This replaces the build skill's "verify the batch in one call" step.
- Shared files need no code here: a file both tasks list is a task file of each, so the first
  task finished commits it whole, with every lane's insertions, and the next task's commit no
  longer sees it changed. finish doesn't read `parallel.shared_files` and needs no F-010 code.
  The build skill tells the orchestrator to finish a batch's tasks one at a time after the whole
  batch has reported.
- `task finish` exit codes: 0 when the task is done; 1 when a step failed (check, note, nothing to
  commit, git, verify, prebuild, move); 2 for usage errors (no `--commit`, a non-task ID, an
  unknown action, no project); 130 or 143 after SIGINT or SIGTERM during verify, as `azimuth
  verify`. `--json` prints the result object whatever the outcome. The session records
  `[F-ID, T-ID]` unless the check failed.
- Failed git steps report the last `verify.output_tail_lines` lines of git's output.
- `azimuth brief` reads `loadProject`'s model only (no index, git or clock). Each covered
  scenario is its stories.md lines from its `### ` heading to the next `## ` or `### ` heading
  outside fenced code, as written, without leading or trailing blank lines. Outside fences, a
  settled value prints as the value and an open placeholder stays as written, with a rule saying
  what it means. A covered ID missing from stories.md prints `Not in stories.md.`
- The contract is contract.md without its frontmatter and its first `# ` title line, trimmed,
  with every heading outside fenced code one level deeper so it nests under the brief's
  `## Contract`.
- A brief section with nothing to show is left out (`After:`, Scenarios, Contract, Invariants,
  Notes); Files ("None listed."), Verify ("None.") and Rules always print.
- The test-name rule follows `config.stack.languages`: the `it("S-…")` form when it holds
  typescript or javascript, the `@pytest.mark.scenario` form for python, and the
  `// scenario:` comment for any other language or none, one rule per form in that order. The
  example ID is the task's first covered scenario, else `S-NNN.1.1`.
- `brief --json` prints `{ task, feature, text }`, so every read command keeps accepting
  `--json`. An unknown task or feature exits 1 (`not-found`), as `verify` and `note` do; an ID
  that isn't a task ID is a usage error (exit 2).
- When a spec file is missing (`FeatureEntity.spec` is null), the brief has no scenario text and
  no contract. Approved features always have both.
- F-009's own stories write the open placeholder as ⟦?⟧ and a value v settled as ⟦=v⟧, as F-008's
  do: written literally they would be live placeholders in this repository.
