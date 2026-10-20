# F-020: Stories

Unless a scenario says otherwise, the project is a git repository whose HEAD holds a
`.gitignore` with `.azimuth/cache/`, `.azimuth/config.yaml` with `tests.globs:
["test/**/*.test.ts"]` (MINIMAL_CONFIG), `src/app.ts`, and F-001 `in-progress` in
`.azimuth/features/F-001-thing/` (story ST-001.1 with S-001.1.1 {happy} and S-001.1.2
{negative}, both titled `Scenario`), whose T-001.1 covers both. HEAD's `test/keymap.test.ts` is
`it("S-001.1.1 opens the palette", () => {});` and a newline.

"The #2 change" appends `it("S-001.1.2 lists keys in every preset", () => {});` and a newline to
the working copy of `test/keymap.test.ts` and commits nothing: the shape of GitHub #2. "R-0001"
is a recorded run of T-001.1 with `ok: true` that lists S-001.1.1 and S-001.1.2 as `passing`.

"The close-out repository" is that project with F-001 `verifying` and T-001.1 `done`, in which
every done check except `done.scenarios-passing` passes: R-0001 was made at the commit that
changed `src/app.ts` with `Refs: T-001.1`, and HEAD after it is a close-out commit that adds
`as-built.md` and sets `reconciled_at` in `architecture.md` to that commit, changing only
`.azimuth/`. "The scenarios check" is the `done.scenarios-passing` entry of F-001's
`derived.next_gate.checks` in `buildIndex(root).index`.

## ST-020.1 · The git facts list every changed path
**Intent:** As the analysis, I want one status call to list the modified, added and untracked paths, so that the committed-test check finds a new test file without another git call.

### S-020.1.1 · Modified, staged and untracked files are listed {happy}
- **GIVEN** HEAD also holds `test/a.test.ts`; then `src/app.ts` is modified, `test/c.test.ts` is created and staged with `git add`, and `test/b.test.ts` is created and left untracked
- **WHEN** `gitFacts(root, loadProject(root))` runs
- **THEN** `changed` is `["src/app.ts", "test/b.test.ts", "test/c.test.ts"]` and `dirty` is `true`

### S-020.1.2 · An untracked file alone leaves the tree clean {edge}
- **GIVEN** only `test/b.test.ts` is created after HEAD, and left untracked
- **WHEN** `gitFacts(root, loadProject(root))` runs
- **THEN** `changed` is `["test/b.test.ts"]` and `dirty` is `false`

### S-020.1.3 · Each file of an untracked directory is listed {edge}
- **GIVEN** an untracked directory `test/new/` holding `test/new/a.test.ts` and `test/new/b.test.ts`, and no other change since HEAD
- **WHEN** `gitFacts(root, loadProject(root))` runs
- **THEN** `changed` is `["test/new/a.test.ts", "test/new/b.test.ts"]`

### S-020.1.4 · Outside a repository nothing is changed {edge}
- **GIVEN** the project's files in a folder that isn't a git repository
- **WHEN** `gitFacts(root, loadProject(root))` runs
- **THEN** `available` is `false` and `changed` is `[]`

## ST-020.2 · Only a test missing from HEAD's copy is uncommitted
**Intent:** As the analysis, I want each test reference marked committed or not by comparing the changed test files with HEAD's copies, so that a scenario credited from the working tree can be told apart without reading clean files.

### S-020.2.1 · A test added to a tracked file is uncommitted {happy}
- **GIVEN** the #2 change
- **WHEN** `markCommitted(root, traceTests(root, ["test/**/*.test.ts"]), ["test/keymap.test.ts"])` runs
- **THEN** its S-001.1.1 refs are `[{ file: "test/keymap.test.ts", name: "S-001.1.1 opens the palette", confidence: "marker", committed: true }]` and its S-001.1.2 refs are `[{ file: "test/keymap.test.ts", name: "S-001.1.2 lists keys in every preset", confidence: "marker", committed: false }]`
- **AND** no ref in the map `traceTests` returned has a `committed` field

### S-020.2.2 · A new untracked test file is uncommitted {happy}
- **GIVEN** an untracked `test/palette.test.ts` holding `it("S-001.1.2 lists keys in every preset", () => {});`
- **WHEN** `markCommitted(root, traceTests(root, ["test/**/*.test.ts"]), ["test/palette.test.ts"])` runs
- **THEN** its S-001.1.2 ref in `test/palette.test.ts` has `committed: false` and its S-001.1.1 ref in `test/keymap.test.ts` has `committed: true`

### S-020.2.3 · A changed body keeps a committed marker {edge}
- **GIVEN** HEAD's `test/keymap.test.ts` is `it("S-001.1.1 opens the palette", () => { expect(1).toBe(1); });`, and its working copy is `it("S-001.1.1 opens the palette", () => { expect(2).toBe(2); });`
- **WHEN** `markCommitted(root, traceTests(root, ["test/**/*.test.ts"]), ["test/keymap.test.ts"])` runs
- **THEN** its S-001.1.1 refs are `[{ file: "test/keymap.test.ts", name: "S-001.1.1 opens the palette", confidence: "marker", committed: true }]`

