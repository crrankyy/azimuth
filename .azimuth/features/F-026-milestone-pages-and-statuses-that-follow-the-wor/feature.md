---
id: F-026
title: Milestone pages and statuses that follow the work
summary: show M-NN lists the milestone's features by status and what keeps it from being ready; a feature starting moves its planned milestone to active; check warns about a planned milestone whose work has started.
status: done
priority: P1
size: M
mode: brownfield
milestone: M-03
depends_on: [F-023]
superseded_by: null
tags: []
created: 2026-10-31
updated: 2026-10-31
approved_at: 2026-10-31
approved_by: agent
approved_hash: sha256:b678fd0a46ca93bb46cfe617e365ee420ff095fce9bfc8d45eabb30a3549dbe9
approved_commit: 0935b31
review_ack_at: null
---
# F-026: Milestone pages and statuses that follow the work

## Objective
The ZenithMD release session (2026-10-24) showed that milestones say little and drift from the
work:

- **A milestone has no page.** `azimuth show M-03` prints one line
  (`M-03 planned v0.3: …: 17/22 done`). Which five features are missing, and in which state, took
  a scan of every feature. `azimuth show M-NN` without `--brief` now prints a page: a header
  (ID and title, status with its released and target dates, goal, progress), the milestone's
  features grouped by status with ID, priority and title, and a last section that names the
  features keeping it from being ready, or says it is ready. `--brief` keeps the one line and
  `--json` keeps the entity.
- **A milestone's status doesn't follow its features.** ZenithMD's M-02 was 18/18 done and still
  planned; M-04 was planned with 9 features done. Statuses now follow the work (the user chose
  this over manual statuses): when a feature moves to in-progress and its milestone is planned,
  the same locked write moves the milestone to active, and the move's message says so
  (`F-001: approved → in-progress (M-01: planned → active)`). Every way a feature reaches
  in-progress goes through `moveFeature`: `azimuth move`, and the viewer's `move` action
  (`runAction`). Tasks never move their feature: `moveTask` and `azimuth task finish` refuse
  unless the feature is already in progress.
- **Projects that drifted before the upgrade are flagged.** `azimuth check` warns with
  `W-MILESTONE-PLANNED` about a planned milestone with work started (a counted feature in
  progress, verifying or done) that isn't ready; its message gives `azimuth move M-NN active`,
  which an agent may run. A planned milestone whose features are all done keeps only F-023's
  `W-MILESTONE-READY` and its release item.

## Out of scope
- Releasing milestones: BUG-0084 (the viewer can't release a planned milestone), the user-only
  `azimuth release M-NN [--tag]` and the viewer's release that passes through active belong to
  F-028, which adds `releaseMilestone` (`src/core/release.ts`). F-026 doesn't change `moveMilestone` or `MILESTONE_FLOW`.
- Commits whose `Refs:` name the milestone on its page: F-028 adds that section to the page
  module.
- Moving a milestone automatically in any other case: back to planned when its last started
  feature goes back to draft, to active when `azimuth set F-NNN milestone M-NN` puts a started
  feature into a planned milestone (the warning reports it), or to released when every feature is
  done (only the user releases).
- A milestone log or a dated record of the activation: milestone files have no log, and the
  feature's log entry stays `approved → in-progress`.
- The milestone's Markdown body (scope notes, release notes) on the page, a milestone page in the
  viewer, and the `Result` type (no new field; the message and `changed` carry the activation).
- `azimuth show` for any other kind of ID, and `--json` for a milestone.
- A warning for a released milestone whose features aren't all done, or for an active milestone
  with no started work.
- An `azimuth next` item for a planned milestone with started work: the user chose automatic
  activation plus the check warning.

## Integration points
- `src/core/transitions.ts`: `moveFeature` calls a new module-private
  `milestoneActivation(root, model, f)` when `to` is `in-progress`, after every refusal and gate
  check, and saves its write with the feature's `feature.md` and `log.md` in the same `save` call
  inside `withLock`. The result's `changed` gains the milestone file and its message gains
  ` (M-01: planned → active)`. `moveMilestone` is untouched,
  and so are `moveTask`, `addLogEntry` and every other function.
- `src/server/actions.ts`: read only. The `move` action calls `move`, which dispatches a feature
  to `moveFeature` as you, so the viewer activates the milestone too, and the toast takes the
  result's message as its title (`doneTitle` in `viewer/src/components/Ui.tsx`).
- `src/cli/commands/write.ts`: read only. `azimuth move` prints `result.message`, or the Result
  with `--json`.
- `src/core/flows.ts`: new `STARTED_STATUSES`, `startedCount` and
  `milestoneStartedWhilePlanned` next to `milestoneReady`, free of Node imports, so the page can
  use them.
- `src/core/validate.ts`: `milestoneProblems` gives each milestone at most one warning,
  `W-MILESTONE-READY` (F-023, unchanged) or the new `W-MILESTONE-PLANNED`.
- `src/core/next.ts`: only `byPriority` becomes exported, for the page. `nextWork`,
  F-023's `releaseItems` and F-024's `crossFeatureGroups` are unchanged.
- `src/core/milestone-page.ts` (new): `milestonePage(index, id)` builds the page's data and
  `formatMilestonePage(page)` prints it from a list of section functions. F-028 adds its commits
  as one more field and its release and commits sections as two more functions in that list.
- `src/cli/commands/read.ts`: F-026 changes only `show`: a milestone ID without `--brief` prints
  `formatMilestonePage(milestonePage(index, id))`. Shared with F-025, which adds the `runs`
  command and run handling in `show`; the `--json` branch and `findEntity` stay as they are.
- `src/core/brief.ts`: read only. `showBrief`'s milestone case stays the `--brief` line (F-025
  adds a run case to `showBrief`).
