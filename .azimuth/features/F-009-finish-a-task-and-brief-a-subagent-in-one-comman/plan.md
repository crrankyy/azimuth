---
tasks:
  - id: T-009.1
    title: Scaffolding, command wiring and the abortOnSignals export
    status: in-progress
    after: []
    covers: []
    files: [src/core/finish.ts, src/core/task-brief.ts, src/cli/commands/task.ts, src/cli/main.ts, src/cli/commands/work.ts]
    verify: pnpm typecheck
    note: null
  - id: T-009.2
    title: Refs trailer and path selection (red → green)
    status: in-progress
    after: [T-009.1]
    covers: [S-009.1.1, S-009.1.2, S-009.1.3, S-009.1.4, S-009.2.1, S-009.2.2, S-009.2.3]
    files: [src/core/finish.ts, test/core/finish.test.ts]
    verify: pnpm exec vitest run test/core/finish.test.ts -t "S-009.1|S-009.2" --reporter=verbose
    note: null
  - id: T-009.3
    title: finishTask against real git (red → green)
    status: in-progress
    after: [T-009.2]
    covers: [S-009.3.1, S-009.3.2, S-009.3.3, S-009.4.1, S-009.4.2, S-009.4.3, S-009.4.4, S-009.4.5, S-009.4.6, S-009.5.1, S-009.5.2, S-009.5.3, S-009.5.4]
    files: [src/core/finish.ts, test/core/finish.test.ts]
    verify: pnpm exec vitest run test/core/finish.test.ts -t "S-009.[345]" --reporter=verbose
    note: null
  - id: T-009.4
    title: The subagent brief (red → green)
    status: in-progress
    after: [T-009.1]
    covers: [S-009.7.1, S-009.7.2, S-009.7.3, S-009.7.4, S-009.7.5]
    files: [src/core/task-brief.ts, test/core/task-brief.test.ts]
    verify: pnpm exec vitest run test/core/task-brief.test.ts --reporter=verbose
    note: null
  - id: T-009.5
    title: task finish and brief on the command line (red → green)
    status: in-progress
    after: [T-009.3, T-009.4]
    covers: [S-009.6.1, S-009.6.2, S-009.6.3, S-009.6.4, S-009.8.1, S-009.8.2, S-009.8.3]
    files: [src/cli/commands/task.ts, test/cli/task.test.ts]
    verify: pnpm exec vitest run test/cli/task.test.ts --reporter=verbose
    note: null
  - id: T-009.6
    title: Build and azimuth skills, protocol, docs and full verification
    status: in-progress
    after: [T-009.5]
    covers: []
    files: [plugin/skills/build/SKILL.md, plugin/skills/azimuth/SKILL.md, src/core/protocol.ts, docs/cli.md, docs/concepts.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-009: Plan

Test-first. F-009 starts once F-008 is done (`depends_on`): it calls F-008's `addNote`
(`src/core/notes.ts`), `placeholderParts` (`src/core/placeholders.ts`) and `FeatureEntity.notes`
(`src/core/model.ts`). F-007's `verifyTargets` and `verifyBatch` are already committed. If F-008
was built with other names, use what it built and record the difference with `azimuth note`.

T-009.1 lays down `finish.ts` and `task-brief.ts` with their types and signatures (placeholder
bodies the next tasks replace), and `commands/task.ts` with both commands registered in
`COMMANDS` after `verify`: usage, options, argument checks (the usage errors of contract.md),
`runtime`, `recordInSession` and `abortOnSignals`, which `work.ts` now exports. Printing is
filled in by T-009.5.

After it, the finish slice (`finish.ts`) and the brief slice (T-009.4, `task-brief.ts`) touch
separate files and can be built in parallel. Within the finish slice, T-009.2 writes the pure
helpers `withRefsTrailer` and `selectPaths`; T-009.3 builds `finishTask` on them, step by step,
against real git. T-009.5 prints the steps and the brief on the command line, and T-009.6
changes the agent instructions and docs, then runs everything.

Notes for builders:

- `finishTask` runs git with the process environment, so every test that commits stubs the
  variables of `gitEnv()` in `test/helpers/git.ts` (`GIT_CONFIG_GLOBAL=/dev/null`,
  `GIT_CONFIG_NOSYSTEM=1`, author and committer name and email) with `vi.stubEnv`; otherwise the
  developer's global hooks or commit signing would run.
- Test repositories: `writeTree`/`featureFiles` (tasks with `files`, `covers` and `verify`), a
  `.gitignore` with `.azimuth/cache/`, then `initRepo` and `commitAll`. Every scenario of F-001
  must be covered by a task, since an uncovered scenario of an in-progress feature is an error and
  would fail the check step.
- S-009.4.6 writes `.git/hooks/pre-commit` with mode `0o755`. S-009.5.4 kills its `sleep 60`
  in `afterEach`, as `test/core/verify-batch.test.ts` does.
- "HEAD changes exactly" is `git show --name-only --format= HEAD`; "the last log.md entry" is
  the last entry `parseLog` reads.
- `test/cli/task.test.ts` runs the CLI in process with `runCli` from `test/helpers/cli.ts`; the
  session file of S-009.6.1 is committed with the rest of HEAD, so it isn't listed as not staged.
- T-009.6:
  - `plugin/skills/build/SKILL.md`: step 4 becomes move → build (yourself, or a subagent given
    `azimuth brief <T-ID>`) → `azimuth task finish <T-ID> --commit "feat(<F-ID>): <what>"
    [--note "<what it taught>"]`, which replaces the commit, verify, move and log steps. On a ✗
    line: fix the cause and run it again (without `--note` when the note step already ran); after
    a failed verify the commit stays and the fix goes in the next finish's commit. In
    "Delegating to subagents", the hand-off bullet passes `azimuth brief`'s output (adding only
    what the records don't hold), and the commit and batch-verify bullets become: once the whole
    batch has reported, finish its tasks one at a time; a shared file is committed whole with
    the first finished task that lists it.
  - `plugin/skills/azimuth/SKILL.md`: rows for `azimuth task finish` and `azimuth brief`.
  - `src/core/protocol.ts`: in "Sessions and progress", tasks are finished with
    `azimuth task finish`; in "Tests", it runs the verify command (instead of "After committing a
    task, run `azimuth verify`"); `azimuth brief` prints a subagent's prompt.
  - `docs/cli.md`: a "Finish a task" section after "Verify" (steps, what is staged, the Refs
    trailer, output lines, `--json`, exit codes, rerunning after a failure) and a Read-table row
    for `azimuth brief`.
  - `docs/concepts.md`: the task loop (`brief`, `task finish`, one task at a time after a
    batch, shared files staged whole) and the Task → commit bullet.

Files shared with other features in flight (merge by hunk; F-009 changes no other existing
source file, and only reads `transitions.ts`, `verify.ts`, `build-index.ts`, `model.ts`,
`git.ts` and `brief.ts`):

- F-008 (approved, built before F-009): `src/cli/main.ts` (F-008 adds `note` and `settle` after
  `log`; F-009 adds `task` and `brief` after `verify`), `plugin/skills/build/SKILL.md`,
  `plugin/skills/azimuth/SKILL.md`, `src/core/protocol.ts`, `docs/cli.md`, `docs/concepts.md`.
- F-010 (approved): `plugin/skills/build/SKILL.md` (both change "Delegating to subagents": F-010
  the parallel rule for shared files, F-009 the hand-off and the batch finish), `docs/cli.md`,
  `docs/concepts.md`. F-009 needs no F-010 code.
- F-011 (being specified; from its draft impact map): `src/cli/commands/work.ts` (F-011 changes
  the `session` command, F-009 only exports `abortOnSignals`), `plugin/skills/build/SKILL.md`,
  `plugin/skills/azimuth/SKILL.md`, `src/core/protocol.ts`, `docs/cli.md`, `docs/concepts.md`.
- F-012 (being built): `src/core/protocol.ts`, `plugin/skills/azimuth/SKILL.md`, `docs/cli.md`
  and `docs/concepts.md` (its T-012.7). F-009 doesn't change `transitions.ts`, `write.ts`,
  `inbox.ts`, `delta.ts`, `next.ts`, `brief.ts`, `config.ts` or `types.ts`.
- F-007 (in progress, docs only): `src/cli/commands/work.ts`, `plugin/skills/build/SKILL.md`,
  `docs/cli.md`.