### S-020.2.4 · A renamed test is uncommitted {negative}
- **GIVEN** HEAD's `test/keymap.test.ts` is `it("S-001.1.1 opens", () => {});`, and its working copy is `it("S-001.1.1 opens the palette", () => {});`
- **WHEN** `markCommitted(root, traceTests(root, ["test/**/*.test.ts"]), ["test/keymap.test.ts"])` runs
- **THEN** its S-001.1.1 refs are `[{ file: "test/keymap.test.ts", name: "S-001.1.1 opens the palette", confidence: "marker", committed: false }]`

### S-020.2.5 · Files outside the changed list aren't read {edge}
- **GIVEN** a folder that isn't a git repository, holding `test/keymap.test.ts` with `it("S-001.1.1 opens the palette", () => {});`, so any read of HEAD would fail
- **WHEN** `markCommitted(root, tests, [])` and `markCommitted(root, tests, null)` run, `tests` being `traceTests(root, ["test/**/*.test.ts"])`
- **THEN** both give S-001.1.1 the refs `[{ file: "test/keymap.test.ts", name: "S-001.1.1 opens the palette", confidence: "marker", committed: true }]`

## ST-020.3 · trace marks a test that is only in the working tree
**Intent:** As an orchestrator closing out a feature, I want `azimuth trace` to say when a credited test isn't committed, so that I commit it before the feature is done instead of finding it in `git status` later.

### S-020.3.1 · trace marks the test the #2 change added {happy}
- **GIVEN** the #2 change and R-0001
- **WHEN** `azimuth trace F-001` runs
- **THEN** it exits 0 and stdout is `S-001.1.1 passing Scenario\n    test/keymap.test.ts: S-001.1.1 opens the palette\nS-001.1.2 passing Scenario\n    test/keymap.test.ts: S-001.1.2 lists keys in every preset (uncommitted)\n`

### S-020.3.2 · trace --json gives every test its committed field {happy}
- **GIVEN** the #2 change and R-0001
- **WHEN** `azimuth trace F-001 --json` runs
- **THEN** the S-001.1.2 row's `tests` are `[{ "file": "test/keymap.test.ts", "name": "S-001.1.2 lists keys in every preset", "status": "passing", "confidence": "marker", "committed": false }]`
- **AND** the S-001.1.1 row's `tests` are `[{ "file": "test/keymap.test.ts", "name": "S-001.1.1 opens the palette", "status": "passing", "confidence": "marker", "committed": true }]`

### S-020.3.3 · Once committed, the test loses its mark {edge}
- **GIVEN** the #2 change committed with `git commit -am "test(F-001): add the keymap test"`, and R-0001
- **WHEN** `azimuth trace F-001` and `azimuth trace F-001 --json` run
- **THEN** the first prints `S-001.1.1 passing Scenario\n    test/keymap.test.ts: S-001.1.1 opens the palette\nS-001.1.2 passing Scenario\n    test/keymap.test.ts: S-001.1.2 lists keys in every preset\n`
- **AND** every test in the second's rows has `"committed": true`

### S-020.3.4 · An uncommitted mention carries both marks {edge}
- **GIVEN** the working copy of `test/keymap.test.ts` appends `// S-001.1.2 waits for the bank stub.` and a newline (instead of the #2 change), and R-0001
- **WHEN** `azimuth trace F-001 --all` runs
- **THEN** its S-001.1.2 test line is `    test/keymap.test.ts: // S-001.1.2 waits for the bank stub. (mention) (uncommitted)`

### S-020.3.5 · Without git every test counts as committed {edge}
- **GIVEN** the project's files with the #2 change already in `test/keymap.test.ts`, and R-0001 with `commit: null`, in a folder that isn't a git repository
- **WHEN** `azimuth trace F-001` and `azimuth trace F-001 --json` run
- **THEN** the first prints no `(uncommitted)`, and every test in the second's rows has `"committed": true`

## ST-020.4 · The done gate counts only scenarios with a committed passing test
**Intent:** As the project owner, I want the done gate to refuse a scenario proven only by a test outside the repository, so that a done feature's tests are all in its history.

### S-020.4.1 · The #2 shape is refused {negative}
- **GIVEN** the close-out repository with the #2 change
- **WHEN** `moveFeature(root, "F-001", "done", { actor: "agent" })` runs
- **THEN** it throws an AzimuthError with code `gate` and the message `F-001 cannot move to done: Every scenario has a passing test (1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts).`
- **AND** F-001's status in feature.md is still `verifying`

### S-020.4.2 · The same test after its commit is counted {happy}
- **GIVEN** the close-out repository with the #2 change committed by `git commit -am "test(F-001): add the keymap test"`
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: true, detail: "2 of 2" }`

### S-020.4.3 · A new untracked test file isn't counted {negative}
- **GIVEN** the close-out repository with an untracked `test/palette.test.ts` holding `it("S-001.1.2 lists keys in every preset", () => {});`, the only test of S-001.1.2
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: false, detail: "1 of 2; S-001.1.2 only in uncommitted test/palette.test.ts" }`

