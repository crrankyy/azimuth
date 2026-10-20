# F-018: Stories

The defaults below hold unless a scenario says otherwise.

- **The project:** as in `test/core/verify-batch.test.ts`, F-001 in progress with T-001.1
  (`covers: [S-001.1.1]`, verify `echo S-001.1.1 ok`) and T-001.2 (`covers: [S-001.1.2]`,
  verify `echo S-001.1.2 ok`), and no runs. config.yaml is `MINIMAL_CONFIG` plus the `verify:`
  keys the scenario names.
- **"The batch"** is `verifyBatch(root, verifyTargets(root, ids), options)`.
- **In a THEN:**
  - `<n>` stands for a duration with one decimal.
  - `<sha>` stands for HEAD's 7-character SHA after the call.
  - "D" is the batch result's `prebuild.duration_ms`.
- **"The free-space source"** is the `FreeBytes` function given to `diskSpace`. The command
  scenarios swap it in with `vi.mock`.

## ST-018.1 · Two verify keys with today's behaviour as the default
**Intent:** As a project owner, I want to opt in to continuing past a failed prebuild and to set the free-disk threshold in config.yaml, so that projects that set neither behave as today and `azimuth init` shows both keys.

### S-018.1.1 · Reads both keys {happy}
- **GIVEN** a verify section with `prebuild_failure: continue` and `min_free_gb: 4`
- **WHEN** `parseConfig` reads config.yaml
- **THEN** `verify.prebuild_failure` is `"continue"`, `verify.min_free_gb` is `4` and the problems are `[]`

### S-018.1.2 · Defaults when the keys are absent {edge}
- **GIVEN** a verify section with only `timeout_seconds: 600`
- **WHEN** `parseConfig` reads config.yaml
- **THEN** `verify.prebuild_failure` is `"stop"`, `verify.min_free_gb` is `10` and the problems are `[]`

### S-018.1.3 · Rejects an unknown policy and a negative threshold {negative}
- **GIVEN** a verify section with `prebuild_failure: skip` and `min_free_gb: -1`
- **WHEN** `parseConfig` reads config.yaml
- **THEN** the problems are, in this order, `E-SCHEMA` `verify.prebuild_failure must be stop or continue.` and `E-SCHEMA` `verify.min_free_gb must be a whole number ≥ 0.`
- **AND** `verify.prebuild_failure` stays `"stop"` and `verify.min_free_gb` stays `10`

### S-018.1.4 · init writes both keys with their defaults {happy}
- **GIVEN** the detected stack `{ name: "shop", mode: "brownfield", languages: ["typescript"], packageManager: "pnpm", testRunner: "vitest", commands: { test: "pnpm test" }, testGlobs: ["**/*.test.*"], usesPrettier: false }`
- **WHEN** `configYaml(detected)` runs
- **THEN** the two lines after `  output_tail_lines: 40` are `  prebuild_failure: stop # stop: a failed prebuild records no runs | continue: each task's own command still runs, and the done gate asks for a rerun with a working build` and `  min_free_gb: 10 # verify and task finish warn below this much free disk space (GB); 0 turns it off`
- **AND** `parseConfig` of the text reports no problems

## ST-018.2 · Run files carry the prebuild that served them
**Intent:** As an orchestrator reading runs, I want each run file to say whether a prebuild ran before it, whether it passed and how long it took, so that the summaries and the done gate can use it and run files written before 0.3 still read.

### S-018.2.1 · Reads a run's prebuild {happy}
- **GIVEN** a run file R-0007 with `"prebuild": { "ok": false, "duration_ms": 3100 }`
- **WHEN** `parseRun` reads it
- **THEN** the run's `prebuild` is `{ ok: false, duration_ms: 3100 }` and the problems are `[]`

### S-018.2.2 · A run file without the key reads as no prebuild {edge}
- **GIVEN** the Hookline fixture's `R-0101.json`, which has no `prebuild` key
- **WHEN** `parseRun` reads it
- **THEN** the run's `prebuild` is `null` and the problems are `[]`

### S-018.2.3 · A malformed prebuild reads as no prebuild {negative}
- **GIVEN** a run file R-0007 with `"prebuild": "fast"` and another with `"prebuild": { "ok": "yes", "duration_ms": 12 }`
- **WHEN** `parseRun` reads each
- **THEN** each run's `prebuild` is `null` and the problems are `[]`

## ST-018.3 · A failed prebuild stops the batch, or under continue lets each command build for itself
**Intent:** As an orchestrator finishing a lane while another lane's code doesn't build, I want to opt in to running each task's own command after a failed prebuild, with the time a build needs, so that a lane whose code builds isn't held up. A timed-out or interrupted prebuild should still record nothing.

