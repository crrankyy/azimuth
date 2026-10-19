---
files:
  - path: src/core/config.ts
    change: modify
    note: parallel.shared_files in Config, DEFAULT_CONFIG ([]) and SHAPE (r.strings())
  - path: src/core/types.ts
    change: modify
    note: Project.shared_files in the index contract
  - path: src/core/build-index.ts
    change: modify
    note: buildIndex copies config.parallel.shared_files into index.project
  - path: src/core/validate.ts
    change: modify
    note: conflictProblems skips paths the shared globs match
  - path: src/core/derive.ts
    change: modify
    note: fileConflicts skips the same paths, so derived.file_conflicts agrees with W-FILE-CONFLICT
  - path: src/core/next.ts
    change: modify
    note: TaskGroup, parallelGroups (greedy grouping of tasks) and taskGroups (a feature's ready tasks)
  - path: src/cli/commands/read.ts
    change: modify
    note: next prints a line per group and, with an ID and --json, {items, groups}
  - path: src/core/glob.ts
    change: read
    note: globToRegExp and matchesAny compile and match the shared globs
  - path: src/core/parse/feature.ts
    change: read
    note: parsePlan gives each task's files
  - path: src/core/brief.ts
    change: read
    note: show --brief prints nextForFeature unchanged and no groups
  - path: viewer/src/screens/feature/PlanTab.tsx
    change: read
    note: Lists a task's files with no overlap hint, so it stays unchanged
  - path: viewer/src/components/TaskDag.tsx
    change: read
    note: Draws after edges only; no parallelism hint to change
  - path: viewer/src/screens/features/model.ts
    change: read
    note: The "File conflict" flag reads derived.file_conflicts, which now skips shared files
  - path: test/core/parse.test.ts
    change: test
    note: The parallel.shared_files key
  - path: test/core/analysis.test.ts
    change: test
    note: W-FILE-CONFLICT and file_conflicts skip shared files
  - path: test/core/next.test.ts
    change: test
    note: Grouping ready tasks that can run together
  - path: test/cli/parallel.test.ts
    change: test
    note: status --json carries project.shared_files; next F-NNN prints and returns the groups
  - path: test/fixtures/hookline/expected-index.ts
    change: modify
    note: The golden index gains project.shared_files []
  - path: test/golden/index.test.ts
    change: read
    note: The golden index test, which must pass unchanged
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: Tasks listing a shared file may run in parallel, one complete insertion each; the orchestrator commits a shared file with the tasks whose insertions it holds
  - path: plugin/skills/spec/SKILL.md
    change: modify
    note: Plans may list a shared file in tasks that run in parallel
  - path: docs/concepts.md
    change: modify
    note: Shared files, file conflicts and which ready tasks can run together
  - path: docs/file-format.md
    change: modify
    note: parallel.shared_files in the config reference; W-FILE-CONFLICT skips shared files
  - path: docs/cli.md
    change: modify
    note: next F-NNN prints the groups and --json prints {items, groups}
---
# F-010: Impact map

The config key flows into three consumers: the two file-conflict rules (`validate.ts` for
`W-FILE-CONFLICT`, `derive.ts` for the index's `file_conflicts`), the grouping in `next.ts`, which
reads the globs from `index.project.shared_files`, and the index itself. The viewer reads
`file_conflicts` and `project` from the index, so it needs no change. The skills and docs say how
builders use shared files.