### S-020.4.4 · One committed passing test is enough {edge}
- **GIVEN** the close-out repository whose HEAD's `test/keymap.test.ts` also holds `it("S-001.1.2 lists keys", () => {});`, with an untracked `test/palette.test.ts` holding `it("S-001.1.2 lists keys in every preset", () => {});`
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: true, detail: "2 of 2" }`

### S-020.4.5 · A modified file whose marker is already in HEAD is counted {edge}
- **GIVEN** the close-out repository whose HEAD's `test/keymap.test.ts` also holds `it("S-001.1.2 lists keys in every preset", () => { expect(1).toBe(1); });`, and whose working copy changes that test's body to `{ expect(2).toBe(2); }`
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: true, detail: "2 of 2" }`

### S-020.4.6 · The detail names each scenario left out and its files {edge}
- **GIVEN** F-001 `verifying` with S-001.1.1 {happy}, S-001.1.2 {negative} and S-001.1.3 {edge} all `passing` in R-0001, and facts (`makeFacts`) whose tests give S-001.1.1 a ref in `test/a.test.ts` without a `committed` field, S-001.1.2 refs in `test/c.test.ts` and `test/b.test.ts` with `committed: false`, and S-001.1.3 a ref in `test/d.test.ts` with `committed: false`, every ref with `confidence: "marker"`
- **WHEN** `evaluateGate(ctx, F-001, "done")` runs
- **THEN** its `done.scenarios-passing` check has `ok: false` and the detail `1 of 3; S-001.1.2 only in uncommitted test/b.test.ts, test/c.test.ts; S-001.1.3 only in uncommitted test/d.test.ts`

### S-020.4.7 · Without git scenarios count as before {edge}
- **GIVEN** the close-out repository's files with the #2 change already in `test/keymap.test.ts`, and R-0001 with `commit: null`, in a folder that isn't a git repository
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: true, detail: "2 of 2" }`

### S-020.4.8 · A committed mention doesn't stand in for an uncommitted marked test {negative}
- **GIVEN** the close-out repository with the #2 change, whose HEAD also holds `test/notes.test.ts` with the line `// Covers S-001.1.2 once the keymap lands.` (a mention)
- **WHEN** `buildIndex(root)` runs
- **THEN** the scenarios check is `{ id: "done.scenarios-passing", rule: "Every scenario has a passing test", ok: false, detail: "1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts" }`

## ST-020.5 · The viewer tags an uncommitted test
**Intent:** As the project owner watching the viewer, I want a test that is only in the working tree tagged wherever a scenario's tests are listed, so that I see why the done gate doesn't count it.

In this story "the mixed scenario" is a `passing` S-001.1.1 titled `Finds the heading` whose
tests are `{ file: "test/a.test.ts", name: "S-001.1.1 works", status: "passing", confidence:
"marker", committed: true }` and `{ file: "test/b.test.ts", name: "S-001.1.1 also works",
status: "passing", confidence: "marker", committed: false }`, and "the committed scenario" is the
same scenario with only the first test.

### S-020.5.1 · The stories tab tags the uncommitted test {happy}
- **GIVEN** the mixed scenario
- **WHEN** `renderToStaticMarkup` renders `<ScenarioCard scenario={…} />` inside the index context
- **THEN** the HTML holds `<span>passing · 2 tests · 1 uncommitted</span>` and the open list `<div class="fd-tests" id="fd-tests-S-001.1.1">`
- **AND** it holds `<span class="az-tag fd-test-uncommitted" title="Not committed: the done gate counts only tests in HEAD">uncommitted</span>` exactly once, in the row of `test/b.test.ts`

### S-020.5.2 · Committed tests carry no tag {negative}
- **GIVEN** the committed scenario
- **WHEN** `renderToStaticMarkup` renders `<ScenarioCard scenario={…} />` inside the index context
- **THEN** the HTML holds `<span>passing · 1 test</span>`, and neither `class="fd-tests"` nor `uncommitted`

### S-020.5.3 · The coverage table tags the scenario's test cell {happy}
- **GIVEN** the mixed scenario
- **WHEN** `renderToStaticMarkup` renders `<ScenarioRow scenario={…} now={…} onRun={() => {}} />`
- **THEN** its test cell holds the text `a.test.ts +1` followed by `<span class="az-tag vf-uncommitted" title="Not committed: the done gate counts only tests in HEAD">uncommitted</span>` as its last child
- **AND** the cell's title is `test/a.test.ts › S-001.1.1 works` and `test/b.test.ts › S-001.1.1 also works (uncommitted)` joined by a newline

### S-020.5.4 · A row of committed tests has no tag {negative}
- **GIVEN** the committed scenario
- **WHEN** `renderToStaticMarkup` renders `<ScenarioRow scenario={…} now={…} onRun={() => {}} />`
- **THEN** its test cell holds only the text `a.test.ts`, the cell's title is `test/a.test.ts › S-001.1.1 works`, and the HTML holds no `uncommitted`