### S-018.3.1 · Each run records a passing prebuild {happy}
- **GIVEN** `prebuild: "echo built"`
- **WHEN** the batch runs T-001.1 and T-001.2
- **THEN** `R-0001.json` and `R-0002.json` each hold `"prebuild": { "ok": true, "duration_ms": D }`

### S-018.3.2 · A skipped prebuild records null {edge}
- **GIVEN** `prebuild: "touch prebuilt"`
- **WHEN** the batch runs T-001.1 with `{ prebuild: false }`, as `--no-prebuild` passes it
- **THEN** `R-0001.json` holds `"prebuild": null` and the file `prebuilt` doesn't exist

### S-018.3.3 · Under stop, the default, a failed prebuild records nothing {negative}
- **GIVEN** `prebuild: "echo no compiler; exit 2"`, no `prebuild_failure` key, and T-001.1's verify `touch ran`
- **WHEN** the batch runs T-001.1
- **THEN** the result's `prebuild` has `ok` false, `exit_code` 2 and `timed_out` false, `runs` is `[]`, `.azimuth/cache/runs/` holds no file and the file `ran` doesn't exist

### S-018.3.4 · Under continue each target runs after a failed prebuild {happy}
- **GIVEN** `prebuild: "echo no compiler; exit 2"` and `prebuild_failure: continue`
- **WHEN** the batch runs T-001.1
- **THEN** the result's `prebuild` has `ok` false, `exit_code` 2 and `timed_out` false, `interrupted` is false, and `runs` holds one run, R-0001 for T-001.1, with `ok` true and `exit_code` 0
- **AND** `R-0001.json` holds `"prebuild": { "ok": false, "duration_ms": D }`

### S-018.3.5 · Under continue a timed-out prebuild still records nothing {negative}
- **GIVEN** `prebuild: "sleep 30"`, `build_timeout_seconds: 1`, `prebuild_failure: continue`, and T-001.1's verify `touch ran`
- **WHEN** the batch runs T-001.1
- **THEN** the result's `prebuild` has `ok` false, `exit_code` 124 and `timed_out` true, `runs` is `[]`, `.azimuth/cache/runs/` holds no file and the file `ran` doesn't exist

### S-018.3.6 · Under continue an interrupted prebuild still records nothing {edge}
- **GIVEN** `prebuild_failure: continue` and a prebuild that starts a long sleep in the background, writes its pid to `child.pid` and waits for it
- **WHEN** the batch's signal is aborted once `child.pid` exists
- **THEN** `interrupted` is true, `prebuild` is `null`, `runs` is `[]`, `.azimuth/cache/runs/` holds no file and `process.kill(pid, 0)` fails with `ESRCH`

### S-018.3.7 · After a failed prebuild each command also gets the build's time {edge}
- **GIVEN** `prebuild: "exit 2"`, `prebuild_failure: continue`, `timeout_seconds: 1`, `build_timeout_seconds: 2`, T-001.1's verify `sleep 2 && echo S-001.1.1 ok` and T-001.2's verify `sleep 30`
- **WHEN** the batch runs T-001.1 and T-001.2
- **THEN** R-0001 has `ok` true and `exit_code` 0
- **AND** R-0002 has `ok` false and `exit_code` 124, and its `output_tail` ends with `[azimuth] timed out after 3s`

### S-018.3.8 · After a passing prebuild each command keeps its own timeout {edge}
- **GIVEN** `prebuild: "echo built"`, `prebuild_failure: continue`, `timeout_seconds: 1`, `build_timeout_seconds: 2`, and T-001.1's verify `sleep 30`
- **WHEN** the batch runs T-001.1
- **THEN** R-0001 has `ok` false and `exit_code` 124, and its `output_tail` ends with `[azimuth] timed out after 1s`

## ST-018.4 · verify shows the prebuild's time and marks runs made after a failed one
**Intent:** As an orchestrator, I want verify's summary and full report to show the prebuild's time and to mark runs made after a failed prebuild, so that I see where a batch's time went and which passes need a rerun.

### S-018.4.1 · The summary shows a passing prebuild's time {happy}
- **GIVEN** the events `prebuilt` (`{ command: "cargo build", ok: true, exit_code: 0, timed_out: false, duration_ms: 41200, output_tail: "Finished" }`), `target` T-001.1 and `run` R-0001 for T-001.1 (`ok` true, `duration_ms` 1200, `prebuild` `{ ok: true, duration_ms: 41200 }`)
- **WHEN** `reportLines(event, "summary")` prints each event
- **THEN** the lines are `prebuild passed in 41.2s` and `R-0001 T-001.1 passed in 1.2s`

