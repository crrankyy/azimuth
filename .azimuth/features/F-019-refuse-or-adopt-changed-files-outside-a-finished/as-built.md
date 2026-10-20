---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: src/cli/commands/task.ts, change: modify }
  - { path: src/core/finish.ts, change: modify }
  - { path: src/core/glob.ts, change: modify }
  - { path: src/core/run-scope.ts, change: modify }
  - { path: test/cli/task.test.ts, change: modify }
  - { path: test/core/finish.test.ts, change: modify }
  - { path: test/core/glob.test.ts, change: create }
deviations:
  - { path: src/core/run-scope.ts, kind: unplanned-modify, reason: "repoPath exported so --adopt normalises paths with runScope's rule instead of a copy" }
follow_ups: [DEBT-0012, DEBT-0013]
---
# F-019: As built

## Summary
`task finish` now refuses, in its read-only check step, a changed file outside the task that adds a marker for a scenario the task covers (GitHub #2) or an impact.md path no other in-progress task lists; `--adopt <path,…>` adds such files to the task in plan.md and commits them. The left-out paths print on three lines (outside every task, other in-progress tasks', records), and a staged shared file another in-progress task lists gets a warning. `testFileMatcher` in glob.ts applies `tests.globs`.

## Deviations
`src/core/run-scope.ts`: `repoPath` was exported for `--adopt`'s normalisation rather than copied into finish.ts (F-021 planned the same export).

## Follow-ups
DEBT-0012 (two porcelain parsers) and DEBT-0013 (traceTests' copy of the tests.globs rule).
