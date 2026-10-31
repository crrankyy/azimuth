---
tasks:
  - id: T-025.1
    title: runHistory picks, orders and caps runs (red → green)
    status: done
    after: []
    covers: [S-025.1.1, S-025.1.2, S-025.1.3, S-025.1.4, S-025.1.5, S-025.1.6, S-025.1.7, S-025.1.8]
    files: [src/core/runs.ts, test/core/runs.test.ts]
    verify: pnpm exec vitest run test/core/runs.test.ts -t "S-025.1" --reporter=verbose
    note: null
  - id: T-025.2
    title: azimuth runs prints one line per run (red → green)
    status: in-progress
    after: [T-025.1]
    covers: [S-025.2.1, S-025.2.2, S-025.2.3, S-025.2.4, S-025.2.5, S-025.2.6, S-025.2.7, S-025.2.8, S-025.2.9, S-025.2.10]
    files: [src/cli/commands/runs.ts, src/cli/verify-report.ts, src/cli/main.ts, test/cli/runs.test.ts]
    verify: pnpm exec vitest run test/cli/runs.test.ts -t "S-025.2" --reporter=verbose
    note: null
  - id: T-025.3
    title: azimuth show R-NNNN prints the whole run (red → green)
    status: todo
    after: [T-025.2]
    covers: [S-025.3.1, S-025.3.2, S-025.3.3, S-025.3.4, S-025.3.5, S-025.3.6, S-025.3.7, S-025.3.8]
    files: [src/cli/commands/runs.ts, src/cli/commands/read.ts, test/cli/show-run.test.ts]
    verify: pnpm exec vitest run test/cli/show-run.test.ts -t "S-025.3" --reporter=verbose
    note: null
  - id: T-025.4
    title: Docs, skills and full verification
    status: todo
    after: [T-025.3]
    covers: []
    files: [docs/cli.md, docs/file-format.md, plugin/skills/azimuth/SKILL.md, plugin/skills/bug/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-025: Plan

One chain, test-first: the core selection (T-025.1), the `runs` command on top of it (T-025.2),
then `show R-NNNN`, which reuses the run line and adds the page in the same command file
(T-025.3). T-025.4 writes the docs and skills, then runs everything.

Notes for builders:

- Test files write run files with a local `runFile(spec)` helper, as
  `test/core/prebuild-gate.test.ts` does: `JSON.stringify` of the fields the scenario names, with
  `command: "pnpm test"`, `scenarios: []`, `junit: null` and `output_tail: ""` as defaults, and a
  key left out of the file when the spec leaves it out (`waited_ms`, `ses`, `prebuild`). Put the
  three runs, the four runs and the 210 runs in constants at the top of each file. F-001 is
  `featureFiles({ id: "F-001", status: "in-progress", tasks: [{ id: "T-001.1" }, { id: "T-001.2" }] })`
  and F-002 `featureFiles({ id: "F-002", status: "idea", ideaOnly: true })`.
- T-025.1: `runs.ts` imports only types, `idKind`, `featureOf`, `compareIds` and `AzimuthError`.
  `newestFirst` is `Date.parse(b.at) - Date.parse(a.at) || compareIds(b.id, a.id)` (the comparator
  of `indexRuns` in `build-index.ts`, which stays as it is). Tests use `loadTree` from
  `test/helpers/project.ts` and assert error codes and messages with a local `errorOf`.
- T-025.2: in `verify-report.ts`, export `seconds`, `outcome` and `tailLines`, and move the
  `run` case's line into `runResultLine(run)`; `reportLines` calls it, so
  `test/cli/verify-report.test.ts` passes unchanged (the verify command runs it too). `runs.ts`
  holds the command, `parseLimit` and `runLine`; the command loads `loadProject(rt.root)`, never
  `buildIndex`. Register `runs` in `main.ts` after `trace`. Tests use `writeTree`,
  `MINIMAL_CONFIG` and `runCli`, without git; S-025.2.7 creates Q-0001 with
  `runCli(root, ["new", "question", "Which one?"])`.
- T-025.3: add `runPage` and `showRun` to `runs.ts`. In `read.ts`, the `show` command imports
  `idKind` and `showRun`, and right after `const rt = runtime(values);` returns
  `showRun(rt.root, id, { brief: Boolean(values.brief), json: rt.json })` for a run ID; remove
  `index.runs` from `findEntity`'s pools. Change nothing else in `show` (F-026 changes the
  milestone path). S-025.3.6 imports `buildIndex` to check that R-0001 is outside `index.runs`.
- T-025.4: `docs/cli.md`: a Read table row
  `azimuth runs <T-ID|F-ID> [--limit N] [--json]`, a paragraph after the table with the line
  format, the default limit, the older line, the refusals and the JSON form, and a sentence in
  the `show` row for `show R-NNNN` (page, `--brief`, `--json`). `docs/file-format.md`: one
  sentence after the verify run example naming `azimuth runs` and `azimuth show R-NNNN`. The
  azimuth skill gains a `runs` row in its CLI reference; the bug skill one sentence: for a
  flaky or newly failing test, `azimuth runs <T-ID>` shows when it last passed and
  `azimuth show R-NNNN` the output of a run.
