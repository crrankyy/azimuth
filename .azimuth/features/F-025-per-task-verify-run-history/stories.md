# F-025: Stories

Unless a scenario says otherwise, a project is `MINIMAL_CONFIG` (`test/helpers/tree.ts`) with
F-001 in progress, whose plan lists T-001.1 and T-001.2, and F-002 an idea without spec files
(`featureFiles` from `test/helpers/project.ts`, `ideaOnly: true`). Run files are written to
`.azimuth/cache/runs/<id>.json`, each with command `pnpm test`, `scenarios: []`, `junit: null`
and `output_tail: ""` unless a scenario says otherwise. "The three runs" are:

- R-0001: target T-001.1, ok, exit 0, 12400 ms, at `2026-10-19T09:00:00Z`, commit `9f3c2e1`,
  `waited_ms: 0`, `prebuild: { ok: true, duration_ms: 41200 }`;
- R-0002: target T-001.1, ok, exit 0, 11800 ms, at `2026-10-19T15:00:00Z`, commit `a1b2c3d`,
  `waited_ms: 40500`, `prebuild: null`;
- R-0003: target T-001.1, not ok, exit 1, 2100 ms, at `2026-10-24T08:00:00Z`, commit `0c4d5e6`,
  no `waited_ms` and no `prebuild` key, `output_tail` `FAIL test/a.test.ts > S-001.1.1 opens\nTimed out in 5000ms`.

"The four runs" are the three runs plus R-0004: target T-001.2, ok, exit 0, 900 ms, at
`2026-10-20T10:00:00Z`, commit `a1b2c3d`, `waited_ms: 0`, `prebuild: null`. "The 210 runs" are
R-0001 to R-0210, each with target T-001.1, ok, exit 0, 1000 ms, commit `9f3c2e1`,
`waited_ms: 0` and `prebuild: null`, R-n at n minutes after `2026-10-19T00:00:00Z`.
Core scenarios call `runHistory` on `loadTree(…).model`; CLI scenarios use `runCli`
(`test/helpers/cli.ts`, which sets `NO_COLOR=1`).

## ST-025.1 · Pick a task's or feature's runs, newest first
**Intent:** As the CLI, I want one function that selects, orders and caps the runs of a task or feature from the model, so that every run is found however old it is and wrong IDs are refused the same way each time.

### S-025.1.1 · A task's runs, newest first {happy}
- **GIVEN** the four runs
- **WHEN** `runHistory(model, "T-001.1", 20)` runs
- **THEN** it returns `ref: "T-001.1"`, `kind: "task"`, `total: 3`, and `runs` whose IDs are `["R-0003", "R-0002", "R-0001"]`

### S-025.1.2 · A feature's runs include removed tasks and the feature itself {happy}
- **GIVEN** the four runs, R-0005 (target T-002.1, at `2026-10-26T08:00:00Z`), R-0006 (target T-001.9, which no plan lists, at `2026-10-25T08:00:00Z`) and R-0007 (target F-001, at `2026-10-18T08:00:00Z`)
- **WHEN** `runHistory(model, "F-001", 3)` runs
- **THEN** it returns `ref: "F-001"`, `kind: "feature"`, `total: 6`, and `runs` whose IDs are `["R-0006", "R-0003", "R-0004"]`

### S-025.1.3 · Runs at the same second list the higher ID first {edge}
- **GIVEN** the three runs, R-0008 and R-0009, both with target T-001.1 and at `2026-10-26T08:00:00Z`
- **WHEN** `runHistory(model, "T-001.1", 20)` runs
- **THEN** the IDs of `runs` are `["R-0009", "R-0008", "R-0003", "R-0002", "R-0001"]`

### S-025.1.4 · A removed task's runs stay readable {edge}
- **GIVEN** the three runs and R-0006 (target T-001.9, which no plan lists, at `2026-10-25T08:00:00Z`)
- **WHEN** `runHistory(model, "T-001.9", 20)` runs
- **THEN** it returns `ref: "T-001.9"`, `kind: "task"`, `total: 1`, and `runs` whose IDs are `["R-0006"]`

### S-025.1.5 · A planned task without runs gives an empty list {edge}
- **GIVEN** the three runs
- **WHEN** `runHistory(model, "T-001.2", 20)` runs
- **THEN** it returns `{ ref: "T-001.2", kind: "task", runs: [], total: 0 }`

### S-025.1.6 · An unknown task or feature is refused {negative}
- **GIVEN** the three runs
- **WHEN** `runHistory(model, "T-001.9", 20)` runs
- **THEN** it throws an AzimuthError with code `not-found` and the message `T-001.9 does not exist.`
- **AND** `runHistory(model, "F-009", 20)` throws an AzimuthError with code `not-found` and the message `F-009 does not exist.`

