---
id: F-020
title: Credit only committed tests at the done gate
summary: A test whose scenario marker is only in the working tree is marked uncommitted in trace and the viewer, and the done gate doesn't count it.
status: verifying
priority: P0
size: M
mode: brownfield
milestone: M-02
depends_on: []
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
approved_at: 2026-10-20
approved_by: agent
approved_hash: sha256:e17dad2911d273a3dc2ae3cfae625caae09da9d54a67e02c8b497388b306c016
approved_commit: 1dc7001
review_ack_at: null
---
# F-020: Credit only committed tests at the done gate

## Objective
In the second ZenithMD run a lane added a test for S-055.3.1 to `tests/keymap.rs`, a file its
task didn't list; `task finish` committed without it, `azimuth trace F-055` credited the scenario
from the working tree and the done gate was green (GitHub #2, experience report §4.4 and §5.3).
A feature could reach done with a scenario proven by a test that isn't in the repository.
F-019 closes the `task finish` half; F-020 makes trace, the viewer and the done gate tell a
committed test from one that is only in the working tree:

- When the analysis gathers its facts, the one `git status` call of `gitFacts` becomes
  `git status --porcelain -z --untracked-files=all`, and `GitFacts.changed` lists the paths it
  names (modified, added, deleted, unmerged and untracked). `markCommitted` then checks only the
  traced test files among them: it reads HEAD's copies with one `readBlobs` call, scans them with
  `scanTestFile`, and gives a ref `committed: false` when HEAD's scan has no ref with the same
  scenario ID and name. Every other ref is committed, and clean files cost no git read.
- Coverage still shows such a scenario as passing. Each of its tests carries `committed` in the
  index (`ScenarioTest`), `azimuth trace` prints `(uncommitted)` after the test and `--json`
  gives every test `committed`. The viewer's Stories tab and Verification table tag the test
  `uncommitted`.
- `done.scenarios-passing` counts a passing scenario only when one of the tests that count for
  it is committed: its marked tests (`confidence: "marker"`) when it has any, else its mentions.
  A committed comment that mentions the scenario can't stand in for its uncommitted marked test.
  The detail names each scenario it leaves out with the uncommitted files of those tests:
  `1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts`.

## Out of scope
- `task finish` (refusing or adopting unlisted files, its `not staged` lines): F-019.
- How verify runs credit tests: `verify.ts` keeps calling `traceTests` and runs record scenario
  results as today, whether a test is committed or not.
- The coverage counts (`FeatureDerived.coverage`, the coverage bars, the Verification summary
  cards and filters): a scenario with only uncommitted tests stays `passing` there.
- A count of uncommitted tests in `status`, `show --brief` beyond the gate line, `next` or the
  inbox, and any new check warning.
- Marking a test whose body changed while its marker and name are still in HEAD (it counts as
  committed), and tests in files that `tests.globs` doesn't match.
- Projects whose root is a subdirectory of the git repository (see Assumptions).
- The other done checks (`done.verify-passed`: F-018; `done.as-built`: F-021).

## Integration points
- `src/core/git.ts`: `gitFacts` replaces its `status --porcelain --untracked-files=no` call with
  `status --porcelain -z --untracked-files=all` and parses it into `changed` and `dirty`.
  `readBlobs` reads HEAD's copies for `markCommitted`. `finish.ts` has its own private
  `porcelainPaths`; it imports `git.ts`, so `git.ts` can't import it back, and F-019 owns
  `finish.ts`.
- `src/core/facts.ts`: `GitFacts.changed`, `emptyGitFacts` (`changed: []`) and
  `TestRef.committed`.
- `src/core/trace.ts`: new `markCommitted` beside `traceTests`, reusing `scanTestFile`.
  `scanTestFile` and `traceTests` keep their signatures and output; F-019 calls `scanTestFile`.
- `src/core/build-index.ts`: `analyzeProject` passes `traceTests`' map through `markCommitted`
  with `facts.git.changed` (null without git). `buildIndex`, `moveFeature` and every other caller
  of `analyzeProject` get the marked refs.
- `src/core/derive.ts`: `coverageOf` copies `committed` onto each `ScenarioTest`.
- `src/core/gates.ts` (shared with F-018, F-021 and F-023): only the `done.scenarios-passing`
  check of `doneGate` changes, moved into a function of its own.
- `src/core/types.ts` (shared with F-018): `ScenarioTest.committed`.
- `src/cli/commands/read.ts`: the `trace` command's test lines.
- Viewer: `viewer/src/screens/feature/StoriesTab.tsx` (`ScenarioCard`, `TestRow`) and
  `viewer/src/screens/Verification.tsx` (`ScenarioRow`, now exported for its test), styled in
  `feature.css` and `verification.css` with the `az-tag` primitive and the warning tokens
  (`--label-yellow`, `--st-warning-border`).
- `src/server/export.ts` copies the index as is, so exports carry `committed` without a change.
- Docs and skills: `docs/cli.md` (the trace row), `docs/concepts.md` (the done gate and
  traceability) and `plugin/skills/verify/SKILL.md` (step 3), all shared with other 0.3
  features.

## Invariants
- A ref is uncommitted only when its file is in `GitFacts.changed` and HEAD's copy of that file
  has no ref with the same scenario ID and name. A file not in `changed` is never read from git.
- One analysis runs one `git status` and at most one `git cat-file --batch` for test files, and
  none when no traced test file is changed.
- `markCommitted` returns new ref objects and never mutates the refs it is given, which
  `traceTests`' scan cache holds.
- `scanTestFile`, `traceTests` and verify runs behave as before. Coverage statuses and counts
  don't change.
- `GitFacts.dirty` keeps its meaning: a tracked file differs from HEAD, staged or not. Untracked
  files don't make the tree dirty.
- `done.scenarios-passing` keeps its id, its rule text and its `<counted> of <total>` detail,
  which it carries whether it passes or fails. With every test committed it gives the same
  result as before.

## Assumptions
- Without git (`GitFacts.available` false) there is no HEAD to compare against, so every ref
  counts as committed: trace and the viewer mark nothing and the done gate counts scenarios as
  before. A git repository without commits has no HEAD copy of any file, so each test in a
  changed file is uncommitted there.
- `changed` holds every path the status call names, sorted: a modified, added, deleted or
  unmerged file, an untracked file (each file of an untracked directory, through
  `--untracked-files=all`) and a rename's or copy's new path. Ignored files never appear. When
  the status call fails, `changed` is `[]` and `dirty` false, as today.
- Like F-006 and F-009, the project root is the repository root: porcelain paths and `HEAD:<path>`
  are relative to the repository root, `traceTests`' paths to the project root.
- `--untracked-files=all` walks untracked directories, as `traceTests`' own
  `git ls-files --others --exclude-standard` already does, so the analysis gets no new kind of
  cost.
- A ref and HEAD's ref match on the scenario ID and the name `scanTestFile` gives (a title, a
  function name or a mention's line). A test whose title or function name changed in the working
  tree is uncommitted until the change is committed.
- The tests that count for a scenario at the gate are its marker references when it has at
  least one; mentions (`confidence: "fallback"`) count only for a scenario that has no marker
  reference at all, as they do for coverage today. A passing scenario is counted when one of the
  tests that count for it is committed, so a committed comment listing scenario IDs never stands
  in for an uncommitted marked test (the #2 shape again). Each test of a scenario has the
  scenario's status, so "its passing tests" are all its tests when the scenario passes.
- The gate detail lists the scenarios it leaves out in stories.md order, each with the files of
  its uncommitted tests among those that count, unique and sorted, joined by `, `; scenarios are
  separated by `; `. A failing, not-run or untested scenario isn't named there.
- `TestRef.committed` is optional so that refs built without git facts (`scanTestFile`,
  `traceTests`, test fixtures) need no value; a ref without it counts as committed.
  `ScenarioTest.committed` is always present in the index and in `trace --json`.
- trace prints ` (uncommitted)` after the name, after ` (mention)` when both apply. The marks
  aren't coloured differently from the dim test line, and the scenario's own line doesn't change.
- In the viewer a test is tagged whenever it is uncommitted, even when another committed test
  already lets the done gate count the scenario. A scenario card with an uncommitted test opens
  its test list on first render, as a failing one does, and its chip adds `· <n> uncommitted`.
- HEAD's scans aren't cached: when a test file is changed, every analysis (each viewer refresh
  included) runs one `git cat-file --batch` for the changed test files.
