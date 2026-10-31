---
completed_at: 2026-10-31
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: src/core/flows.ts, change: modify }
  - { path: src/core/milestone-page.ts, change: create }
  - { path: src/core/next.ts, change: modify }
  - { path: src/core/transitions.ts, change: modify }
  - { path: src/core/validate.ts, change: modify }
  - { path: test/cli/milestone-activation.test.ts, change: create }
  - { path: test/cli/milestone.test.ts, change: modify }
  - { path: test/core/milestone-activation.test.ts, change: create }
  - { path: test/core/milestone-page.test.ts, change: create }
  - { path: test/core/milestone-planned.test.ts, change: create }
  - { path: test/server/actions.test.ts, change: create }
deviations: []
follow_ups: []
---
# F-026: As built

## Summary
Built as specced in four tasks. `moveFeature` activates a planned milestone in the same
`save()` as the feature move (`milestoneActivation`, reading the milestone from the index's
model, so an ID without a file is a no-op), and the move's message gains
` (M-01: planned → active)`. `check` warns `W-MILESTONE-PLANNED` for a planned milestone with
started work (`startedCount`, `milestoneStartedWhilePlanned` in `flows.ts`); a ready one keeps
only `W-MILESTONE-READY`. `azimuth show M-NN` prints the page from `milestone-page.ts`
(header, groups by status, readiness), keeping F-025's run branch first; `--brief` and
`--json` are unchanged. The `azimuth next` suggestion was dropped during spec review: the user
chose activation plus the warning.

## Deviations

## Follow-ups
None. F-028 adds the release and commits sections to the page.