### S-025.1.7 · An ID of another kind is refused {negative}
- **GIVEN** the three runs
- **WHEN** `runHistory(model, "S-001.1.1", 20)` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `S-001.1.1 is not a task or feature ID.`
- **AND** `runHistory(model, "R-0001", 20)` throws an AzimuthError with code `invalid` and the message `R-0001 is not a task or feature ID.`

### S-025.1.8 · A feature with no tasks and no runs is refused {edge}
- **GIVEN** the three runs
- **WHEN** `runHistory(model, "F-002", 20)` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `F-002 has no tasks and no verify runs.`

## ST-025.2 · azimuth runs prints one line per run
**Intent:** As an agent investigating a flaky test, I want one command that lists a task's or feature's verify runs with when, at which commit, the outcome and how long they took, so that I can tell when a test last passed without reading JSON files.

### S-025.2.1 · A task's runs, one line each {happy}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.1` runs
- **THEN** it exits 0 and its stdout is exactly `R-0003 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\nR-0002 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\nR-0001 2026-10-19T09:00:00Z 9f3c2e1 passed in 12.4s, prebuild passed in 41.2s\n`
- **AND** its stderr is empty

### S-025.2.2 · A feature's runs name their task {happy}
- **GIVEN** a project with the four runs and R-0005 (target T-002.1, ok, 500 ms, at `2026-10-26T08:00:00Z`, commit `a1b2c3d`)
- **WHEN** `azimuth runs F-001` runs
- **THEN** it exits 0 and its stdout is exactly `R-0003 T-001.1 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\nR-0004 T-001.2 2026-10-20T10:00:00Z a1b2c3d passed in 0.9s\nR-0002 T-001.1 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\nR-0001 T-001.1 2026-10-19T09:00:00Z 9f3c2e1 passed in 12.4s, prebuild passed in 41.2s\n`

### S-025.2.3 · --limit caps the lines and counts the older runs {edge}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.1 --limit 2` runs
- **THEN** it exits 0 and its stdout is exactly `R-0003 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\nR-0002 2026-10-19T15:00:00Z a1b2c3d passed in 11.8s, waited 41s\n… and 1 older\n`

### S-025.2.4 · Twenty lines by default {edge}
- **GIVEN** a project with R-0001 to R-0022, each with target T-001.1, ok, exit 0, 1000 ms, commit `9f3c2e1`, `waited_ms: 0` and `prebuild: null`, R-n at `2026-10-19T09:<n>:00Z` (n with two digits)
- **WHEN** `azimuth runs T-001.1` runs
- **THEN** it exits 0 and its stdout has 21 lines: the first is `R-0022 2026-10-19T09:22:00Z 9f3c2e1 passed in 1.0s`, the 20th starts with `R-0003 ` and the last is `… and 2 older`

### S-025.2.5 · Every run is listed, not only the index's {edge}
- **GIVEN** a project with the 210 runs
- **WHEN** `azimuth runs T-001.1 --limit 250` runs
- **THEN** it exits 0 and its stdout has 210 lines: the first starts with `R-0210 ` and the last is `R-0001 2026-10-19T00:01:00Z 9f3c2e1 passed in 1.0s`

### S-025.2.6 · A task without runs says so {edge}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.2` runs
- **THEN** it exits 0 and its stdout is exactly `No verify runs for T-001.2 yet.\n`
- **AND** `azimuth runs T-001.2 --json` exits 0 with stdout `[]\n`

### S-025.2.7 · An ID of another kind is refused {negative}
- **GIVEN** a project with the three runs and an open question Q-0001
- **WHEN** `azimuth runs Q-0001` runs
- **THEN** it exits 1, its stderr is `✗ Q-0001 is not a task or feature ID.\n` and its stdout is empty

### S-025.2.8 · An unknown task is refused {negative}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.9` runs
- **THEN** it exits 1, its stderr is `✗ T-001.9 does not exist.\n` and its stdout is empty

### S-025.2.9 · A limit below 1 is a usage error {negative}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.1 --limit 0` runs
- **THEN** it exits 2, its stderr is `--limit takes a whole number of at least 1, not "0".\nUsage: azimuth runs <T-ID|F-ID> [--limit N] [--json]\n` and its stdout is empty
- **AND** `azimuth runs T-001.1 --limit 2.5` exits 2 with stderr `--limit takes a whole number of at least 1, not "2.5".\nUsage: azimuth runs <T-ID|F-ID> [--limit N] [--json]\n`

### S-025.2.10 · --json prints the records without their output tails {happy}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth runs T-001.1 --json` runs
- **THEN** it exits 0 and its stdout parses to an array whose IDs are `["R-0003", "R-0002", "R-0001"]`, no element of which has an `output_tail` key
- **AND** its element 1 equals `{ id: "R-0002", target: "T-001.1", command: "pnpm test", ok: true, exit_code: 0, duration_ms: 11800, at: "2026-10-19T15:00:00Z", commit: "a1b2c3d", scenarios: [], junit: null, waited_ms: 40500, prebuild: null }`

