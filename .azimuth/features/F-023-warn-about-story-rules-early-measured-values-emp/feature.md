---
id: F-023
title: Warn about story rules early, measured values, empty covers and finished milestones
summary: check runs the story rule for ideas with stories, hints at {?} for offsets and ranges and at tasks covering nothing in drafts (hints don't count for strict), and warns when every feature of an open milestone is done.
status: in-progress
priority: P1
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
approved_hash: sha256:92ea2a6fab1830d0bfa1bb188f6c7c72afbb62d1d364c4032a8d5d9f98a147e3
approved_commit: 833d58d
review_ack_at: null
---
# F-023: Warn about story rules early, measured values, empty covers and finished milestones

## Objective
In the second ZenithMD run, `azimuth check` stayed quiet about four things the orchestrator
learned later, at a higher price (experience report §4.2, §4.7, §5.8, §5.10):

- `azimuth check F-072` printed "No problems." for an idea whose story had no negative or edge
  scenario, and `azimuth move F-072 approved` then failed the gate's story rule. `W-NO-NEGATIVE`
  is computed only from `draft` on (`SPECIFIED` in `validate.ts`).
- Seven THEN values were byte offsets, ranges or paths written before the code existed. Each cost
  a lane paragraph, an edit, a docs commit and a reapprove: about 21 orchestrator calls. `{?}`
  exists for exactly these values.
- A task with empty `covers` (T-050.4, app wiring) passes every gate silently, and its brief has
  no THEN to hold the lane to.
- Milestones read `planned` or `active` long after every one of their features was done, so the
  viewer's phase was wrong. Only the user releases a milestone.

F-023 adds four `check` warnings and one `azimuth next` item:

- **`W-NO-NEGATIVE` for ideas.** An idea with stories gets the same warning a draft gets. It
  stays a warning, and no other rule changes for ideas.
- **`W-MEASURED`, in a draft.** A THEN line, or an AND line after it, that holds a number range
  (`9..12`, `2..=5`) or `offset`, `caret`, `byte`, `column` or `position` followed by a number
  (`caret: 24`, `offset: Some(63)`) gets a warning pointing at `{?}`. Settled and open placeholder
  values never trigger it.
- **`W-NO-COVERS`, in a draft.** A task whose `covers` is empty, unless every file it lists is
  Markdown (a docs task). A task with no files, or with any other file (scaffolding, wiring such
  as T-050.4), gets it. Nothing else silences it: a move clears a task's `note`, and the warning
  goes away at approval.
- **Hints.** `W-MEASURED` and `W-NO-COVERS` are hints. `check` shows them like any warning, but
  `autonomy.strict`'s zero-warning approval check (`approve.no-warnings`) doesn't count them, so
  they never block a legitimate spec.
- **`W-MILESTONE-READY`.** A planned or active milestone with at least one feature, every one of
  them done. `azimuth next` adds an item asking the agent to have the user release it.

The docs and the spec skill describe the warnings, hints and the release item. The skill also
says that `check` before `move draft` now catches the story rule.

## Out of scope
- Changing any gate: the approval gate's story rule (`approve.story-kinds`), the draft gate, the
  severity of `W-NO-NEGATIVE`, or which errors block anything. Only the strict check's count
  changes.
- Other rules for ideas: the uncovered-scenario check (an error outside draft), path problems
  (`W-PATH`, `W-IMPACT-MISSING`), `E-SPEC-MISSING` and `W-SIZE-XL` stay off for ideas. Deferred
  features get nothing new.
- A way to silence a hint (a task `note`, a config switch, an inline marker), a configurable
  keyword list, and `W-MEASURED` in GIVEN or WHEN lines, in AND lines after them, or in other
  spec files.
- Showing hints differently from other warnings in `check` output, `status --brief` or the
  viewer. The `Problem` type and the index keep their shape.
- An inbox item, a viewer change or an automatic move for a milestone that is ready. Agents still
  can't release milestones (`moveMilestone`).
- `azimuth next <F-ID>` (`nextForFeature`) and F-024's cross-feature groups in `azimuth next`.
- Prompting the release in the verify skill's close-out.

## Integration points
- `src/core/parse/stories.ts`: `ScenarioRaw` gains `thenLines`, the THEN line and the AND lines
  after it with their file line numbers, read in `parseStories` next to the existing clause
  tracking. New pure `measuredValue(line)` beside `isVague`. It reads only the plain-text parts of
  a line, using `placeholderParts` from `src/core/placeholders.ts`.
- `src/core/validate.ts`: `featureProblems` runs the story loop for `idea` as well, and adds
  `W-MEASURED` and `W-NO-COVERS` for drafts. A new `milestoneProblems(model)` joins the list in
  `validate()`, using `milestoneProgress` (`derive.ts`). New exports `HINT_CODES` and `isHint`.
- `src/core/gates.ts` (shared with F-018, F-020 and F-021): only `approveGate`'s
  `autonomy.strict` block changes. It filters hints out of `featureProblems(ctx, f, "warning")`.
- `src/core/derive.ts` (shared with F-020; F-018 and F-021 read it): a new `milestoneReady`
  after `milestoneProgress`. `validate.ts` and `next.ts` both call it.
- `src/core/next.ts` (shared with F-024, which adds cross-feature groups to `azimuth next` with no
  ID): a new `releaseItems(index)` and one line in `nextWork` that adds its items. `statusBrief`
  (`brief.ts`) shows them through `nextWork`, and `azimuth next` (`src/cli/commands/read.ts`)
  prints them like any `NextItem`, so neither changes.
- `azimuth check` (`read.ts`) prints the new warnings with its existing format, counts and
  `relatedTo` filter (`check F-072` matches `ST-072.1`; `check M-01` matches the milestone's
  problem).
- Existing tests whose expectations change (see Assumptions): `test/core/analysis.test.ts` (a draft
  task covering nothing), `test/cli/check.test.ts` (F-013's S-013.1 project) and
  `test/golden/index.test.ts` (five Hookline draft tasks that cover nothing).
- Docs and instructions: `docs/file-format.md`, `docs/concepts.md`, `docs/cli.md` (the
  `azimuth next` row; shared with every 0.3 feature), `plugin/skills/spec/SKILL.md`, and the
  `strict` comments in `src/core/init.ts` (config template, shared with F-018 and F-022) and
  `src/core/types.ts` (shared with F-018 and F-020).

## Invariants
- No error is added or removed, and no existing problem changes code, severity, file, line or
  message. `azimuth check` exits 1 exactly when it did before.
- Every gate check gives the same result as before, except `approve.no-warnings`, which ignores
  hints.
- For a feature in `idea`, the only new problem is `W-NO-NEGATIVE`. `W-MEASURED` and
  `W-NO-COVERS` appear only while the feature is `draft`.
- A settled (`{=v}`) or open (`{?}`) placeholder never produces `W-MEASURED`.
- Every computation here is read-only: no file is written, and no git command runs.
- `azimuth next <F-ID>` and the order of every other `nextWork` item don't change. The output
  format of `check` and `next` doesn't change.

## Assumptions
- **The idea rule.** `W-NO-NEGATIVE` for an idea uses the draft rule unchanged: the same code,
  message, file (stories.md), line (the story heading) and ref (the story ID). An idea without
  stories.md has no stories, so it gets nothing.
- **Which lines `W-MEASURED` reads.** "A THEN or AND line" means the THEN line and every AND line
  after it, up to the scenario's end. An AND after GIVEN or WHEN extends that clause and describes
  an input the writer chooses, not a value the code measures, so it isn't read. An indented
  continuation line joins its line with a space, as the parser already does for clauses. Lines
  inside fenced code are never read.
- **The match.** Only the plain-text parts of a line are tested, each on its own, so a
  placeholder's value never matches. Two patterns are used:
  - A range: digits, `..`, an optional `=`, digits, not right after a letter, digit, `_` or `.`.
  - A word: `offset`, `caret`, `byte`, `column` or `position`, in any case and not right after a
    letter. Letters or `_` may follow it (`byte_range`, `offsets`). Then come one or more spaces,
    `:`, `=` or backticks, and then either a number or range, or a name and `(` around one
    (`Some(63)`). A bare word may also be followed directly by a number.

  The `Name(` form goes beyond the outline's "followed by a number", so that the decided example
  `offset: Some(63)` counts. A separator is required after a longer identifier, so that function
  names such as `byte_to_char(5)` and `byte_to_utf16` (both in ZenithMD's stories) don't count.
  `byte-for-byte` doesn't match.
- **One warning per line.** `W-MEASURED` reports the earliest match on a line: file stories.md,
  that line, ref the scenario ID. The message is
  ``"<match>" looks like a value only the code can measure. If it is, write {?} instead: the first passing test settles it.``
- **`W-NO-COVERS`.** A task is skipped when its `files` is non-empty and every entry ends in
  `.md` (decided by the user, so the usual docs task doesn't warn). An empty `files` list, a
  directory entry or any other file keeps the hint. It goes on plan.md with line null (tasks
  carry no line numbers, as for `E-TASK-REF`) and ref the task ID. The message is
  `<T-ID> covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents.`
- **Hints.** Hints are identified by one list, `HINT_CODES = ["W-MEASURED", "W-NO-COVERS"]` in
  `validate.ts`, where the codes are produced, and read through `isHint`. The strict check keeps
  its id, rule text and detail format, and its detail counts only the warnings that aren't hints
  (`1 warning`). `check`, `status --brief` and the index show hints as plain warnings.
- **When a milestone is ready.** Readiness uses `milestoneProgress`'s count: cancelled and
  superseded features don't count, and a deferred feature counts as not done. A milestone whose
  only features are retired has none and is never ready. `W-MILESTONE-READY` goes on the
  milestone's file with line null (milestone records carry no key lines) and ref the milestone
  ID. The message is
  `Every feature of <M-ID> is done but it is still <planned|active>; ask the user to release it.`
- **The `next` item.** Each ready milestone, in ID order, gives
  `{ ref: <M-ID>, title: <milestone title>, action: "Ask the user to release <M-ID> in the viewer", reason: "Every feature is done; only the user releases a milestone" }`.
- **Where the item goes.** `nextWork` lists release items after critical issues and before
  feature work. `status --brief` shows only the first five `nextWork` items, and the item must
  reach the agent at session start. The milestones that went unreleased in ZenithMD sat behind
  ongoing feature work. Releasing costs the agent one sentence to the user and disappears once
  done.
- **Existing tests.** In `test/cli/check.test.ts`, the S-013.1 project's T-001.2 now covers
  S-001.1.1. The project of S-013.1.1 then keeps exactly the problems F-013's THEN values name
  (one E-TASK-CYCLE, two W-NO-NEGATIVE, one W-UNCOVERED-SCENARIO). Otherwise its draft task
  covering nothing would add `W-NO-COVERS`. F-013's done records aren't edited. The Markdown
  rule spares none of the three tests below: each task involved lists no files or a code file.
  - `test/core/analysis.test.ts` "catches drift, uncovered scenarios, task problems and missing
    paths" gains `W-NO-COVERS T-002.1`.
  - `test/golden/index.test.ts` adds the hints of Hookline's T-008.1, T-008.5, T-008.6, T-009.4
    and T-009.5 as a deviation the sample predates. `expected-index.ts`, which F-018 and F-020
    change, is left alone.
- **Effect on this repository.** Of the 35 tasks with empty `covers` in this repository's specs
  so far, 16 list only Markdown files and would be skipped. The other 19 would show
  `W-NO-COVERS` while their feature was a draft: 8 scaffolding tasks, 3 helper or harness tasks,
  6 docs tasks that also change code (such as T-023.5) and 2 without files. As a hint it never
  blocks approval.
- **Notation in stories.md.** F-023's stories write the open placeholder as ⟦?⟧ and a value v
  settled as ⟦=v⟧, as F-008's and F-009's do. Written literally, they would be live placeholders
  in this repository.
