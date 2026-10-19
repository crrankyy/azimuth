---
files:
  - path: src/core/finish.ts
    change: create
    note: finishTask (check, note, stage, commit, verify, done, log), withRefsTrailer and selectPaths; git add and git commit through spawnSync
  - path: src/core/task-brief.ts
    change: create
    note: taskBrief, the subagent prompt in Markdown built from the model
  - path: src/cli/commands/task.ts
    change: create
    note: The task command (task finish) with its step lines, --json, session and signals, and the brief command
  - path: src/cli/main.ts
    change: modify
    note: COMMANDS gains task and brief after verify
  - path: src/cli/commands/work.ts
    change: modify
    note: abortOnSignals is exported for task finish
  - path: src/core/verify.ts
    change: read
    note: verifyTargets resolves the task's target; verifyBatch runs the prebuild and the task (F-007)
  - path: src/core/transitions.ts
    change: read
    note: moveTask to done with the result as its note; addLogEntry after a failed verify; Who and Result
  - path: src/core/build-index.ts
    change: read
    note: analyzeProject gives the model and the problems the check step reads
  - path: src/core/run-scope.ts
    change: read
    note: runScope and inScope match changed paths to the task's files (exact or under a directory)
  - path: src/core/git.ts
    change: read
    note: isGitRepo and headSha; its spawnSync git() pattern, which hides stderr, so finish runs its own
  - path: src/core/model.ts
    change: read
    note: loadProject and FeatureEntity (tasks, spec, context, dir, notes from F-008)
  - path: src/core/frontmatter.ts
    change: read
    note: splitFrontmatter strips contract.md's frontmatter
  - path: src/core/config.ts
    change: read
    note: stack.languages for the test-name rule; verify.output_tail_lines for git output
  - path: src/core/session.ts
    change: read
    note: recordInSession adds the feature and the task to the session's touched list
  - path: src/core/parse/stories.ts
    change: read
    note: Scenario headings and fences, which the brief follows when it cuts a scenario's lines
  - path: src/core/brief.ts
    change: read
    note: show --brief (showBrief) stays the orchestrator's summary; azimuth brief is a separate prompt
  - path: src/cli/io.ts
    change: read
    note: runtime, print, printJson, color and UsageError
  - path: src/cli/verify-report.ts
    change: read
    note: The seconds and tail formats the verify step line follows
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll and gitEnv for repositories in temp folders
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes F-001 with tasks, files and verify commands
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process for the command tests
  - path: test/core/finish.test.ts
    change: test
    note: withRefsTrailer, selectPaths and finishTask against real git
  - path: test/core/task-brief.test.ts
    change: test
    note: taskBrief text, placeholders, empty sections, language rules and unknown tasks
  - path: test/cli/task.test.ts
    change: test
    note: task finish lines, exit codes, --json, usage errors and session; brief output and errors
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: The loop finishes each task with azimuth task finish; subagents get azimuth brief; a batch is finished one task at a time after it has reported
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: CLI reference rows for azimuth task finish and azimuth brief
  - path: src/core/protocol.ts
    change: modify
    note: The per-task lines in Sessions and progress and in Tests name task finish and brief
  - path: docs/cli.md
    change: modify
    note: task finish (steps, staging, Refs trailer, output, exit codes) and brief
  - path: docs/concepts.md
    change: modify
    note: The task loop with brief and task finish; shared files staged whole, one task at a time
---
# F-009: Impact map

Two new core modules hold the logic: `finish.ts` composes existing writers (F-008's `addNote`,
`moveTask`, `addLogEntry`) and F-007's `verifyBatch` around one `git add` and one `git commit`;
`task-brief.ts` is a pure function over the model. The CLI module `commands/task.ts` adds both
commands, so the only existing source files that change are `main.ts` (two `COMMANDS` entries)
and `work.ts` (one `export`). The rest are the build and azimuth skills, the protocol template
and two docs.

F-008's `src/core/notes.ts` (`addNote`) and `src/core/placeholders.ts` (`placeholderParts`) are
read too. They are left out of the list above until F-008's build creates them, because a read
path that doesn't exist yet would be reported as `W-IMPACT-MISSING`.