- Docs and skills: `docs/cli.md` (the `show` and `move` rows), `docs/concepts.md` (the
  milestone paragraph), `docs/file-format.md` (the Milestones section's warning paragraph) and
  `plugin/skills/azimuth/SKILL.md` (one row for `azimuth show M-NN`). F-025 and F-028 change
  other rows of the same files.

## Invariants
- A feature move that is refused (bad status, policy, missing reason, gate, stale `expect`)
  writes nothing, the milestone file included.
- A move to in-progress changes the milestone file only when the milestone exists and is planned,
  and then only its `status` line (surgical `updateFrontmatter`); an active or released milestone,
  a feature without a milestone, or a milestone ID with no file changes nothing beyond what
  `moveFeature` writes today.
- Every other feature move (to approved, verifying, done, draft, deferred …) writes what it
  writes today.
- A milestone gets at most one of `W-MILESTONE-READY` and `W-MILESTONE-PLANNED`; the ready warning
  and its release item are exactly F-023's.
- `azimuth next` (text and `--json`) and `status --brief` print what they print today.
- `azimuth show M-NN --brief`, `azimuth show M-NN --json` and `azimuth show` of every other kind
  of ID print what they print today.
- `milestone-page.ts`, `flows.ts` and `next.ts` import no Node modules.

## Assumptions
- **Which moves activate.** Any successful `moveFeature` to `in-progress`: approved →
  in-progress (with or without `--override`) and verifying → in-progress. A verifying feature
  of a planned milestone only exists after drift, and starting it again is work starting.
- **Actor.** The activation runs as whoever moved the feature, you or an agent, since agents may
  move a milestone to active (`moveMilestone` refuses only `released` to agents). It isn't marked
  automatic: the Result's `auto` stays false.
- **The message.** `<F-ID>: <from> → in-progress (<M-ID>: planned → active)`, on one line so the
  viewer's toast title stays one line. `changed` is the feature's `feature.md`, `log.md`, then
  the milestone file. The feature's log entry is unchanged (`approved → in-progress`).
- **Commits.** The milestone file is a record outside the feature's folder, so
  `azimuth task finish` doesn't stage it; it goes in the next `chore(azimuth)` commit, as the
  protocol asks for pending `.azimuth/` changes.
- **Started work.** A counted feature (cancelled and superseded don't count, as in
  `milestoneProgress`) whose status is in-progress, verifying or done (`STARTED_STATUSES`).
  `startedCount` reads them from `progress.by_status`.
- **`W-MILESTONE-PLANNED`.** On a planned milestone with `startedCount ≥ 1` that `milestoneReady`
  doesn't accept; on the milestone's file, line null, ref the milestone ID; message
  `` <M-ID> is still planned with work started on <n> of its <total> features; move it to active (`azimuth move <M-ID> active`). ``
  A planned milestone whose features are all done gets only `W-MILESTONE-READY`: releasing is the
  step left, and F-028 lets the user release it from planned. It isn't a hint, and
  `autonomy.strict` doesn't count it (it counts only a feature's own warnings).
- **No `next` item.** The user chose automatic activation plus the check warning; `azimuth next`
  and `status --brief`'s Next list are unchanged, and F-023's S-023.6.3 test stays as it is.
- **The page layout.** Sections separated by one blank line:
  1. Header: `<M-ID> <title>`; `Status: <status>`, then ` <released_at>` when released and set,
     then `, target <target>` when set; `Goal: <goal>` unless the goal is empty;
     `Progress: <done>/<total> done` (milestoneProgress's counts).
  2. Groups, in the order `in-progress, verifying, approved, draft, idea, deferred, done,
     cancelled, superseded` (the work in flight first, then what waits, then what is finished,
     then what doesn't count). Each non-empty group is a heading `<status> (<n>)`, or
     `<status> (<n>, not counted)` for cancelled and superseded, then one line
     `  <F-ID> <priority> <title>` per feature, by priority then ID (`byPriority`). The section
     is left out when no feature names the milestone.
  3. Readiness, for a planned or active milestone only: `No features count toward it yet.` when
     none counts; `Ready: every feature is done; ask the user to release <M-ID>.` when
     `milestoneReady` accepts it; otherwise `Keeping it from being ready: <F-IDs>`, the counted
     features that aren't done (deferred ones included) in the groups' order. Then, when
     `milestoneStartedWhilePlanned` accepts it,
     `Work has started on its features but it is still planned: azimuth move <M-ID> active`.
  The page lists the index's features whose `milestone` is the ID; statuses print as the CLI
  takes them (`in-progress`), not as labels.
- **Extensible sections.** `formatMilestonePage` joins the non-empty results of a module-private
  list of section functions, each `(page) => string[]`, so F-028 adds its commits as one
  more field of `MilestonePage` and two more functions in that list.
- **`show` without a milestone page.** An unknown milestone ID without `--brief` is refused as
  today: `M-09 not found.` on stderr with the usage line, exit 2.
