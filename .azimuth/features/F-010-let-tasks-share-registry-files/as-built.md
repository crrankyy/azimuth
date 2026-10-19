---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/config.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/build-index.ts, change: modify }
  - { path: src/core/validate.ts, change: modify }
  - { path: src/core/derive.ts, change: modify }
  - { path: src/core/next.ts, change: modify }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: test/core/parse.test.ts, change: modify }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/core/next.test.ts, change: create }
  - { path: test/cli/parallel.test.ts, change: create }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: plugin/skills/spec/SKILL.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/cli.md, change: modify }
deviations: []
follow_ups: []
---
# F-010: As built

## Summary
The new key `parallel.shared_files` (globs, default `[]`) lists the files that tasks extend with
one complete insertion each, such as an enum or a keymap. Paths it matches are never file
conflicts: `conflictProblems` (`W-FILE-CONFLICT`) and `fileConflicts` (the index's
`derived.file_conflicts`, behind the viewer's "File conflict" flags) skip them. The index carries
the globs as `project.shared_files`.

`parallelGroups` and `taskGroups` in `src/core/next.ts` group a feature's ready tasks greedily in
`readyTasks` order: a task joins the first group whose tasks list none of its files outside the
shared list, and a task without `files` stays on its own. When two or more tasks are ready,
`azimuth next F-NNN` prints `Can run together: T-…, T-… (shared: …)` or `On its own: T-…`, and
with `--json` it prints `{items, groups}`. `next` without an ID is unchanged. The build skill
lets tasks that list a shared file run in parallel and has the orchestrator commit the file with
the tasks whose insertions it holds; the spec skill lets plans do the same.

## Deviations
None. The files match `impact.md`, the viewer files listed as read needed no change, and the
Hookline golden index changed only by `project.shared_files: []`.

## Follow-ups
None.
