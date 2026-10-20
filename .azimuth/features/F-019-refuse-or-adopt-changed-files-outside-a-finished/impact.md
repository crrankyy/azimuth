---
files:
  - path: src/core/finish.ts
    change: modify
    note: unlistedFiles, splitNotStaged and sharedStaged; the check reads git status, validates --adopt and refuses unlisted files; the adopt step writes plan.md; the result gains the split lists and shared
  - path: src/cli/commands/task.ts
    change: modify
    note: The --adopt option (comma list, usage error when empty), the adopt step line, three not-staged lines and the shared-file warning lines
  - path: src/core/glob.ts
    change: modify
    note: testFileMatcher, the tests.globs rule with ! excludes that traceTests applies inline; globToRegExp and matchesAny for parallel.shared_files
  - path: src/core/trace.ts
    change: read
    note: scanTestFile scans the working copy and HEAD's copy of a changed test file; traceTests is left unchanged (F-020 owns the file)
  - path: src/core/run-scope.ts
    change: read
    note: runScope and inScope decide whether a task lists a path and whether a path lies under an impact entry
  - path: src/core/git.ts
    change: read
    note: readBlobs reads HEAD's copy of changed test files (null when HEAD has none)
  - path: src/core/config.ts
    change: read
    note: tests.globs and parallel.shared_files
  - path: src/core/transitions.ts
    change: read
    note: moveTask's plan.md write (updateFrontmatterItem inside withLock), which the adopt step follows
  - path: src/core/frontmatter.ts
    change: read
    note: updateFrontmatterItem rewrites one task's files in plan.md and leaves every other byte
  - path: src/core/lock.ts
    change: read
    note: withLock and writeFileAtomic for the adopt step's write
  - path: src/core/parse/feature.ts
    change: read
    note: parsePlan, TaskRaw and ImpactRaw
  - path: src/core/model.ts
    change: read
    note: FeatureEntity (dir, impact, tasks, files.plan) of every feature, for the other in-progress tasks
  - path: src/core/paths.ts
    change: read
    note: AZ_DIR, the prefix of the records list
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes features with tasks, files and impact entries
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll, git and gitEnv for repositories in temp folders
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG (tests.globs test/**/*.test.ts)
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process
  - path: test/core/glob.test.ts
    change: test
    note: testFileMatcher with include and ! exclude globs
  - path: test/core/finish.test.ts
    change: test
    note: The pure helpers, and finishTask's refusals, adopt step and split lists against real git
  - path: test/cli/task.test.ts
    change: test
    note: task finish --adopt, the refusal lines, the three not-staged lines, the warning line, --json and the usage error
  - path: docs/cli.md
    change: modify
    note: Finish a task, covering the refusal, the adopt step and --adopt, the three not-staged lines, the warning, the --json fields and reruns
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: Step 4.4 and Delegating to subagents, covering how to read the refusal, when to --adopt, and the not-staged lines and warning
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: The CLI table row for task finish gains --adopt
---
# F-019: Impact map

In code, `finish.ts` and the `task` command change, and `glob.ts` gains one helper
(`testFileMatcher`). The refusal reuses `scanTestFile`, `readBlobs` and `runScope`/`inScope`.
The adopt step reuses the plan.md writer behind `moveTask`. `transitions.ts`, `trace.ts` and
`git.ts` are read and not changed; a later cleanup can switch `traceTests` to
`testFileMatcher`. Three docs and skill files describe the new behaviour.
