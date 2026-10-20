---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: src/core/init.ts, change: modify }
  - { path: src/core/task-brief.ts, change: modify }
  - { path: test/core/task-brief.test.ts, change: modify }
deviations: []
follow_ups: []
---
# F-022: As built

## Summary
`azimuth brief` adds one rule per shared file the task lists plus the insertion rules, a Conventions section from `project/conventions.md` (left out when missing, empty or still init's template; a pointer above 1,500 words), and a closing request for lessons, files changed outside the list and proven `{?}` values. init exports the conventions template so the comparison can't drift. The build skill's hand-off now adds only what the records don't hold.

## Deviations
None.

## Follow-ups
None.
