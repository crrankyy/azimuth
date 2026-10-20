# F-019: Stories

The pure scenarios (ST-019.1, ST-019.2) state their whole input. The others use this project
unless they say otherwise. It is a git repository whose HEAD holds:

- `.azimuth/config.yaml` with `tests.globs: ["test/**/*.test.ts"]`, and a `.gitignore` with
  `.azimuth/cache/`;
- the files `src/a.ts`, `src/c.ts` and `src/other.ts`;
- `test/a.test.ts` holding `it("S-001.1.1 works", () => {});`, and `test/keymap.test.ts` holding
  `it("S-001.1.1 maps the default keys", () => {});`;
- F-001 in progress in `.azimuth/features/F-001-thing/`, with:
  - story ST-001.1, whose scenarios are S-001.1.1 {happy} and S-001.1.2 {negative};
  - an impact.md whose only entry is `src/c.ts` (modify);
  - T-001.1 in progress, with `files: [src/a.ts, test/a.test.ts]`,
    `covers: [S-001.1.1, S-001.1.2]` and verify `echo S-001.1.1 ok`.

Terms the scenarios use:

- "The task's files changed": `src/a.ts` and `test/a.test.ts` differ from HEAD.
- "The stray test" (#2's repro): `test/keymap.test.ts` has changed to hold, after its first line,
  `it("S-001.1.2 maps the palette keys", () => {});`. It adds a marker for a scenario the task
  covers, in a file the task doesn't list.
- `finishTask` runs with `actor: "agent"` and the message `feat(F-001): add a`.
- In a THEN, `<sha>` is HEAD's 7-character SHA after the call, and `<n>` is a duration with one
  decimal. Steps are written `<step> <status>`.

## ST-019.1 · Which changed files finish refuses
**Intent:** As an orchestrator, I want finish to tell apart a stray change that proves the task's scenarios or belongs to the feature's plan from an unrelated one, so that only files someone must decide about stop the commit.

### S-019.1.1 · A test adding a covered marker and an unclaimed impact path are refused {happy}
- **GIVEN** the changed paths `.azimuth/features/F-001-thing/plan.md`, `src/a.ts`, `src/c.ts`, `src/d.ts` and `test/keymap.test.ts`, and a context whose task is T-001.1 (`files: [src/a.ts]`, `covers: [S-001.1.1, S-001.1.2]`), whose feature is F-001 (`dir` `.azimuth/features/F-001-thing/`, impact `src/c.ts` modify and `src/d.ts` read), with no other in-progress task, the test globs `["test/**/*.test.ts"]`, and texts giving `test/keymap.test.ts` the working copy `it("S-001.1.1 maps keys", () => {});\nit("S-001.1.2 maps the palette", () => {});\n` and the HEAD copy `it("S-001.1.1 maps keys", () => {});\n`
- **WHEN** `unlistedFiles(changed, ctx)` runs
- **THEN** it returns `[{ path: "src/c.ts", reason: { kind: "impact", change: "modify" } }, { path: "test/keymap.test.ts", reason: { kind: "marker", scenarios: ["S-001.1.2"] } }]`

### S-019.1.2 · Changes that add no covered marker, or that another lane lists, pass {edge}
- **GIVEN** the changed paths `src/c.ts`, `test/keymap.test.ts` and `test/other.test.ts`, the context of S-019.1.1 with another in-progress task T-002.1 (`files: [src/c.ts]`), and texts giving `test/keymap.test.ts` the working copy `it("S-001.1.1 maps keys", () => {});\nit("S-001.1.1 maps more keys", () => {});\n` and the HEAD copy `it("S-001.1.1 maps keys", () => {});\n`, and giving `test/other.test.ts` no HEAD copy and the working copy `// S-001.1.2 is proved in keymap\nit("S-001.2.1 opens", () => {});\n`
- **WHEN** `unlistedFiles(changed, ctx)` runs
- **THEN** it returns `[]`

### S-019.1.3 · A `!` glob excludes a path from the test files {edge}
- **GIVEN** the globs `["test/**/*.test.ts", "!test/fixtures/**"]`
- **WHEN** `testFileMatcher(globs)` is applied to `test/core/a.test.ts`, `test/fixtures/demo/a.test.ts` and `src/a.ts`
- **THEN** it returns `true`, `false` and `false`

## ST-019.2 · The not-staged split and the shared-file warning
**Intent:** As an orchestrator, I want the paths finish leaves out sorted by whose they are, and a warning when a commit carries another lane's half of a shared file, so that the one source file that matters isn't lost among records and other lanes' files.

### S-019.2.1 · Left-out paths split into three lists {happy}
- **GIVEN** the paths left out `.azimuth/features/F-002-more/log.md`, `.azimuth/sessions/SES-20261020-0900.md`, `src/b.ts`, `src/other.ts` and `src/parser/x.ts`, and other in-progress tasks with `files: [src/b.ts]` and `files: [src/parser/]`
- **WHEN** `splitNotStaged(notStaged, others)` runs
- **THEN** it returns `{ outside: ["src/other.ts"], other_tasks: ["src/b.ts", "src/parser/x.ts"], records: [".azimuth/features/F-002-more/log.md", ".azimuth/sessions/SES-20261020-0900.md"] }`

### S-019.2.2 · A directory entry claims only the files under it {edge}
- **GIVEN** the paths left out `src/parser.ts` and `src/parserx/a.ts`, and one other in-progress task with `files: ["./src/parser/"]`
- **WHEN** `splitNotStaged(notStaged, others)` runs
- **THEN** it returns `{ outside: ["src/parser.ts", "src/parserx/a.ts"], other_tasks: [], records: [] }`

### S-019.2.3 · A staged shared file another lane lists warns {happy}
- **GIVEN** the staged paths `src/a.ts` and `src/registry.ts`, the shared files `["src/registry.ts"]`, and other in-progress tasks T-001.2 (`files: [src/registry.ts, src/b.ts]`) and T-002.1 (`files: [src/registry.ts]`)
- **WHEN** `sharedStaged(staged, sharedFiles, others)` runs
- **THEN** it returns `[{ path: "src/registry.ts", tasks: ["T-001.2", "T-002.1"] }]`

### S-019.2.4 · No warning without another lane on a shared file {edge}
- **GIVEN** the staged paths `src/a.ts` and `src/registry.ts`, the shared files `["src/registry.ts"]`, and one other in-progress task T-001.2 with `files: [src/a.ts]`
- **WHEN** `sharedStaged(staged, sharedFiles, others)` runs
- **THEN** it returns `[]`

## ST-019.3 · finish refuses an unlisted file before it writes anything
**Intent:** As an orchestrator, I want finish to stop when a changed file it would leave out proves this task's scenarios or belongs to the feature's plan, so that no proving test stays out of the repository (#2).

### S-019.3.1 · Changes that need no decision pass, split by owner {happy}
- **GIVEN** the task's files changed, `test/keymap.test.ts` changed to also hold `it("S-001.1.1 maps more keys", () => {});`, `src/c.ts` and `src/other.ts` changed, and HEAD also holding F-002 in progress in `.azimuth/features/F-002-more/`, whose T-002.1 is in progress with `files: [src/c.ts]` and whose log.md has since gained an entry
- **WHEN** `finishTask(root, "T-001.1", { message: "feat(F-001): add a", actor: "agent" })` runs
- **THEN** `ok` is true, the steps are `check done, stage done, commit done, verify done, done done, log done`, and HEAD changes exactly `src/a.ts` and `test/a.test.ts`
- **AND** `not_staged` is `[".azimuth/features/F-002-more/log.md", "src/c.ts", "src/other.ts", "test/keymap.test.ts"]`, `not_staged_outside` is `["src/other.ts", "test/keymap.test.ts"]`, `not_staged_other_tasks` is `["src/c.ts"]`, `not_staged_records` is `[".azimuth/features/F-002-more/log.md"]` and `shared` is `[]`

### S-019.3.2 · The #2 repro is refused {negative}
- **GIVEN** the task's files changed and the stray test
- **WHEN** `finishTask` runs for T-001.1 with `note: "Counts the BOM."`
- **THEN** `ok` is false and the steps are `check failed, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run`
- **AND** the check's detail is `Changed outside T-001.1's files: test/keymap.test.ts. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.` and its output is `test/keymap.test.ts: adds a marker for S-001.1.2, which T-001.1 covers`
- **AND** HEAD is unchanged, `git diff --cached --name-only` prints nothing, notes.md doesn't exist, plan.md is byte-identical to HEAD's copy and `.azimuth/cache/runs/` holds no file

### S-019.3.3 · An untracked new test file is refused {negative}
- **GIVEN** the task's files changed, and an untracked `test/palette.test.ts` holding `it("S-001.1.1 opens the palette", () => {});` and `it("S-001.1.2 closes it", () => {});`
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the check fails with output `test/palette.test.ts: adds markers for S-001.1.1, S-001.1.2, which T-001.1 covers`, every later step is `not-run`, and `git status --porcelain` still shows `?? test/palette.test.ts`

### S-019.3.4 · An impact path no in-progress task lists is refused {negative}
- **GIVEN** the task's files changed, `src/c.ts` changed, and F-001's second task T-001.2, still `todo`, with `files: [src/c.ts]` and `covers: []`
- **WHEN** `finishTask` runs for T-001.1
- **THEN** the check fails with a detail that starts `Changed outside T-001.1's files: src/c.ts.` and the output `src/c.ts: a modify path in F-001's impact.md that no in-progress task lists`, and every later step is `not-run`

## ST-019.4 · --adopt adds a changed file to the task
**Intent:** As an orchestrator, I want to add a file a lane had to change to its task in the same finish, so that the file lands in the task's commit without a plan.md edit, a docs commit and a reapprove (§4.3).

### S-019.4.1 · Adopting the stray test commits it with the task {happy}
- **GIVEN** the task's files changed and the stray test
- **WHEN** `finishTask` runs for T-001.1 with `adopt: ["test/keymap.test.ts"]` and `note: "Counts the BOM."`
- **THEN** `ok` is true, the steps are `check done, adopt done, note done, stage done, commit done, verify done, done done, log done`, and the adopt step's detail is `added to T-001.1's files: test/keymap.test.ts`
- **AND** HEAD changes exactly `.azimuth/features/F-001-thing/notes.md`, `.azimuth/features/F-001-thing/plan.md`, `src/a.ts`, `test/a.test.ts` and `test/keymap.test.ts`, and T-001.1's `files` in HEAD's plan.md are `["src/a.ts", "test/a.test.ts", "test/keymap.test.ts"]`

### S-019.4.2 · A renamed test is refused under its new path, then adopted {edge}
- **GIVEN** `src/a.ts` changed, and `test/a.test.ts` moved to `test/parse.test.ts` with `mv` (content unchanged), so `git status --porcelain` shows ` D test/a.test.ts` and `?? test/parse.test.ts`
- **WHEN** `finishTask` runs for T-001.1, then again with `adopt: ["test/parse.test.ts"]`
- **THEN** the first fails at the check with the output `test/parse.test.ts: adds a marker for S-001.1.1, which T-001.1 covers`, and the second has `ok` true
- **AND** `git show --name-status --no-renames --format= HEAD` prints the lines `M\t.azimuth/features/F-001-thing/plan.md`, `M\tsrc/a.ts`, `D\ttest/a.test.ts` and `A\ttest/parse.test.ts`

### S-019.4.3 · Adopting an unchanged path is refused {negative}
- **GIVEN** the task's files changed and `src/other.ts` unchanged
- **WHEN** `finishTask` runs for T-001.1 with `adopt: ["src/other.ts"]`
- **THEN** the steps are `check failed, adopt not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run`, the check's detail is `Can't adopt src/other.ts: git status shows no change to it.`, and plan.md is byte-identical to HEAD's copy

### S-019.4.4 · Adopting another in-progress task's path is refused {negative}
- **GIVEN** F-001's second task T-001.2 in progress with `files: [test/keymap.test.ts]` and `covers: []`, the task's files changed and the stray test
- **WHEN** `finishTask` runs for T-001.1 with `adopt: ["test/keymap.test.ts"]`
- **THEN** the check fails with the detail `Can't adopt test/keymap.test.ts: T-001.2 lists it and is in progress, so it goes in T-001.2's commit.`, every later step is `not-run`, and plan.md is byte-identical to HEAD's copy

### S-019.4.5 · A refusal writes neither notes.md nor plan.md {edge}
- **GIVEN** the task's files changed, the stray test, and `src/c.ts` changed with no task listing it
- **WHEN** `finishTask` runs for T-001.1 with `adopt: ["test/keymap.test.ts"]` and `note: "Counts the BOM."`
- **THEN** the steps are `check failed, adopt not-run, note not-run, stage not-run, commit not-run, verify not-run, done not-run, log not-run`, and the check's output is `src/c.ts: a modify path in F-001's impact.md that no in-progress task lists`
- **AND** notes.md doesn't exist, plan.md is byte-identical to HEAD's copy, HEAD is unchanged and `git diff --cached --name-only` prints nothing

### S-019.4.6 · A rerun with the same --adopt after a failed verify {edge}
- **GIVEN** T-001.1's verify `grep -q fixed src/a.ts && echo S-001.1.1 ok`, `src/a.ts` holding `broken` and the stray test, a `finishTask` with `adopt: ["test/keymap.test.ts"]` that committed them and recorded R-0001 failed, and then `src/a.ts` changed to hold `fixed`
- **WHEN** `finishTask` runs for T-001.1 with `adopt: ["test/keymap.test.ts"]` and the message `fix(F-001): fix a`
- **THEN** `ok` is true, the adopt step is `{ step: "adopt", status: "done", detail: "already T-001.1's files: test/keymap.test.ts", output: "" }`, and HEAD changes exactly `.azimuth/features/F-001-thing/log.md` and `src/a.ts`

## ST-019.5 · task finish on the command line
**Intent:** As an orchestrator, I want task finish to print the refusal, the adopt step, the left-out paths by owner and the shared-file warning, so that one read of its output tells me what stayed out and why.

### S-019.5.1 · --adopt prints its step and exits 0 {happy}
- **GIVEN** the task's files changed and the stray test
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a" --adopt test/keymap.test.ts` runs
- **THEN** it exits 0 and stdout is exactly the lines `✓ check: F-001 has no errors`, `✓ adopt: added to T-001.1's files: test/keymap.test.ts`, `✓ stage: .azimuth/features/F-001-thing/plan.md, src/a.ts, test/a.test.ts, test/keymap.test.ts`, `✓ commit: <sha> feat(F-001): add a`, `✓ verify: R-0001 passed in <n>s`, `✓ done: T-001.1: in-progress → done` and `✓ log: Committed <sha>; R-0001 passed.`

### S-019.5.2 · A refusal prints each file and exits 1 {negative}
- **GIVEN** the task's files changed and the stray test
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a"` runs
- **THEN** it exits 1 with HEAD unchanged, and stdout is exactly the lines `✗ check: Changed outside T-001.1's files: test/keymap.test.ts. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.`, `    test/keymap.test.ts: adds a marker for S-001.1.2, which T-001.1 covers`, `- stage: not run`, `- commit: not run`, `- verify: not run`, `- done: not run` and `- log: not run`

### S-019.5.3 · Left-out paths print by owner, and a shared file warns {happy}
- **GIVEN** config.yaml with `parallel.shared_files: [src/registry.ts]`; HEAD also holding `src/registry.ts`, `src/b.ts` and F-002 in progress in `.azimuth/features/F-002-more/`, whose T-002.1 is in progress with `files: [src/registry.ts, src/b.ts]`; T-001.1's `files` being `[src/a.ts, test/a.test.ts, src/registry.ts]`; and the task's files, `src/registry.ts` (one new line from each lane), `src/b.ts` and `src/other.ts` changed, and F-002's log.md given a new entry
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a"` runs
- **THEN** it exits 0 and stdout's first seven lines are `✓ check: F-001 has no errors`, `✓ stage: src/a.ts, src/registry.ts, test/a.test.ts`, `  not staged: src/other.ts`, `  not staged, other in-progress tasks: src/b.ts`, `  not staged, records: .azimuth/features/F-002-more/log.md`, `  warning: src/registry.ts carries T-002.1's work in progress; this commit may not build on its own.` and `✓ commit: <sha> feat(F-001): add a`

### S-019.5.4 · --json adds the split lists and the shared files {edge}
- **GIVEN** the project and changes of S-019.5.3
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a" --json` runs
- **THEN** it exits 0 and stdout parses to an object with `ok` true, `staged` `["src/a.ts", "src/registry.ts", "test/a.test.ts"]`, `not_staged` `[".azimuth/features/F-002-more/log.md", "src/b.ts", "src/other.ts"]`, `not_staged_outside` `["src/other.ts"]`, `not_staged_other_tasks` `["src/b.ts"]`, `not_staged_records` `[".azimuth/features/F-002-more/log.md"]` and `shared` `[{ "path": "src/registry.ts", "tasks": ["T-002.1"] }]`

### S-019.5.5 · An empty --adopt is a usage error {negative}
- **GIVEN** the task's files changed
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a" --adopt " , "` runs
- **THEN** it exits 2 with HEAD unchanged and plan.md byte-identical to HEAD's copy, and its stderr starts with `task finish --adopt needs a path: --adopt <path,…>.`
