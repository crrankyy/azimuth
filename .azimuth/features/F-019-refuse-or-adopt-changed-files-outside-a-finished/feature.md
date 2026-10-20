---
id: F-019
title: Refuse or adopt changed files outside a finished task
summary: task finish refuses, before it writes anything, an unlisted changed test that adds a marker for a scenario the task covers or an unlisted impact path no other task lists; --adopt adds such files to the task and commits them; the output separates source files, other tasks' files and records, and warns when a shared file carries another task's work.
status: draft
priority: P0
size: M
mode: brownfield
milestone: M-02
depends_on: []
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
---
# F-019: Refuse or adopt changed files outside a finished task

## Objective
In the ZenithMD run on 0.2, a lane added a test to `tests/keymap.rs`. The test proved a scenario
of its task, but the task's `files` didn't list that file. `azimuth task finish` committed
without it and printed it inside a 20-item `not staged:` line, between `.azimuth/` records and
other lanes' files. `trace` then credited the scenario from the working tree, and the feature
could reach done with a proving test that was never committed (GitHub #2, report §4.4). The
`files` list is a prediction: it drifted on 5 of 14 tasks (§4.3). Each drift cost a plan.md
edit, a docs commit and a reapprove before finish would stage the file. §5.2 and §5.4 suggest a
refusal, `--adopt`, a split output and a shared-file warning.

`azimuth task finish` changes in four ways:

- **The check step refuses**, before the note step, so a refusal writes nothing. It refuses
  when a changed path (git status, untracked included) lies outside the task's `files` and
  outside the feature's folder, and either:
  - **(a)** it matches `tests.globs`, and its working copy holds a marker for a scenario the
    task covers that HEAD's copy doesn't hold (`scanTestFile` on both); or
  - **(b)** it is a create, modify or test path in the feature's impact.md, and no other
    in-progress task (of any feature) lists it.

  The refusal names each file and why. It says how to proceed: adopt the file into the task
  whose lane changed it, or commit or revert it.
- **`--adopt <path,…>`** adds changed paths to the task's `files` in plan.md and stages them
  with the rest. plan.md isn't in the spec hash, so no reapprove is needed. It refuses a path
  that isn't changed, or that another in-progress task lists.
- **"Not staged" splits** into three lines: source files no in-progress task lists, other
  in-progress tasks' files, and `.azimuth/` records. The JSON keeps `not_staged` and adds the
  three lists.
- **A warning line** follows the stage step for each staged path that matches
  `parallel.shared_files` and that another in-progress task also lists: that commit carries
  the other lane's unfinished insertion and may not build on its own.

The build skill explains how to read the refusal and when to use `--adopt`. `docs/cli.md` and
the azimuth skill's CLI table describe the new option and output.

## Out of scope
- Reading the verify command to find the files it runs, such as `--test keymap` ⇒
  `tests/keymap.rs` (#2's suggestion). Rules (a) and (b) decide instead.
- Marking tests credited from uncommitted files in `trace`, and having the done gate refuse
  them. That is F-020.
- Hunk staging of shared files (§5.4's first half). A shared file is still staged whole; F-019
  only warns.
- An override flag such as `--allow-unlisted`, removing paths from a task's `files`, and
  adopting a path into a task other than the one being finished.
- The verify step's line, the prebuild and the disk warning (F-018), and the brief's request to
  report files changed outside the list (F-022).
- `docs/concepts.md`, `src/core/protocol.ts` and the viewer. `selectPaths` and the "Already
  staged" rule keep their behaviour, except that adopted paths count as the task's files.

## Integration points
- `src/core/finish.ts` (F-009), shared with F-018, which later changes the verify step's line
  and adds a disk warning. F-019 changes only these parts:
  - `check`: reads git status, validates `--adopt` and refuses unlisted files;
  - the step list: a new `adopt` step between `check` and `note`;
  - the stage step's path lists;
  - `FinishOptions`, `FinishResult` and `FinishStepName`;
  - the new pure helpers `unlistedFiles`, `splitNotStaged` and `sharedStaged`.

  `porcelainPaths` and `selectPaths` are reused unchanged.
- `scanTestFile` (`src/core/trace.ts`, read only; F-020 changes other parts of that file) scans
  the working copy and HEAD's copy of a changed test file. HEAD's copy comes from `readBlobs`
  (`src/core/git.ts`). `tests.globs` is matched with a new `testFileMatcher` in
  `src/core/glob.ts`, which holds once the `!`-exclusion rule `traceTests` applies inline.
  `traceTests` isn't switched to it here; a later cleanup can do that.
- `runScope` and `inScope` (`src/core/run-scope.ts`) decide whether a path is a task's or lies
  under an impact path. They are the same rules `selectPaths` already uses.
- The adopt step writes plan.md the way `moveTask` (`src/core/transitions.ts`) does:
  `updateFrontmatterItem` (`src/core/frontmatter.ts`) inside `withLock`, saved with
  `writeFileAtomic` (`src/core/lock.ts`). `transitions.ts` itself doesn't change.
- `config.tests.globs` and `config.parallel.shared_files` (`src/core/config.ts`) are read from
  the model that the check step's `analyzeProject` returns.
- `src/cli/commands/task.ts` gets:
  - the `--adopt` option;
  - the adopt step's line;
  - three "not staged" lines and the warning lines in `finishLines`.

  F-018 may also change this file's verify line.
- Docs and skills, each shared with other 0.3 features:
  - `docs/cli.md` "Finish a task" (F-018 changes its verify step);
  - `plugin/skills/build/SKILL.md` step 4.4 and "Delegating to subagents" (F-018 adds the
    early-finish rule there, F-024 its plan.md wording);
  - `plugin/skills/azimuth/SKILL.md`, the CLI table row for `task finish`.

## Invariants
- A check that fails writes nothing. No notes.md, plan.md or log.md is written. Nothing is
  staged or committed, and no run is recorded. This holds for the new refusals and for an
  invalid `--adopt`.
- finish stages only the task's files (adopted paths included) and the feature's records, as
  before. A refused or not-staged path is never staged.
- `--adopt` only appends paths to the finished task's `files`. It never removes or reorders an
  entry, and never changes another task or any other plan.md field.
- Adopting never makes the approval stale. plan.md is outside the spec hash.
- `not_staged` keeps its meaning (every changed path left out, sorted). The three new lists
  split it without overlap.
- The shared-file warning never fails a step or changes the exit code.
- F-009's existing output stays as it was. The `  not staged:` line keeps its label (it now
  lists only the source files no in-progress task lists). Every existing `--json` field keeps
  its name and meaning. The exit codes don't change.

## Assumptions
- The check step keeps its earlier parts and then runs these, in order:
  1. read `git status --porcelain=v1 -z --untracked-files=all` (paths through `porcelainPaths`,
     as the stage step reads them);
  2. validate `--adopt`;
  3. refuse anything already staged outside the set, counting adopted paths as the task's;
  4. refuse unlisted files.

  If git status fails, the check fails with the stage step's wording,
  `git status failed (exit N)`, and git's output tail.
- Rule (a):
  - A path matches `tests.globs` as `traceTests` matches it: some include glob matches and no
    `!` glob does (`testFileMatcher`).
  - Markers are the references `scanTestFile` returns with `confidence: "marker"`. A
    mention-only fallback doesn't count, since `trace` hides those too.
  - Markers are compared by scenario ID. A test file that already held a marker for S-001.1.2
    at HEAD and gains a second one is not refused.
  - A working copy that doesn't exist (a deleted file) holds no markers. A HEAD copy that
    doesn't exist (an untracked file, the new path of a rename, a repository without commits)
    holds none either, so every marker of its working copy is new.
  - A rename is judged as its two paths: the new path by the rule above, the old one as a
    deleted file.
- Rule (b):
  - The impact entries counted are `create`, `modify` and `test`. A path matches when it
    equals one of them or lies under it, after removing a leading `./` and a trailing `/` (as
    `runScope`).
  - A task "lists" a path when the path equals one of its `files` or lies under one
    (`runScope(task, { impact: [] }, [], [])` and `inScope`, as `selectPaths`).
  - "In progress" is the task's own status, in any feature, excluding the task being finished.
    A todo, blocked or done task doesn't claim a path.
- When both rules apply to one path, the refusal shows rule (a)'s reason. The refusal lists
  files sorted by path.
- `--adopt`:
  - Each path is trimmed and loses a leading `./` and a trailing `/`. Empty entries are
    dropped, and a path given twice counts once.
  - A path that is already the task's (it is listed, lies under a listed directory, or lies in
    the feature's folder) is accepted whether or not it changed, and is not written again. A
    rerun of the same command is therefore safe.
  - Any other path must be exactly a path git status lists. A directory is refused as
    unchanged, so adopting it can't sweep in another lane's files.
  - A path that another in-progress task lists is refused. The message names the first such
    task, by feature ID and then plan order.
  - Every invalid path is named, in the order given, and the sentences are joined by a space.
- The adopt step runs right after the check and before the note. It appends the new paths, in
  the order given, after the task's existing `files`. It does so inside the project lock, by
  re-reading plan.md and applying `updateFrontmatterItem` with `{ files }`, as `moveTask` does,
  so the line is rewritten in flow style. It writes no log entry and doesn't touch feature.md's
  `updated`; the commit shows the change.
- When a step after the adopt step fails, plan.md keeps the adopted paths, since they are the
  task's files from then on. The stage step commits plan.md with the feature's records. Unlike
  `--note`, `--adopt` may be repeated on the rerun: the paths are now listed, so they are
  accepted. When the adopt step itself fails (an AzimuthError from the writer), it has written
  nothing.
- The adopt step comes before the note step. A failed note then leaves a plan.md that a rerun
  of the same command accepts, whereas a failed adopt after a written note would force a rerun
  without `--note`.
- Not staged splits as follows, from the model the check read:
  - paths under `.azimuth/` are records;
  - paths that another in-progress task lists are that task's;
  - everything else is outside every in-progress task.

  Each list is sorted, and they are filled whenever `not_staged` is. The text output prints
  only non-empty lines, in this order:
  - `  not staged: <paths>` (the outside list, keeping F-009's label);
  - `  not staged, other in-progress tasks: <paths>`;
  - `  not staged, records: <paths>`.
- The shared-file warning covers staged paths that match `parallel.shared_files`
  (`globToRegExp`, matched as written) and that another in-progress task lists. The tasks keep
  the model's order (features by ID, tasks in plan order). Each warning is printed after the
  "not staged" lines as
  `  warning: <path> carries <T>'s work in progress; this commit may not build on its own.`
  Several tasks read `T-001.2's and T-002.1's`. The JSON gives `shared: [{ path, tasks }]`.
- On the command line, `--adopt` is one string option holding a comma-separated list, as
  `session start --touch` is. A list that is empty after trimming is a usage error (exit 2). A
  refused check still exits 1.
- The project root is the repository root, as in F-009, since porcelain paths are relative to
  the repository root.
