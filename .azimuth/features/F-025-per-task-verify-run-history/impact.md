---
files:
  - path: src/core/runs.ts
    change: create
    note: runHistory (a task's or feature's runs, newest first, capped, with the total) and findRun, over the model; the refusals
    symbols: [runHistory, findRun, newestFirst, RunHistory]
  - path: src/cli/commands/runs.ts
    change: create
    note: The runs command, parseLimit, runLine, runPage and showRun (show's run branch)
    symbols: [runs, parseLimit, runLine, runPage, showRun, DEFAULT_RUN_LIMIT]
  - path: src/cli/verify-report.ts
    change: modify
    note: Exports seconds, outcome and tailLines; reportLines' run line moves into the exported runResultLine, output unchanged
  - path: src/cli/main.ts
    change: modify
    note: Registers runs after trace (shared with F-028, which registers release)
  - path: src/cli/commands/read.ts
    change: modify
    note: show hands a run ID to showRun before buildIndex; findEntity drops index.runs (shared with F-026, which changes show for milestones)
  - path: src/core/model.ts
    change: read
    note: loadProject reads every run file (readRuns) without git; Model.runs and Model.features (tasks)
  - path: src/core/parse/run.ts
    change: read
    note: parseRun gives the record, with waited_ms and ses only when the file has them and prebuild always
  - path: src/core/types.ts
    change: read
    note: VerifyRun and RunPrebuild
  - path: src/core/build-index.ts
    change: read
    note: indexRuns keeps the 200 newest runs plus each task's latest, which is why runs and show read the model; its comparator is the order runs uses
  - path: src/core/ids.ts
    change: read
    note: idKind, featureOf and compareIds
  - path: src/core/errors.ts
    change: read
    note: AzimuthError and its codes (invalid, not-found)
  - path: src/core/brief.ts
    change: read
    note: showBrief, which show keeps using for every ID that isn't a run (unchanged; F-026 changes the milestone case)
  - path: src/cli/io.ts
    change: read
    note: print, printJson, runtime, requirePositional, UsageError and color
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process with NO_COLOR=1
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG for temp projects
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes F-001 and F-002; loadTree loads the model for the core tests
  - path: test/core/runs.test.ts
    change: test
    note: runHistory's order, limit, total, feature scope, removed tasks and refusals
  - path: test/cli/runs.test.ts
    change: test
    note: azimuth runs lines, feature lines, limit and older line, empty, refusals, --limit errors and --json
  - path: test/cli/show-run.test.ts
    change: test
    note: show R-NNNN page, old run file, failed prebuild, --brief, --json, a run outside the index, unknown run, other IDs unchanged
  - path: test/cli/verify-report.test.ts
    change: read
    note: Must pass unchanged after runResultLine is extracted
  - path: docs/cli.md
    change: modify
    note: The runs row and paragraph, and the show row's run sentence (shared with every 0.3.1 feature)
  - path: docs/file-format.md
    change: modify
    note: One sentence in Cache naming azimuth runs and show R-NNNN as the way to read run files
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: A runs row in the CLI reference, and the show row names runs
  - path: plugin/skills/bug/SKILL.md
    change: modify
    note: One sentence on checking a flaky test's past runs with azimuth runs and show R-NNNN
---
# F-025: Impact map

The core slice is one new module, `src/core/runs.ts`, tested without the CLI. The CLI slice is
one new command file, `src/cli/commands/runs.ts`, which also formats the run page that `show`
prints, so `read.ts` changes by one early branch and one line of `findEntity`. `verify-report.ts`
only exports helpers it already has. `brief.ts` and `build-index.ts` don't change.

`test/core/runs.test.ts`, `test/cli/runs.test.ts` and `test/cli/show-run.test.ts` are new. Docs and
skills change in the last task.
