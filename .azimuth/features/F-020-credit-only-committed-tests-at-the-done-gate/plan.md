---
tasks:
  - id: T-020.1
    title: The committed field in the facts, the index and the fixtures that describe it
    status: todo
    after: []
    covers: []
    files: [src/core/facts.ts, src/core/types.ts, src/core/derive.ts, src/core/git.ts, src/core/trace.ts, test/fixtures/hookline/expected-index.ts, test/cli/trace.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/golden/index.test.ts test/cli/trace.test.ts --reporter=verbose
    note: null
  - id: T-020.2
    title: One status call lists the changed paths (red → green)
    status: todo
    after: [T-020.1]
    covers: [S-020.1.1, S-020.1.2, S-020.1.3, S-020.1.4]
    files: [src/core/git.ts, test/core/git-trace.test.ts]
    verify: pnpm exec vitest run test/core/git-trace.test.ts -t "S-020.1|gitFacts" --reporter=verbose
    note: null
  - id: T-020.3
    title: markCommitted compares changed test files with HEAD (red → green)
    status: todo
    after: [T-020.1]
    covers: [S-020.2.1, S-020.2.2, S-020.2.3, S-020.2.4, S-020.2.5]
    files: [src/core/trace.ts, test/core/committed-tests.test.ts]
    verify: pnpm exec vitest run test/core/committed-tests.test.ts -t "S-020.2" --reporter=verbose
    note: null
  - id: T-020.4
    title: The analysis marks its refs and the done gate counts committed tests (red → green)
    status: todo
    after: [T-020.2, T-020.3]
    covers: [S-020.4.1, S-020.4.2, S-020.4.3, S-020.4.4, S-020.4.5, S-020.4.6, S-020.4.7, S-020.4.8]
    files: [src/core/build-index.ts, src/core/gates.ts, test/core/committed-tests.test.ts]
    verify: pnpm exec vitest run test/core/committed-tests.test.ts test/core/git-trace.test.ts test/golden/index.test.ts -t "S-020|S-002.3|matches the sample" --reporter=verbose
    note: null
  - id: T-020.5
    title: trace marks a test only in the working tree (red → green)
    status: todo
    after: [T-020.4]
    covers: [S-020.3.1, S-020.3.2, S-020.3.3, S-020.3.4, S-020.3.5]
    files: [src/cli/commands/read.ts, test/cli/trace.test.ts]
    verify: pnpm exec vitest run test/cli/trace.test.ts -t "S-020.3|S-013.2" --reporter=verbose
    note: null
  - id: T-020.6
    title: The viewer tags an uncommitted test (red → green)
    status: todo
    after: [T-020.1]
    covers: [S-020.5.1, S-020.5.2, S-020.5.3, S-020.5.4]
    files: [viewer/src/screens/feature/StoriesTab.tsx, viewer/src/screens/Verification.tsx, viewer/src/screens/feature/feature.css, viewer/src/screens/verification.css, viewer/src/screens/feature/StoriesTab.test.tsx, viewer/src/screens/Verification.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/feature/StoriesTab.test.tsx viewer/src/screens/Verification.test.tsx -t "S-020.5|S-008.11" --reporter=verbose
    note: null
  - id: T-020.7
    title: Docs, the verify skill and full verification
    status: todo
    after: [T-020.5, T-020.6]
    covers: []
    files: [docs/cli.md, docs/concepts.md, plugin/skills/verify/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-020: Plan

Test-first. F-020 depends on no other feature.

T-020.1 lays down the types and carries the new field through coverage, so everything after it
compiles against the final shapes:

- `facts.ts`: `GitFacts.changed`, `emptyGitFacts()` with `changed: []`, optional
  `TestRef.committed`.
- `types.ts`: `ScenarioTest.committed`. `coverageOf` (`derive.ts`) sets it to
  `ref.committed !== false`, so every test is committed until T-020.4 wires `markCommitted` in.
- `git.ts`: `gitFacts` returns `changed: []` for now; `trace.ts`: `markCommitted` with its
  signature and a placeholder body that T-020.3 replaces (nothing calls it yet).
- The two tests that assert a scenario's tests exactly gain `committed: true`: the five entries
  of `test/fixtures/hookline/expected-index.ts` (it `satisfies Index`, so the type needs the
  field; the replayed Hookline repository leaves only `.azimuth/` files changed, so its tests are
  all committed) and S-013.2.4's expected JSON in `test/cli/trace.test.ts`. Its verify runs both
  to show nothing else moved.

After it, three slices touch separate files and can be built at the same time: T-020.2
(`git.ts`), T-020.3 (`trace.ts`) and T-020.6 (the viewer). T-020.4 wires the first two into
`analyzeProject` and the done gate, T-020.5 prints the mark in trace, and T-020.7 updates the
docs and runs everything.

Notes for builders:

- Test repositories: `writeTree` with `featureFiles`, a `.gitignore` holding `.azimuth/cache/`,
  then `initRepo` and `commitAll` (`test/helpers/git.ts`, which isolates git from the developer's
  configuration). For "the #2 change", write the extra line after the last commit; to stage a
  file without committing it (S-020.1.1), use the helper `git(root, ["add", path])`. Runs are
  written to `.azimuth/cache/runs/R-0001.json` as in `test/core/git-trace.test.ts`.
- "The close-out repository" follows the "close-out in its natural order" helper in
  `test/core/git-trace.test.ts`: a start commit, a commit changing `src/app.ts` with
  `Refs: T-001.1`, R-0001 at that commit listing both scenarios `passing`, then a close-out commit
  with `as-built.md` and `reconciled_at` set to the build commit. Put a helper for it in
  `test/core/committed-tests.test.ts` with a parameter for what the working tree adds, so the
  S-020.4 scenarios differ only there.
- S-020.4.1 calls `moveFeature` from `src/core/transitions.ts` and reads the thrown error as
  `test/core/transitions.test.ts` does. S-020.4.6 builds its `GateContext` without git, from
  `loadTree` and `makeFacts` (`test/helpers/project.ts`) with `derive` and `validate`, like the
  `analyze` helper of `test/core/analysis.test.ts`.
- S-020.2.5 proves "no git read" through a folder without git: a read of HEAD there returns null
  blobs, which would mark the ref uncommitted.
- `markCommitted` must build new ref objects (`{ ...ref, committed }`): the refs it receives sit
  in `traceTests`' scan cache, and S-020.2.1 checks they stay without the field.
- `gitFacts`: `finish.ts` parses the same `-z` format in its private `porcelainPaths`, but
  `finish.ts` imports `git.ts` (a cycle the other way) and F-019 is changing it, so `git.ts`
  parses the entries itself, keeping each entry's XY for `dirty`.
- T-020.4, `gates.ts`: move the inline `done.scenarios-passing` object of `doneGate` into a
  `scenariosPassing(ctx, f)` function above `doneGate` and drop the `info` and `cov` constants
  that only it used. F-018 (`done.verify-passed`), F-021 (`done.as-built`) and F-023
  (`approveGate`'s strict rule) change other parts of this file; touch nothing else.
- T-020.5: the test line becomes `    <file>: <name>` plus ` (mention)` for a fallback reference
  and ` (uncommitted)` when `committed` is false, the whole line dim as today.
- T-020.6: render `ScenarioCard` inside `IndexContext` as `StoriesTab.test.tsx` already does;
  `ScenarioRow` needs no context. `viewer/src/screens/Verification.test.tsx` is new. Style the
  tags in `feature.css` and `verification.css` with the existing `az-tag` class and the tokens
  `--label-yellow` and `--st-warning-border`; don't edit `azimuth.css`. After the build, the
  orchestrator checks the tag in the live viewer with a CDP screenshot.
- T-020.7:
  - `docs/cli.md`: the `azimuth trace` row says a test that is only in the working tree (its
    file modified or untracked, and HEAD's copy without that test) is marked `(uncommitted)`,
    that `--json` gives every test `committed`, and that the done gate doesn't count it.
  - `docs/concepts.md`: the verifying → done row says every scenario has a passing test that is
    committed; the Scenario → test bullet says `azimuth trace` marks a test only in the working
    tree.
  - `plugin/skills/verify/SKILL.md`, step 3: a test trace marks `(uncommitted)` doesn't count
    at the done gate; commit its file (with `Refs:`) first.

Files shared with other 0.3 features (merge by hunk; change only F-020's part):

- `src/core/gates.ts`: F-018, F-021, F-023 (see T-020.4).
- `src/core/types.ts`: F-018 adds the run's prebuild; F-020 adds `ScenarioTest.committed`.
- `docs/cli.md`: F-018, F-019, F-021, F-024; F-020 changes only the trace row.
- `docs/concepts.md`: F-020 changes the done row's scenarios clause and the Scenario → test
  bullet.
- `plugin/skills/verify/SKILL.md`: F-021 changes the as-built step; F-020 only step 3.
