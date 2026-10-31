---
tasks:
  - id: T-026.1
    title: W-MILESTONE-PLANNED in check (red → green)
    status: in-progress
    after: []
    covers: [S-026.2.1, S-026.2.2, S-026.2.3, S-026.2.4]
    files: [src/core/flows.ts, src/core/validate.ts, test/core/milestone-planned.test.ts, test/cli/milestone.test.ts]
    verify: pnpm exec vitest run test/core/milestone-planned.test.ts test/cli/milestone.test.ts -t "S-026.2" --reporter=verbose
    note: null
  - id: T-026.2
    title: A feature starting activates its planned milestone (red → green)
    status: in-progress
    after: []
    covers: [S-026.1.1, S-026.1.2, S-026.1.3, S-026.1.4, S-026.1.5, S-026.1.6, S-026.1.7, S-026.1.8]
    files: [src/core/transitions.ts, test/core/milestone-activation.test.ts, test/cli/milestone-activation.test.ts, test/server/actions.test.ts]
    verify: pnpm exec vitest run test/core/milestone-activation.test.ts test/cli/milestone-activation.test.ts test/server/actions.test.ts -t "S-026.1" --reporter=verbose
    note: null
  - id: T-026.3
    title: The milestone page in show (red → green)
    status: todo
    after: [T-026.1]
    covers: [S-026.3.1, S-026.3.2, S-026.3.3, S-026.3.4, S-026.3.5, S-026.3.6, S-026.4.1, S-026.4.2, S-026.4.3]
    files: [src/core/milestone-page.ts, src/core/next.ts, src/cli/commands/read.ts, test/core/milestone-page.test.ts, test/cli/milestone.test.ts]
    verify: pnpm exec vitest run test/core/milestone-page.test.ts test/cli/milestone.test.ts -t "S-026.[34]" --reporter=verbose
    note: null
  - id: T-026.4
    title: Docs, skill and full verification
    status: todo
    after: [T-026.2, T-026.3]
    covers: []
    files: [docs/cli.md, docs/concepts.md, docs/file-format.md, plugin/skills/azimuth/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-026: Plan

Test-first, in two lanes that start together: the warning, then the page (T-026.1 → T-026.3:
they share `test/cli/milestone.test.ts`, and the page needs `flows.ts`'s predicate), and the
activation in `transitions.ts` (T-026.2), which has its own files. No scaffolding task: each slice's types
live in its own file. T-026.4 changes the docs and the skill, then runs everything.

Notes for builders:

- T-026.1: in `flows.ts`, after `milestoneReady`, add `STARTED_STATUSES`, `startedCount` (sum of
  `progress.by_status[s] ?? 0` over them) and `milestoneStartedWhilePlanned` (status `planned`,
  `startedCount ≥ 1`, `!milestoneReady(m)`). In `validate.ts`, `milestoneProblems` maps each
  milestone (with `milestoneProgress` spread in) to the ready problem, else the planned one, else
  nothing (`flatMap`); keep the READY message as it is. The new message is in contract.md's
  Errors table. Tests: S-026.2.1 to S-026.2.3 go in the new `test/core/milestone-planned.test.ts`,
  built like `test/core/milestone-ready.test.ts` (`loadTree`, `makeFacts`, `validate`, `derive`,
  `buildIndex`, a `milestone(id, title, status, extra)` helper); S-026.2.4 goes in
  `test/cli/milestone.test.ts` with its `project` and `milestone` helpers. F-023's
  S-023.5.x tests must pass unchanged.
- T-026.2: in `moveFeature`, compute `const activation = to === "in-progress" ? milestoneActivation(root, model, f) : null`
  after the gate block (so a refusal throws first), add `activation.write` to the `save` list
  after the log write, and append `` ` (${activation.note})` `` to the message. The helper finds
  `model.milestones.find((m) => m.id === f.milestone)` and returns null unless its status is
  `planned`; it doesn't call `moveMilestone`. Tests:
  - `test/core/milestone-activation.test.ts` (S-026.1.1 to .5): `writeTree` with
    `MINIMAL_CONFIG`, `src/app.ts` and `featureFiles`; no git is needed, since a feature written
    approved has no `approved_hash` and passes `start.spec-unchanged`. Compare files with
    `readFileSync` before and after. F-001's last log entry comes from
    `loadProject(root).features[0].log.at(-1).body`. The dependency in S-026.1.4 is
    `extra: { milestone: "M-01", depends_on: "[F-002]" }`.
  - `test/cli/milestone-activation.test.ts` (S-026.1.6): `runCli` twice.
  - `test/server/actions.test.ts` (S-026.1.7, .8): `runAction` from `src/server/actions.ts`,
    called directly (no HTTP server), which acts as you with the real clock.
- T-026.3: export `next.ts`'s existing `byPriority` comparator (no other change to `next.ts`).
  `src/core/milestone-page.ts` imports only from `./flows`, `./next` (`byPriority`) and
  `./types`. `milestonePage` finds the milestone in `index.milestones`, takes
  `index.features.filter((f) => f.milestone === id)`, groups them by `PAGE_STATUS_ORDER`, sorts
  each group with `byPriority`, and maps each feature to `{ id, priority, title }`.
  `formatMilestonePage` runs `SECTIONS`, drops empty results and joins them with `"\n\n"`; `print`
  adds the final newline. Give F-028 room: new fields and section functions only, no
  other change. In `read.ts`'s `show`, after the `--json` branch and before `showBrief`:
  `if (!values.brief && idKind(id) === "milestone")` print the page, or throw a `UsageError`
  with the message `` `${id} not found.` `` when `milestonePage` returns null. Keep the rest of
  `show` as it is (F-025 adds run handling there; merge by hunk). Tests: S-026.3.1 goes in the new
  `test/core/milestone-page.test.ts` (`loadTree` and `buildIndex`; compare `milestone` with
  `index.milestones[0]`); S-026.3.2 to S-026.4.3 extend `test/cli/milestone.test.ts`, with one
  `pageProject()` helper writing the page project (titles through `title`, priorities and
  milestone through `extra`).
- T-026.4 (wording; prettier realigns the tables):
  - `docs/cli.md`: the `show` row adds "For a milestone: its features by status with priority
    and title, and the features keeping it from being ready (or that it is ready); `--brief`
    prints one line." The `move` row adds "A feature moving to
    in-progress moves its planned milestone to active in the same write, and the message says
    so." Add an example block of a milestone page after the Read table's paragraphs.
  - `docs/concepts.md`, the milestone paragraph after "Only you release a milestone.": a
    milestone's status follows the work: a feature of a planned milestone moving to in-progress
    moves the milestone to active (you or an agent, from the CLI or the viewer). A planned
    milestone with a feature in progress, verifying or done that isn't ready is reported as
    `W-MILESTONE-PLANNED` (fixed with `azimuth move M-NN active`); a planned milestone whose
    features are all done gets only `W-MILESTONE-READY`.
  - `docs/file-format.md`, the Milestones section, after the `W-MILESTONE-READY` paragraph: the
    `W-MILESTONE-PLANNED` rule and message, and that `azimuth move F-NNN in-progress` writes
    `status: active` into a planned milestone's file.
  - `plugin/skills/azimuth/SKILL.md`: after the `azimuth show <ID> --brief` row, a row
    `azimuth show M-NN` | "A milestone's features by status and what keeps it from being ready".

Files shared with other 0.3.1 features (merge by hunk; F-026 changes only its own functions and
sections):

- F-025: `src/cli/commands/read.ts` (F-025 adds `runs` and run handling in `show`; F-026 adds the
  milestone branch in `show`), `src/core/brief.ts` (F-025 adds a run case; F-026 only reads it),
  `docs/cli.md` (F-025's `runs` and `show R-NNNN` rows).
- F-028: `src/core/transitions.ts` (F-028 exports `checkExpected`; F-026 changes `moveFeature`
  and adds `milestoneActivation`), `src/core/milestone-page.ts` (F-028 adds its release and commits
  sections after F-026), and the docs' milestone paragraphs.