### S-018.4.2 · Runs after a failed prebuild say so {edge}
- **GIVEN** the `run` events R-0001 for T-001.1 (`ok` true, `duration_ms` 1200) and R-0002 for T-001.2 (`ok` false, `exit_code` 3, `duration_ms` 500, `output_tail` `boom`), both with `prebuild` `{ ok: false, duration_ms: 3100 }`
- **WHEN** `reportLines` prints both events in full mode and in summary mode
- **THEN** each mode prints `R-0001 T-001.1 passed in 1.2s after a failed prebuild`, `R-0002 T-001.2 failed (exit 3) in 0.5s after a failed prebuild` and `    boom`

### S-018.4.3 · verify exits 1 after a failed prebuild even when its runs pass {negative}
- **GIVEN** `prebuild: "echo no compiler; exit 2"` and `prebuild_failure: continue`
- **WHEN** `azimuth verify T-001.1` runs in process (`runCli`)
- **THEN** it exits 1 and its stdout lines are `prebuild: echo no compiler; exit 2`, `prebuild failed (exit 2) in <n>s`, `    no compiler`, `T-001.1: echo S-001.1.1 ok` and `R-0001 T-001.1 passed in <n>s after a failed prebuild`
- **AND** `R-0001.json` has `ok` true and `prebuild.ok` false

## ST-018.5 · The done gate asks for a rerun with a working build
**Intent:** As the project owner, I want a feature to reach done only with runs made after a working prebuild, so that a pass made while the workspace didn't build can't close a feature.

In this story F-001 is verifying with T-001.1 and T-001.2 done, HEAD is `aaaaaaa`, and every run
has `commit: aaaaaaa`.

### S-018.5.1 · A pass after a failed prebuild needs a rerun {negative}
- **GIVEN** T-001.1's latest run R-0001 with `ok` true and `prebuild` `{ ok: false, duration_ms: 3100 }`, and T-001.2's latest run R-0002 with `ok` true and `prebuild` `{ ok: true, duration_ms: 41200 }`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok` false and the detail `T-001.1 passed after a failed prebuild`

### S-018.5.2 · A rerun with a working build passes {happy}
- **GIVEN** R-0001 and R-0002 as in S-018.5.1, R-0001 at `2026-10-17T10:00:00Z`, and a later run R-0003 for T-001.1 at `2026-10-17T11:00:00Z` with `ok` true and `prebuild` `{ ok: true, duration_ms: 41200 }`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok` true

### S-018.5.3 · Runs without a prebuild count as before {edge}
- **GIVEN** T-001.1's latest run with `ok` true and no `prebuild` key, and T-001.2's latest run with `ok` true and `"prebuild": null`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok` true

### S-018.5.4 · A failed run is still named first {edge}
- **GIVEN** T-001.1's latest run R-0001 with `ok` true and `prebuild` `{ ok: false, duration_ms: 3100 }`, and T-001.2's latest run R-0002 with `ok` false
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok` false and the detail `T-001.2 failed at aaaaaaa`

## ST-018.6 · task finish shows the prebuild in its verify step
**Intent:** As an orchestrator finishing lanes early, I want task finish to pass a task whose own command passes after a failed prebuild under continue, and to say so in its verify line and log, so that the lane is done now and the close-out knows to rerun it.

In this story the repository is `test/core/finish.test.ts`'s:

- HEAD holds F-001 in progress, with T-001.1 in progress (`files: [src/a.ts, test/a.test.ts]`,
  verify `echo S-001.1.1 ok`).
- `src/a.ts` and `test/a.test.ts` differ from HEAD.
- `finishTask` runs with the message `feat(F-001): add a` and `actor: "agent"`.

### S-018.6.1 · The verify line shows a passing prebuild's time {happy}
- **GIVEN** `prebuild: "echo built"`
- **WHEN** `finishTask(root, "T-001.1", …)` runs
- **THEN** `ok` is true and the verify step's detail is `R-0001 passed in <n>s (prebuild <n>s)`
- **AND** the last log.md entry's body is `T-001.1: in-progress → done. Committed <sha>; R-0001 passed.`

### S-018.6.2 · Under continue a task whose command passes after a failed prebuild is done {happy}
- **GIVEN** `prebuild: "echo no compiler; exit 2"` and `prebuild_failure: continue`
- **WHEN** `finishTask(root, "T-001.1", …)` runs
- **THEN** `ok` is true, the steps are `check done, stage done, commit done, verify done, done done, log done`, and the verify step's detail is `R-0001 passed in <n>s after a failed prebuild (exit 2, <n>s)` with output `""`
- **AND** T-001.1 is `done` in plan.md and the last log.md entry's body is `T-001.1: in-progress → done. Committed <sha>; R-0001 passed after a failed prebuild.`

