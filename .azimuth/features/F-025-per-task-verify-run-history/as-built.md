---
completed_at: 2026-10-31
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: plugin/skills/bug/SKILL.md, change: modify }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: src/cli/commands/runs.ts, change: create }
  - { path: src/cli/main.ts, change: modify }
  - { path: src/cli/verify-report.ts, change: modify }
  - { path: src/core/runs.ts, change: create }
  - { path: test/cli/runs.test.ts, change: create }
  - { path: test/cli/show-run.test.ts, change: create }
  - { path: test/core/runs.test.ts, change: create }
deviations: []
follow_ups: []
---
# F-025: As built

## Summary
Built as specced in four tasks. `runHistory` (`src/core/runs.ts`) picks a task's or a feature's
runs from `loadProject`'s model, newest first (`newestFirst`, the same order as the index), so a
run outside the index's 200-run window is found. `azimuth runs` (`src/cli/commands/runs.ts`)
prints one line per run with verify-report's helpers, which are now exported, and `--json`
prints the records without `output_tail`. `azimuth show R-NNNN` is handled before `buildIndex`
in `show` (`showRun`), with `--brief` and `--json`. `brief.ts` was not changed.

## Deviations

## Follow-ups
None. `indexRuns` in build-index.ts keeps its own copy of `newestFirst`'s comparator (see notes.md); left as is.