## ST-025.3 · azimuth show R-NNNN prints the whole run
**Intent:** As an agent who picked a run from the list, I want `show` to print every field of it and its output tail, so that I can see why it failed without opening the run file.

### S-025.3.1 · A run's page lists every field, then the output {happy}
- **GIVEN** a project with the three runs, R-0003 written with, besides its fields, command `pnpm exec vitest run test/a.test.ts`, `waited_ms: 400`, `ses: "SES-20261024-0750"`, `prebuild: { ok: true, duration_ms: 41200 }`, `junit: { tests: 2, failures: 1, errors: 0, skipped: 0 }` and `scenarios: [{ id: "S-001.1.1", status: "failing" }, { id: "S-001.1.2", status: "passing" }]`
- **WHEN** `azimuth show R-0003` runs
- **THEN** it exits 0 and its stdout is exactly `R-0003 T-001.1 failed (exit 1) in 2.1s\nAt: 2026-10-24T08:00:00Z\nCommit: 0c4d5e6\nCommand: pnpm exec vitest run test/a.test.ts\nWaited: 1s\nSession: SES-20261024-0750\nPrebuild: passed in 41.2s\nJUnit: tests 2, failures 1, errors 0, skipped 0\nScenarios: S-001.1.1 failing, S-001.1.2 passing\nOutput:\n    FAIL test/a.test.ts > S-001.1.1 opens\n    Timed out in 5000ms\n`

### S-025.3.2 · A run file from before the newer keys {edge}
- **GIVEN** a project whose only run file is R-0020: `{"id":"R-0020","target":"T-001.1","command":"pnpm test","ok":true,"exit_code":0,"duration_ms":1000,"at":"2026-10-01T10:00:00Z","commit":null,"output_tail":"","scenarios":[],"junit":null}`
- **WHEN** `azimuth show R-0020` runs
- **THEN** it exits 0 and its stdout is exactly `R-0020 T-001.1 passed in 1.0s\nAt: 2026-10-01T10:00:00Z\nCommit: none\nCommand: pnpm test\nPrebuild: none\nOutput: (none)\n`

### S-025.3.3 · A run after a failed prebuild says so twice {edge}
- **GIVEN** a project with R-0021: target T-001.1, ok, exit 0, 1000 ms, at `2026-10-25T08:00:00Z`, commit `0c4d5e6`, `waited_ms: 0`, `ses: null`, `prebuild: { ok: false, duration_ms: 3100 }`
- **WHEN** `azimuth show R-0021` runs
- **THEN** it exits 0 and its stdout is exactly `R-0021 T-001.1 passed in 1.0s after a failed prebuild\nAt: 2026-10-25T08:00:00Z\nCommit: 0c4d5e6\nCommand: pnpm test\nWaited: 0s\nSession: none\nPrebuild: failed in 3.1s\nOutput: (none)\n`

### S-025.3.4 · --brief prints the run's line {happy}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth show R-0003 --brief` runs
- **THEN** it exits 0 and its stdout is exactly `R-0003 T-001.1 2026-10-24T08:00:00Z 0c4d5e6 failed (exit 1) in 2.1s\n`

### S-025.3.5 · --json prints the whole record {happy}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth show R-0003 --json` runs
- **THEN** it exits 0 and its stdout parses to `{ id: "R-0003", target: "T-001.1", command: "pnpm test", ok: false, exit_code: 1, duration_ms: 2100, at: "2026-10-24T08:00:00Z", commit: "0c4d5e6", output_tail: "FAIL test/a.test.ts > S-001.1.1 opens\nTimed out in 5000ms", scenarios: [], junit: null, prebuild: null }`

### S-025.3.6 · A run older than the index's window is found {edge}
- **GIVEN** a project with the 210 runs
- **WHEN** `azimuth show R-0001 --json` runs
- **THEN** it exits 0 and its stdout parses to an object with `id: "R-0001"` and `at: "2026-10-19T00:01:00Z"`
- **AND** `buildIndex(root).index.runs` holds no run with ID `R-0001`

### S-025.3.7 · An unknown run is refused as today {negative}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth show R-0999` runs
- **THEN** it exits 2, its stderr is `R-0999 not found.\nUsage: azimuth show <ID> [--brief | --json]\n` and its stdout is empty

### S-025.3.8 · Other IDs still print their brief {edge}
- **GIVEN** a project with the three runs
- **WHEN** `azimuth show T-001.1` runs
- **THEN** it exits 0 and the first line of its stdout is `T-001.1 todo Task T-001.1 (in F-001 in-progress)`