### S-018.6.3 · A failing command after a failed prebuild keeps the task in progress {negative}
- **GIVEN** `prebuild: "echo no compiler; exit 2"`, `prebuild_failure: continue` and T-001.1's verify `echo S-001.1.1 boom; exit 1`
- **WHEN** `finishTask(root, "T-001.1", …)` runs
- **THEN** `ok` is false, the steps are `check done, stage done, commit done, verify failed, done not-run, log done`, and the verify step's detail is `R-0001 failed (exit 1) in <n>s after a failed prebuild (exit 2, <n>s)` with output `S-001.1.1 boom`
- **AND** T-001.1 is `in-progress` in plan.md and the last log.md entry's body is `T-001.1: Committed <sha>; R-0001 failed (exit 1) after a failed prebuild.`

### S-018.6.4 · Without a prebuild the verify line is unchanged {edge}
- **GIVEN** no `verify.prebuild`
- **WHEN** `finishTask(root, "T-001.1", …)` runs
- **THEN** the verify step's detail is `R-0001 passed in <n>s`, with nothing after the duration

## ST-018.7 · Warn before building on a nearly full disk
**Intent:** As an orchestrator whose build output fills the disk, I want verify, task finish and doctor to warn when the project's disk has less free space than a threshold, without ever blocking, so that I free space before a build fails halfway.

### S-018.7.1 · Below the threshold there is a warning {happy}
- **GIVEN** no `min_free_gb` key (10) and a free-space source returning 4200000000
- **WHEN** `diskSpace(root, source)` runs and `diskWarning` reads its result
- **THEN** `diskSpace` returns `{ state: "low", free_bytes: 4200000000, min_free_gb: 10 }`
- **AND** `diskWarning` returns `Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.`

### S-018.7.2 · Free space is rounded down, and the threshold itself is enough {edge}
- **GIVEN** no `min_free_gb` key (10) and free-space sources returning 9999999999 and 10000000000
- **WHEN** `diskWarning(diskSpace(root, source))` runs with each
- **THEN** the first returns `Low disk space: 9.9 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.` and the second returns `null`, with `diskSpace` `{ state: "ok", free_bytes: 10000000000, min_free_gb: 10 }`

### S-018.7.3 · 0 turns the guard off {edge}
- **GIVEN** `min_free_gb: 0` and a free-space source returning 1
- **WHEN** `diskSpace(root, source)` runs and `diskWarning` reads its result
- **THEN** `diskSpace` returns `{ state: "off" }` without calling the source, and `diskWarning` returns `null`

### S-018.7.4 · Unreadable free space never warns {negative}
- **GIVEN** a free-space source that throws `new Error("ENOSYS: function not implemented, statfs")`
- **WHEN** `diskSpace(root, source)` runs and `diskWarning` reads its result
- **THEN** `diskSpace` returns `{ state: "unknown", error: "ENOSYS: function not implemented, statfs" }` and `diskWarning` returns `null`

### S-018.7.5 · verify warns on stderr and runs anyway {happy}
- **GIVEN** no `min_free_gb` key and the free-space source returning 4200000000
- **WHEN** `azimuth verify T-001.1` runs in process (`runCli`)
- **THEN** it exits 0, its stderr is exactly `Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.\n`, and its stdout's last line is `R-0001 T-001.1 passed in <n>s`

### S-018.7.6 · task finish warns on stderr and finishes anyway {happy}
- **GIVEN** a git repository whose HEAD holds F-001 in progress with T-001.1 in progress (`files: [src/a.ts]`), `src/a.ts` changed, and the free-space source returning 4200000000
- **WHEN** `azimuth task finish T-001.1 --commit "feat(F-001): add a"` runs in process (`runCli`)
- **THEN** it exits 0, its stderr is exactly `Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.\n`, and T-001.1 is `done` in plan.md

### S-018.7.7 · With min_free_gb 0 verify prints no warning {edge}
- **GIVEN** `min_free_gb: 0` and the free-space source returning 1
- **WHEN** `azimuth verify T-001.1` runs in process (`runCli`)
- **THEN** it exits 0 and its stderr is `""`

### S-018.7.8 · doctor shows the free space {happy}
- **GIVEN** the disk space `{ state: "ok", free_bytes: 120500000000, min_free_gb: 10 }`
- **WHEN** `diskCheck(space)` runs
- **THEN** it returns `{ ok: true, text: "120.5 GB free on the project's disk (verify.min_free_gb: 10)" }`

### S-018.7.9 · doctor flags a low disk without failing {negative}
- **GIVEN** the disk space `{ state: "low", free_bytes: 4200000000, min_free_gb: 10 }`
- **WHEN** `diskCheck(space)` runs
- **THEN** it returns `{ ok: null, text: "Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10)" }`

### S-018.7.10 · doctor with the guard off or the space unreadable {edge}
- **GIVEN** the disk spaces `{ state: "off" }` and `{ state: "unknown", error: "ENOSYS: function not implemented, statfs" }`
- **WHEN** `diskCheck(space)` runs with each
- **THEN** it returns `null` for the first and `{ ok: null, text: "Could not read the free space on the project's disk: ENOSYS: function not implemented, statfs" }` for the second
