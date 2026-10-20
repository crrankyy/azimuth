---
tasks:
  - id: T-022.1
    title: Shared-file rules and the closing request (red → green)
    status: todo
    after: []
    covers: [S-022.1.1, S-022.1.2, S-022.1.3, S-022.3.1, S-022.3.2, S-022.3.3]
    files: [src/core/task-brief.ts, test/core/task-brief.test.ts]
    verify: pnpm exec vitest run test/core/task-brief.test.ts -t "S-022.1|S-022.3|S-009.7" --reporter=verbose
    note: null
  - id: T-022.2
    title: The Conventions section and the full brief (red → green)
    status: todo
    after: [T-022.1]
    covers: [S-022.2.1, S-022.2.2, S-022.2.3, S-022.2.4, S-022.2.5, S-022.2.6, S-022.4.1, S-022.4.2]
    files: [src/core/task-brief.ts, src/core/init.ts, test/core/task-brief.test.ts]
    verify: pnpm exec vitest run test/core/task-brief.test.ts -t "S-022.2|S-022.4|S-009.7" --reporter=verbose && pnpm exec vitest run test/core/support.test.ts --reporter=verbose
    note: null
  - id: T-022.3
    title: Build skill, docs and full verification
    status: todo
    after: [T-022.2]
    covers: []
    files: [docs/cli.md, plugin/skills/build/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-022: Plan

Test-first, no scaffolding task: the change is one module and its test file, so the two code
tasks run one after the other (both change `task-brief.ts` and `task-brief.test.ts`).

- **T-022.1** adds the rules. In `task-brief.ts`: `OPEN_RULE` loses its report clause,
  `STANDING_RULES` its last line; `sharedFileRule`, `SHARED_RULES`, `CLOSING_RULE`,
  `CLOSING_OPEN_CLAUSE`, `sharedFileRules` and `closingRule` as contract.md gives them; the
  Rules of `taskBrief` become test-name rules, `STANDING_RULES`, the shared-file rules,
  `OPEN_RULE` when open, then `closingRule(open)`. In the test file, F-009's tests follow the
  new last rules by decision, not to make them pass: `EXAMPLE_BRIEF`'s last line becomes the
  closing request of S-022.3.1, the test's `OPEN_RULE` constant loses its report clause, and
  S-009.7.2 checks the last two lines (`OPEN_RULE`, then the closing request with the clause)
  instead of the last one.
- **T-022.2** adds the Conventions section. `init.ts` exports `CONVENTIONS_TEMPLATE` and
  `projectDocs` writes `---\nupdated: ${date}\n---\n${CONVENTIONS_TEMPLATE}`, the same bytes as
  now (`support.test.ts` runs `initProject`). `task-brief.ts` moves `contractText`'s heading
  loop into `nestHeadings` and adds `isConventionsTemplate`, `conventionsBody`,
  `CONVENTIONS_MAX_WORDS` and `conventionsPointer`, and the `## Conventions` part after the notes.
  `task-brief.ts` importing `init.ts` is fine: neither is in the Node-free list of
  architecture.md, and `init.ts` doesn't import the brief.
- **T-022.3** updates the agent instructions and docs, then runs everything.

Notes for builders:

- Test names start with the scenario ID, one `describe` per story (`ST-022.1 …`), next to
  F-009's in `test/core/task-brief.test.ts`. Extend `exampleFiles` with options rather than
  copying it: `sharedFiles` (a YAML flow list appended as `parallel:\n  shared_files: <list>\n`
  to the config), `conventions` (the text of `.azimuth/project/conventions.md`) and `plan`
  (S-022.1.2 replaces T-001.2's `files` line of `PLAN`).
- "The Rules" in the stories are `brief.split("## Rules\n\n")[1]?.split("\n")`.
- S-022.2.3: run `initProject(root, { now: new Date("2025-01-01T00:00:00Z") })` in a second
  `writeTree({})` folder, read its `.azimuth/project/conventions.md` and write that text into
  the example project, so the test proves the template `init` really writes is recognised.
  Clean up both folders. Its AND adds a blank line after each `## ` line
  (`text.replace(/^(## .*)$/gm, "$1\n")`).
- Write each conventions variant into its own `writeTree` folder: `loadProject` memoises a
  parsed file by path, mtime and size (`cached` in `model.ts`), so rewriting a file in place
  within the same millisecond could return the old parse.
- S-022.2.5 and S-022.2.6: `Array(1501).fill("rule").join(" ")` (and 1500).
- S-022.4.1: copy `CONVENTIONS` and `F022_EXAMPLE_BRIEF` from contract.md into the test.
- S-022.4.2: `vi.useFakeTimers()` and `vi.setSystemTime(…)` before each `loadProject` and
  `taskBrief`, and `vi.useRealTimers()` in `afterEach`; the two folders come from two
  `writeTree` calls.
- T-022.3:
  - `docs/cli.md`, the `azimuth brief` paragraph after the Read table: after "the feature's
    `notes.md`", add "the project's `conventions.md`, its headings one level deeper (left out
    while it is missing, empty or still the template `init` wrote; above 1,500 words, one line
    pointing to the file)". In the rules list: for each listed file that matches
    `parallel.shared_files`, one complete insertion to it, no edit or reordering of another
    task's insertion and no formatter over it or its package; what `{?}` means when a covered
    scenario holds one; and last, what to report: the files changed, the verify result, what
    the task taught, each file changed outside the list and why, and each `{?}` value the
    tests proved as `<scenario ID>: <value>`. Change nothing else in `docs/cli.md`.
  - `plugin/skills/build/SKILL.md`, "Delegating to subagents" only. The hand-off bullet: the
    brief's rules now include the shared-file rules and ask the subagent to report what the
    task taught, the files it changed outside its list and why, and each `{?}` value; add only
    what the records don't hold. You settle the values, pass the lesson to
    `task finish --note`, and deal with each file changed outside the list. The "Shared files
    take insertions only" bullet: the brief tells the subagent to add one complete insertion,
    never to edit another task's insertion and not to run a formatter over the file or its
    package; you add which other tasks in the batch add to which shared file. Leave the
    batch-finish bullets to F-018 and step 4 to F-019.

Files shared with other 0.3 features (change only F-022's part; `W-FILE-CONFLICT` for them is
expected): `docs/cli.md` (F-018, F-019, F-021, F-024) and `plugin/skills/build/SKILL.md` (F-018,
F-019, F-024). `src/core/glob.ts` is changed by F-019 and only read here. No other 0.3 feature
lists `task-brief.ts`, its test or `init.ts`.
