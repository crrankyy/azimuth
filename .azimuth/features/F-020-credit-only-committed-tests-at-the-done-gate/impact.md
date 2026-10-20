---
files:
  - path: src/core/git.ts
    change: modify
    note: gitFacts reads git status --porcelain -z --untracked-files=all once and fills changed and dirty from it
  - path: src/core/facts.ts
    change: modify
    note: GitFacts.changed, emptyGitFacts gives changed [], TestRef.committed (optional)
  - path: src/core/trace.ts
    change: modify
    note: markCommitted reads HEAD's copies of changed test files with readBlobs and scans them with scanTestFile
  - path: src/core/build-index.ts
    change: modify
    note: analyzeProject passes traceTests' refs through markCommitted with facts.git.changed (null without git)
  - path: src/core/derive.ts
    change: modify
    note: coverageOf copies committed onto each ScenarioTest
  - path: src/core/types.ts
    change: modify
    note: ScenarioTest.committed, the index field the viewer and trace --json read
  - path: src/core/gates.ts
    change: modify
    note: done.scenarios-passing counts a scenario only with a committed passing test and names the uncommitted files; no other check changes
  - path: src/cli/commands/read.ts
    change: modify
    note: trace prints (uncommitted) after a test only in the working tree
  - path: viewer/src/screens/feature/StoriesTab.tsx
    change: modify
    note: ScenarioCard's chip counts uncommitted tests and opens the list; TestRow tags an uncommitted test
  - path: viewer/src/screens/Verification.tsx
    change: modify
    note: ScenarioRow (exported for its test) tags the test cell and marks uncommitted tests in its title
  - path: viewer/src/screens/feature/feature.css
    change: modify
    note: .fd-test-uncommitted, the warning look of the az-tag in a test row
  - path: viewer/src/screens/verification.css
    change: modify
    note: .vf-uncommitted, the same tag in the coverage table's test cell
  - path: docs/cli.md
    change: modify
    note: The trace row explains the (uncommitted) mark and the committed field
  - path: docs/concepts.md
    change: modify
    note: The done gate row and the Scenario → test bullet say only committed tests count
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Step 3 tells the agent to commit a test trace marks uncommitted
  - path: src/core/verify.ts
    change: read
    note: Calls traceTests to credit runs; unchanged
  - path: src/core/junit.ts
    change: read
    note: Reads TestRef names for JUnit matching; unchanged
  - path: src/core/finish.ts
    change: read
    note: Its private porcelainPaths parses the same -z format; F-019 owns the file
  - path: src/core/transitions.ts
    change: read
    note: moveFeature evaluates the done gate over analyzeProject and words the refusal (failGate)
  - path: src/core/glob.ts
    change: read
    note: globToRegExp and matchesAny behind traceTests' file selection
  - path: src/server/export.ts
    change: read
    note: Exports copy the index, so committed reaches shared snapshots unchanged
  - path: viewer/src/lib/format.ts
    change: read
    note: plural for the chip's test count
  - path: viewer/src/lib/status.ts
    change: read
    note: COVERAGE_LOOK labels the chip and the coverage cell
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll and git for temporary repositories
  - path: test/helpers/project.ts
    change: read
    note: featureFiles, makeFacts and loadTree
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs trace in process
  - path: test/fixtures/hookline/expected-index.ts
    change: test
    note: The golden index's five scenario tests gain committed true (the Hookline repo's test files are clean)
  - path: test/core/git-trace.test.ts
    change: test
    note: gitFacts changed and dirty against real git
  - path: test/core/committed-tests.test.ts
    change: test
    note: markCommitted against real git; the done gate's count and detail
  - path: test/cli/trace.test.ts
    change: test
    note: trace's (uncommitted) mark and committed in --json; S-013.2.4's expected JSON gains committed true
  - path: viewer/src/screens/feature/StoriesTab.test.tsx
    change: test
    note: The scenario card's chip, open list and uncommitted tag
  - path: viewer/src/screens/Verification.test.tsx
    change: test
    note: The coverage table's test cell tag and title
---
# F-020: Impact map

The facts change in two places: `gitFacts` widens its one status call to list untracked files
and keeps the changed paths, and the new `markCommitted` in `trace.ts` reads HEAD's copies of the
changed test files only. `analyzeProject` chains them, so the index, every gate and the CLI see
the marked refs. `coverageOf` carries the mark into the index, `trace` prints it, the viewer
tags it, and `done.scenarios-passing` stops counting a scenario whose tests are all
uncommitted. `verify.ts`, `junit.ts` and `scanTestFile` stay as they are.

Two existing tests assert the exact shape of a scenario's tests and gain `committed: true`: the
Hookline golden index (`satisfies Index`, so the type requires it) and S-013.2.4's JSON in
`test/cli/trace.test.ts`. Both only describe the new field; no assertion is loosened.
