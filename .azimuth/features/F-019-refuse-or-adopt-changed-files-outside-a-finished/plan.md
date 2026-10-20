---
tasks:
  - id: T-019.1
    title: testFileMatcher, unlistedFiles, splitNotStaged and sharedStaged (red → green)
    status: done
    after: []
    covers: [S-019.1.1, S-019.1.2, S-019.1.3, S-019.2.1, S-019.2.2, S-019.2.3, S-019.2.4]
    files: [src/core/glob.ts, test/core/glob.test.ts, src/core/finish.ts, test/core/finish.test.ts]
    verify: pnpm exec vitest run test/core/glob.test.ts test/core/finish.test.ts -t "S-019.1|S-019.2" --reporter=verbose
    note: null
  - id: T-019.2
    title: The check refuses unlisted files; the result splits not staged (red → green)
    status: done
    after: [T-019.1]
    covers: [S-019.3.1, S-019.3.2, S-019.3.3, S-019.3.4]
    files: [src/core/finish.ts, test/core/finish.test.ts]
    verify: pnpm exec vitest run test/core/finish.test.ts --reporter=verbose
    note: null
  - id: T-019.3
    title: The adopt option and step (red → green)
    status: done
    after: [T-019.2]
    covers: [S-019.4.1, S-019.4.2, S-019.4.3, S-019.4.4, S-019.4.5, S-019.4.6]
    files: [src/core/finish.ts, test/core/finish.test.ts, src/core/run-scope.ts]
    verify: pnpm exec vitest run test/core/finish.test.ts --reporter=verbose
    note: null
  - id: T-019.4
    title: task finish --adopt, the split lines and the warning on the command line (red → green)
    status: done
    after: [T-019.3]
    covers: [S-019.5.1, S-019.5.2, S-019.5.3, S-019.5.4, S-019.5.5]
    files: [src/cli/commands/task.ts, test/cli/task.test.ts]
    verify: pnpm exec vitest run test/cli/task.test.ts --reporter=verbose
    note: null
  - id: T-019.5
    title: CLI docs, build and azimuth skills, and full verification
    status: done
    after: [T-019.4]
    covers: []
    files: [docs/cli.md, plugin/skills/build/SKILL.md, plugin/skills/azimuth/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-019: Plan

The plan is test-first and a single chain. Every code change is in `src/core/finish.ts`, and the
command line in `src/cli/commands/task.ts` depends on the new options and result fields, so no
two slices can run in parallel.

1. T-019.1 writes `testFileMatcher` in `glob.ts` (its test in a new `test/core/glob.test.ts`)
   and the three pure helpers in `finish.ts`, with their unit tests and no git.
2. T-019.2 wires `unlistedFiles` into the check step, and `splitNotStaged` and `sharedStaged`
   into the stage step, against real git. The warning's wiring is tested end to end by
   T-019.4's S-019.5.3 and S-019.5.4.
3. T-019.3 adds `FinishOptions.adopt`, its checks and the adopt step.
4. T-019.4 adds the option and the output lines.
5. T-019.5 updates the docs and the skills, then runs everything.

T-019.2 and T-019.3 run the whole `finish.test.ts`, so F-009's scenarios prove that the check's
new git status read changes nothing for them.

## Notes for builders

- **Keep F-009's tests unchanged.** S-009.6.1 expects `  not staged: src/other.ts`, which is
  why the outside list keeps that label. S-009.6.3 uses `toMatchObject`, so the new JSON fields
  don't break it.
- **Shared files.** `finish.ts` is shared with F-018, which later changes `verifyOutcome`, the
  verify step's line and the disk warning. Stay within `check`, the step list, the stage
  step's lists, the adopt step, the types and the new helpers. Keep `selectPaths` and
  `porcelainPaths` as they are.
- **Reuse, don't reimplement:**
  - `scanTestFile` (`trace.ts`, unchanged): keep only `confidence: "marker"` references.
  - `runScope` and `inScope` (`run-scope.ts`): for "a task lists it" and "under an impact
    entry". For the impact rule, `runScope({ files: [] }, { impact }, [], [])` gives the
    normalized create, modify and test paths.
  - `globToRegExp` and `matchesAny` (`glob.ts`), and `AZ_DIR` (`paths.ts`).
  - `readBlobs` (`git.ts`): read HEAD's copies in one call over the candidate test paths.
  - `parsePlan` (`parse/feature.ts`).

  `traceTests` splits `tests.globs` into include and `!` exclude lists inline. Put that rule
  once in `glob.ts` as `testFileMatcher` and use it in `finish.ts`. `glob.ts` must keep
  importing no Node module. Leave `trace.ts` alone, since F-020 owns it; a later cleanup can
  switch `traceTests` to the helper. No other 0.3 feature edits `glob.ts`.
- **The adopt step's writer** follows `moveTask` (`transitions.ts`): `withLock(root, …)`, read
  plan.md, `updateFrontmatterItem(text, "tasks", (item) => item.id === taskId, { files })`, a
  `not-found` AzimuthError when that returns null (`<T-ID> is not in <plan>.`), then
  `writeFileAtomic`. Inside the lock, read the current `files` from the fresh text with
  `parsePlan`. Keep the writer private to `finish.ts`; `transitions.ts` doesn't change.
- **Tests** reuse the `repo()` helper of each test file. Add options for:
  - the impact entries (`featureFiles` takes `impact`);
  - extra HEAD files (`src/c.ts`, `test/keymap.test.ts`, `src/registry.ts`, `src/b.ts`);
  - a second feature, `featureFiles({ id: "F-002", slug: "more", status: "in-progress", tasks:
    […] })`;
  - config additions (`parallel:\n  shared_files: [src/registry.ts]\n` after `MINIMAL_CONFIG`).

  Keep the defaults F-009's scenarios use. Every scenario of F-001 and F-002 must stay covered
  by a task, since an uncovered scenario of an in-progress feature is an error and fails the
  check. "Gained an entry" appends a well-formed log entry
  (`\n## 2026-10-20T09:00:00Z · agent · note\nLane note.\n`).
- **Commands the tests use:**
  - "Byte-identical to HEAD's copy" compares `readFileSync` with `git show HEAD:<path>`, read
    raw as `gitRaw` does.
  - "T-001.1's `files` in HEAD's plan.md" is `parsePlan` over `git show HEAD:<plan>`.
  - S-019.4.2 moves the file with `renameSync`, not `git mv`. A staged rename would be refused
    by F-009's "Already staged" check first.
- **CLI:**
  - `--adopt` is `{ type: "string" }`, split on commas, trimmed and filtered, as `--touch` is in
    `work.ts`. A value given but empty after that throws the UsageError before `runtime()`.
  - `finishLines` prints the three lines and the warnings in place of today's single
    `not staged:` line, right after the stage step's line.

## T-019.5: docs and skills

### `docs/cli.md`, "Finish a task"

- Update the synopsis to `[--adopt <path,…>]`.
- Step 1 (check): add the git status read, the `--adopt` checks and the unlisted-file refusal,
  covering rules (a) and (b), what "in progress" and "lists" mean, and the message.
- Add a new step 2, **adopt**: it appends to the task's `files` in plan.md before the note, and
  plan.md isn't in the spec hash, so no reapprove is needed. Renumber the steps after it.
- Step 3 (stage): describe the three "not staged" lines.
- Add the warning line.
- Extend the example output with an adopt line, the split lines and a warning.
- Add the new `--json` fields.
- Add a usage-error bullet for an empty `--adopt`.
- In the rerun paragraph, say that `--adopt` may be repeated and the paths stay in plan.md.

### `plugin/skills/build/SKILL.md`

- Step 4.4: replace "`not staged:` lists changed files it left out." with how to read a ✗ check
  that names files outside the task. For each file:
  - this task's lane changed it: rerun with `--adopt <path,…>`, with no plan.md edit and no
    reapprove;
  - another lane changed it: finish that task first, with `--adopt` if it doesn't list the
    file;
  - neither: commit it with a `Refs:` trailer or revert it.

  Then say what the three "not staged" lines mean: read `not staged:` after every finish. The
  `warning:` line means the shared file's commit holds another lane's insertion.
- "Delegating to subagents", the bullet "Then finish the batch one task at a time": a
  `warning:` line means that lane's task should be finished next.

### `plugin/skills/azimuth/SKILL.md`

- The `task finish` row reads
  `azimuth task finish <T-ID> --commit "<message>" [--note "<text>"] [--adopt <path,…>]`, and
  its description mentions adopting changed files. Run Prettier on the table.

## Files shared with other 0.3 features

These are expected `W-FILE-CONFLICT` warnings, merged by hunk:

- `src/core/finish.ts`: F-018 changes the verify line, `verifyOutcome` and adds a disk warning.
- `src/cli/commands/task.ts`: F-018 may change the verify line's printing.
- `docs/cli.md`: F-018, F-021 and F-024.
- `plugin/skills/build/SKILL.md`: F-018 (the early-finish rule), F-022 and F-024.
- `plugin/skills/azimuth/SKILL.md`: F-021 and F-024.

F-019 only reads `trace.ts`, which F-020 changes.
