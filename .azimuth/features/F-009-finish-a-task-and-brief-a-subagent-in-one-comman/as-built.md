---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/finish.ts, change: create }
  - { path: src/core/task-brief.ts, change: create }
  - { path: src/cli/commands/task.ts, change: create }
  - { path: src/cli/main.ts, change: modify }
  - { path: src/cli/commands/work.ts, change: modify }
  - { path: test/core/finish.test.ts, change: create }
  - { path: test/core/task-brief.test.ts, change: create }
  - { path: test/cli/task.test.ts, change: create }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/core/protocol.ts, change: modify }
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
deviations:
  - { path: test/core/task-brief.test.ts, kind: test-change, reason: "The brief tests' example project, and the one in test/cli/task.test.ts, add an impact.md with files: []. contract.md's Brief example has none, and without impact.md loadProject gives the feature no spec (FeatureEntity.spec is null), so the brief would have no scenarios and no contract" }
  - { path: test/cli/task.test.ts, kind: test-change, reason: "S-009.8.1 and S-009.8.2 compare stdout with taskBrief's text for the same project instead of a second copy of the example brief, on a shorter copy of the example project (no S-001.1.3, no Config section). S-009.7.1 checks the example brief exactly" }
  - { path: src/core/task-brief.ts, kind: clarification, reason: "When a task covers no scenario, the test-name rule names the literal S-NNN.1.1, as contract.md writes it, not an ID with the feature's number" }
  - { path: src/core/finish.ts, kind: clarification, reason: "git add runs with --literal-pathspecs, so a path holding * or [ stages that file and never what it would match as a pattern; contract.md names plain git add -A -- <staged>" }
  - { path: src/core/finish.ts, kind: scope-addition, reason: "Messages contract.md doesn't list: the check step fails with git diff failed (exit <n>) when it can't list the staged paths, and the stage step with git status failed (exit <n>), each with git's output tail. finishTask and taskBrief throw AzimuthError invalid with <ID> is not a task ID. for an ID that isn't a task's, which the CLI already refuses as a usage error" }
  - { path: src/core/finish.ts, kind: interface-change, reason: "A step's output is filled only when the step failed. contract.md's step table gives a passing verify the run's output_tail and a commit git's output, but its CLI examples print those steps as one line each, which the empty output keeps" }
  - { path: test/core/finish.test.ts, kind: test-change, reason: "S-009.4.3's test was corrected to expect five later steps (stage, commit, verify, done, log) as not-run: without a note, FinishResult.steps has no note step" }
  - { path: src/cli/commands/task.ts, kind: omission, reason: "task finish doesn't print the waited Ns for another verify line that azimuth verify prints, because finishTask doesn't pass onProgress to verifyBatch. A finish that waited for another lane's verify shows no sign of it" }
follow_ups: [BUG-0074, BUG-0075]
---
# F-009: As built

## Summary
`azimuth task finish <T-ID> --commit "<message>" [--note "<text>"]` (`finishTask` in the new
`src/core/finish.ts`) runs check, note, stage, commit, verify, done and log in order and stops at
the first failure. The check only reads: a git repository, the feature and the task in progress,
a verify command, no error related to the feature (the rule `azimuth check F-NNN` uses; warnings
never stop it) and nothing staged outside the task's set. The note goes in with F-008's `addNote`
before staging, so it rides in the task's commit. `selectPaths` keeps the changed paths
(`git status --porcelain=v1 -z --untracked-files=all`) that are one of the task's `files` or lie
under one (`runScope` and `inScope`), or lie under the feature's folder, and `git add -A` stages
them. `withRefsTrailer` adds `Refs: <T-ID>` to a message without a Refs line, at the head of the
trailer block when the last paragraph is one, and `git commit -F -` runs with the caller's
environment, so hooks run. `verifyBatch` runs the prebuild and the task's verify command. A
passing run moves the task to done with `Committed <sha>; R-NNNN passed.` in the move's own log
entry; a failed run or prebuild keeps the commit, leaves the task in progress and logs a note.

The `task` command (new `src/cli/commands/task.ts`) prints one ✓, ✗ or - line per step, a
step's output indented below it and `not staged:` after the stage step. It exits 0 when the task
is done, 1 when a step failed, 2 for usage errors, and 130 or 143 after SIGINT or SIGTERM
(`abortOnSignals`, now exported from `work.ts`). `--json` prints the `FinishResult`, and the
session's `touched` gains the feature and the task unless the check failed.

`azimuth brief <T-ID>` (`taskBrief` in the new `src/core/task-brief.ts`) prints a subagent's
prompt from `loadProject`'s model alone, with no git and no clock: the task and its `After:`
statuses, each covered scenario's lines (settled values printed as the value, open ones kept),
the contract one heading level deeper, the invariants, the files it may change, the verify
command, the feature's notes and the rules: one test-name rule per language form, the standing
rules, and the open-value rule when a scenario holds `{?}`. Parts with nothing to show are left
out. The build skill's loop and its "Delegating to subagents" section use both commands and
finish a batch one task at a time once it has reported. The azimuth skill's CLI table, the
protocol template and the CLI and concepts docs describe them.

First real use: `task finish` committed T-009.6 as f0dc69a, but its verify (R-0162) failed
because two files of another lane, not yet committed (`src/core/live.ts` and
`test/core/live-agents.test.ts`, F-014's), weren't formatted. The commit stayed, the task stayed
in progress and the failure was logged, as specified. The task passed on a rerun at f66508a
(R-0172) and was then moved to done with `azimuth move`.

## Deviations
- The brief tests' example project, and the one in `test/cli/task.test.ts`, add an `impact.md`
  with `files: []`. contract.md's Brief example has none, and without `impact.md` `loadProject`
  gives the feature no spec (`FeatureEntity.spec` is null), so the brief would have no scenarios
  and no contract.
- S-009.8.1 and S-009.8.2 compare stdout with `taskBrief(…)` for the same project instead of a
  second copy of the example brief, on a shorter copy of the example project (no S-001.1.3, no
  Config section). S-009.7.1 checks the example brief exactly.
- When a task covers no scenario, the test-name rule names the literal `S-NNN.1.1`, as
  contract.md writes it, not an ID with the feature's number.
- `git add` runs with `--literal-pathspecs`, so a path holding `*` or `[` stages that file and
  never what it would match as a pattern. contract.md names a plain `git add -A -- <staged>`.
- Messages contract.md doesn't list: the check step fails with `git diff failed (exit <n>)` when
  it can't list the staged paths, and the stage step with `git status failed (exit <n>)`, each
  with git's output tail. `finishTask` and `taskBrief` throw `AzimuthError("invalid", "<ID> is
  not a task ID.")` for an ID that isn't a task's, which the CLI already refuses as a usage
  error.
- A step's output is filled only when the step failed. contract.md's step table gives a passing
  verify the run's `output_tail` and a commit git's output, but its CLI examples print those
  steps as one line each, which the empty output keeps.
- S-009.4.3's test was corrected to expect five later steps (stage, commit, verify, done, log)
  as not-run: without a note, `FinishResult.steps` has no note step.
- `task finish` doesn't print the `waited Ns for another verify` line that `azimuth verify`
  prints, because `finishTask` doesn't pass `onProgress` to `verifyBatch`. A finish that waited
  for another lane's verify shows no sign of it.

Otherwise the files match `impact.md`.

## Follow-ups
- BUG-0074: `task finish` can't be rerun after a verify that failed for reasons outside the task.
- BUG-0075: `task finish` doesn't say it is waiting for another verify.
