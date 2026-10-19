# F-007: Stories

## ST-007.1 · Verify settings and run fields
**Intent:** As a project owner, I want to configure a prebuild with its own timeout, and runs to carry their wait and session, so that verify can build once and each run says how long it waited and who ran it.

### S-007.1.1 · Reads the prebuild and its timeout {happy}
- **GIVEN** a config.yaml whose `verify` section is `prebuild: cargo test --workspace --no-run` and `build_timeout_seconds: 900`
- **WHEN** `parseConfig` reads it
- **THEN** `config.verify.prebuild` is "cargo test --workspace --no-run", `config.verify.build_timeout_seconds` is 900, `config.verify.timeout_seconds` is 600 and `problems` is `[]`

### S-007.1.2 · Defaults when the keys are absent {edge}
- **GIVEN** a config.yaml whose `verify` section is only `timeout_seconds: 600`
- **WHEN** `parseConfig` reads it
- **THEN** `config.verify.prebuild` is `null`, `config.verify.build_timeout_seconds` is 1800 and `problems` is `[]`

### S-007.1.3 · Rejects a zero build timeout {negative}
- **GIVEN** a config.yaml whose `verify` section is `build_timeout_seconds: 0`
- **WHEN** `parseConfig` reads it
- **THEN** `problems` is one `E-SCHEMA` error "verify.build_timeout_seconds must be a whole number ≥ 1." and `config.verify.build_timeout_seconds` stays 1800

### S-007.1.4 · A run with its wait and session {happy}
- **GIVEN** a run file `R-0007.json` with target `T-001.1`, `"waited_ms": 40000` and `"ses": "SES-20261020-0900"`
- **WHEN** `parseRun` reads it
- **THEN** the run's `waited_ms` is 40000, its `ses` is "SES-20261020-0900" and `problems` is `[]`

### S-007.1.5 · A run outside a session that didn't wait {edge}
- **GIVEN** a run file with `"waited_ms": 0` and `"ses": null`
- **WHEN** `parseRun` reads it
- **THEN** the run's `waited_ms` is 0 and its `ses` is `null`

### S-007.1.6 · A run written before this feature parses as before {edge}
- **GIVEN** the Hookline fixture's `R-0101.json`, which has neither `waited_ms` nor `ses`
- **WHEN** `parseRun` reads it
- **THEN** the run has no `waited_ms` key and no `ses` key, and `problems` is `[]`

### S-007.1.7 · Invalid values are left out {negative}
- **GIVEN** a run file with `"waited_ms": "40s"` and `"ses": 42`
- **WHEN** `parseRun` reads it
- **THEN** the run has no `waited_ms` key and no `ses` key, and `problems` is `[]`

## ST-007.2 · Several targets in one call
**Intent:** As an orchestrator, I want to name several tasks and features in one verify call, so that a finished batch of tasks is verified with one command.

### S-007.2.1 · Tasks in the order named, without repeats {happy}
- **GIVEN** F-001 in progress with tasks T-001.1, T-001.2 and T-001.3, each with a verify command
- **WHEN** `verifyTargets(root, ["T-001.3", "F-001", "T-001.1"])` runs
- **THEN** it returns the targets for T-001.3, T-001.1 and T-001.2, in that order

### S-007.2.2 · No IDs means every in-flight feature {edge}
- **GIVEN** that F-001, and F-002 approved with task T-002.1
- **WHEN** `verifyTargets(root, [])` runs
- **THEN** it returns the targets for T-001.1, T-001.2 and T-001.3

### S-007.2.3 · An unknown ID fails the whole call {negative}
- **GIVEN** that F-001
- **WHEN** `verifyTargets(root, ["T-001.1", "F-099"])` runs
- **THEN** it throws an `AzimuthError` with code "not-found" and message "F-099 is not a feature or task in this project."

## ST-007.3 · A command that times out leaves nothing running
**Intent:** As a developer, I want a timed-out verify command killed together with every process it started, so that orphaned compilers and test runners don't keep running and slow down the next verify.

### S-007.3.1 · A command that finishes in time {happy}
- **GIVEN** the command `printf out; printf err >&2; exit 3` with a 5000 ms timeout
- **WHEN** `runShell` runs it
- **THEN** the result has `exit_code` 3, `output` "outerr", `timed_out` false and `aborted` false

### S-007.3.2 · A timeout kills the command's children {negative}
- **GIVEN** the command `sleep 60 & echo $! > child.pid; wait` with `timeoutMs` 300
- **WHEN** `runShell` runs it
- **THEN** the result has `exit_code` 124 and `timed_out` true, and `process.kill(<pid in child.pid>, 0)` throws `ESRCH`

### S-007.3.3 · A child that ignores SIGTERM is killed after the grace period {edge}
- **GIVEN** the command `trap '' TERM; sleep 60 & echo $! > child.pid; wait` with `timeoutMs` 300 and `graceMs` 200
- **WHEN** `runShell` runs it
- **THEN** the result has `exit_code` 124, `timed_out` true and `duration_ms` ≥ 500, and `process.kill(<pid in child.pid>, 0)` throws `ESRCH`

### S-007.3.4 · An abort kills the command's children {edge}
- **GIVEN** the command `sleep 60 & echo $! > child.pid; wait` running under `runShell` with a 60000 ms timeout
- **WHEN** its `AbortSignal` aborts after `child.pid` appears
- **THEN** the result has `aborted` true and `timed_out` false, and `process.kill(<pid in child.pid>, 0)` throws `ESRCH`

## ST-007.4 · Verify processes take turns
**Intent:** As an orchestrator running lanes in parallel, I want a second `azimuth verify` to wait for the first instead of failing or racing its build, so that no verify times out because another one is compiling.

### S-007.4.1 · A free lock is taken at once {happy}
- **GIVEN** no `verify.lock` in the shared cache directory
- **WHEN** `acquireVerifyLock(root)` resolves
- **THEN** its `waited_ms` is 0, `verify.lock` holds the current process's pid, and after `release()` `verify.lock` doesn't exist

### S-007.4.2 · A held lock is waited for, however old {happy}
- **GIVEN** `verify.lock` holding the pid of a running `sleep 60` process and `at` 0, a clock that advances 20000 ms on each sleep, and a sleep that deletes `verify.lock` on its second call
- **WHEN** `acquireVerifyLock(root, { now, sleep })` resolves
- **THEN** its `waited_ms` is 40000 and `verify.lock` holds the current process's pid

### S-007.4.3 · A lock left by a dead process is taken over {edge}
- **GIVEN** `verify.lock` holding the pid of a process that has exited
- **WHEN** `acquireVerifyLock(root, { sleep })` resolves
- **THEN** its `waited_ms` is 0, `sleep` was never called, and `verify.lock` holds the current process's pid

### S-007.4.4 · An abort while waiting gives up {negative}
- **GIVEN** `verify.lock` holding the pid of a running `sleep 60` process, and a sleep that aborts the `AbortController` on its first call
- **WHEN** `acquireVerifyLock(root, { sleep, signal })` resolves
- **THEN** it resolves `null` and `verify.lock` still holds the `sleep 60` process's pid

## ST-007.5 · One prebuild per call, under its own timeout
**Intent:** As an orchestrator, I want the build to run once before a batch of verify commands, under its own timeout, so that compile time no longer counts against each test run.

### S-007.5.1 · The prebuild runs once before the targets {happy}
- **GIVEN** `verify.prebuild` `echo built >> prebuild.log`, and targets T-001.1 and T-001.2 whose commands are `echo S-001.1.1 ok` and `echo S-001.1.2 ok`
- **WHEN** `verifyBatch` runs them
- **THEN** `prebuild.log` is "built\n", `result.prebuild` has `ok` true and `exit_code` 0, and `result.runs` are R-0001 for T-001.1 and R-0002 for T-001.2, both with `ok` true

### S-007.5.2 · A failed prebuild records no runs {negative}
- **GIVEN** `verify.prebuild` `echo no compiler; exit 2`, and target T-001.1 whose command is `touch ran`
- **WHEN** `verifyBatch` runs it
- **THEN** `result.prebuild` has `ok` false, `exit_code` 2 and `output_tail` "no compiler", `result.runs` is `[]`, `.azimuth/cache/runs/` holds no file, and `ran` doesn't exist

### S-007.5.3 · A prebuild that times out {edge}
- **GIVEN** `verify.prebuild` `sleep 30`, `build_timeout_seconds` 1 and `timeout_seconds` 600
- **WHEN** `verifyBatch` runs target T-001.1
- **THEN** `result.prebuild` has `ok` false, `exit_code` 124 and an `output_tail` ending with "[azimuth] prebuild timed out after 1s", and `result.runs` is `[]`

### S-007.5.4 · The prebuild's time doesn't count against a target's timeout {edge}
- **GIVEN** `timeout_seconds` 1, `build_timeout_seconds` 1800, `verify.prebuild` `sleep 2`, and target T-001.1 whose command is `echo S-001.1.1 ok`
- **WHEN** `verifyBatch` runs it
- **THEN** `result.prebuild` has `ok` true, and run R-0001 has `ok` true, `exit_code` 0 and `duration_ms` < 1000

### S-007.5.5 · Skipping the prebuild {edge}
- **GIVEN** `verify.prebuild` `touch prebuilt`, and target T-001.1 whose command is `echo S-001.1.1 ok`
- **WHEN** `verifyBatch` runs it with `{ prebuild: false }`
- **THEN** `prebuilt` doesn't exist, `result.prebuild` is `null`, and `result.runs` is one run R-0001 with `ok` true

## ST-007.6 · Runs record their wait and session, and an interruption records nothing half-done
**Intent:** As the developer reading runs, I want each run to say how long it waited for another verify and which Azimuth session ran it, and an interrupted batch to stop without a partial run, so that the records show where verify time went and who spent it.

### S-007.6.1 · Runs record the call's wait and session {happy}
- **GIVEN** `verify.lock` held by a running `sleep 60` process until the second sleep of a lock clock that advances 20000 ms per sleep, and targets T-001.1 and T-001.2
- **WHEN** `verifyBatch` runs them with `ses` "SES-20261020-0900"
- **THEN** its first progress event is `{ kind: "waited", waited_ms: 40000 }`, and `R-0001.json` and `R-0002.json` both have `"waited_ms": 40000` and `"ses": "SES-20261020-0900"`

### S-007.6.2 · A run outside a session that didn't wait {edge}
- **GIVEN** no `verify.lock` and target T-001.1
- **WHEN** `verifyBatch` runs it with `ses` `null`
- **THEN** `R-0001.json` has `"waited_ms": 0` and `"ses": null`

### S-007.6.3 · A target that times out {negative}
- **GIVEN** `timeout_seconds` 1 and target T-001.1 whose command is `sleep 30`
- **WHEN** `verifyBatch` runs it
- **THEN** run R-0001 has `ok` false, `exit_code` 124 and an `output_tail` ending with "[azimuth] timed out after 1s"

### S-007.6.4 · An interruption stops the batch {edge}
- **GIVEN** targets T-001.1, whose command is `sleep 60 & echo $! > child.pid; wait`, and T-001.2, whose command is `touch second`
- **WHEN** the batch's `AbortSignal` aborts after `child.pid` appears
- **THEN** `result.interrupted` is true, `result.runs` is `[]`, `.azimuth/cache/runs/` holds no file, `second` doesn't exist, the pid in `child.pid` no longer exists and `verify.lock` doesn't exist

## ST-007.7 · Short output for a batch
**Intent:** As an orchestrator, I want `--summary` to print one line per run and only the failures' output, so that verifying a batch costs a few lines of my context.

### S-007.7.1 · Summary mode prints one line per run {happy}
- **GIVEN** the events: target T-001.1, run R-0001 for T-001.1 passed in 1200 ms, target T-001.2, run R-0002 for T-001.2 failed with exit code 3 in 500 ms and output tail "boom"
- **WHEN** `reportLines` formats each in "summary" mode without colour
- **THEN** the lines are exactly "R-0001 T-001.1 passed in 1.2s", "R-0002 T-001.2 failed (exit 3) in 0.5s" and "    boom"

### S-007.7.2 · Full mode also names each command {happy}
- **GIVEN** the events: prebuild `cargo build`, prebuild passed in 41200 ms, target T-001.1 with command `echo ok`, run R-0001 for T-001.1 passed in 1200 ms
- **WHEN** `reportLines` formats each in "full" mode without colour
- **THEN** the lines are exactly "prebuild: cargo build", "prebuild passed in 41.2s", "T-001.1: echo ok" and "R-0001 T-001.1 passed in 1.2s"

### S-007.7.3 · A wait is reported in whole seconds, rounded up {happy}
- **GIVEN** waited events of 40000 ms and 300 ms
- **WHEN** `reportLines` formats them in either mode
- **THEN** the lines are "waited 40s for another verify" and "waited 1s for another verify"

### S-007.7.4 · No wait prints nothing {edge}
- **GIVEN** a waited event of 0 ms
- **WHEN** `reportLines` formats it in either mode
- **THEN** it returns `[]`

### S-007.7.5 · A failed prebuild shows its output in both modes {negative}
- **GIVEN** a prebuild result with `ok` false, `exit_code` 2, `duration_ms` 3100 and `output_tail` "no compiler"
- **WHEN** `reportLines` formats it in "full" and in "summary" mode
- **THEN** both return exactly "prebuild failed (exit 2) in 3.1s" and "    no compiler"

## ST-007.8 · azimuth verify takes several IDs and the new options
**Intent:** As an orchestrator, I want `azimuth verify` to take several IDs, `--summary` and `--no-prebuild`, and to stop cleanly when interrupted, so that one command verifies a batch.

### S-007.8.1 · Several IDs in one call, summarised {happy}
- **GIVEN** a project with no runs whose F-001 is in progress with T-001.1 (`echo S-001.1.1 ok`) and T-001.2 (`echo S-001.1.2 ok`)
- **WHEN** `azimuth verify T-001.2 F-001 --summary` runs
- **THEN** it exits 0 and stdout is exactly two lines, `R-0001 T-001.2 passed in <n>s` then `R-0002 T-001.1 passed in <n>s`

### S-007.8.2 · A failed prebuild exits 1 without runs {negative}
- **GIVEN** that project with `verify.prebuild` `echo no compiler; exit 2`
- **WHEN** `azimuth verify T-001.1` runs
- **THEN** it exits 1, stdout has the line `prebuild failed (exit 2) in <n>s` followed by `    no compiler`, and `.azimuth/cache/runs/` holds no file

### S-007.8.3 · --no-prebuild skips the prebuild {edge}
- **GIVEN** that project with `verify.prebuild` `touch prebuilt`
- **WHEN** `azimuth verify T-001.1 --no-prebuild` runs
- **THEN** it exits 0, `prebuilt` doesn't exist and run R-0001 targets T-001.1

### S-007.8.4 · --json keeps stdout to JSON {edge}
- **GIVEN** that project with `verify.prebuild` `echo no compiler; exit 2`
- **WHEN** `azimuth verify T-001.1 --json` runs
- **THEN** it exits 1, stdout is "[]\n", and stderr has the line `prebuild failed (exit 2) in <n>s` followed by `    no compiler`

### S-007.8.5 · SIGTERM stops verify and its command {edge}
- **GIVEN** that project with a task T-001.3 whose verify command is `sleep 60 & echo $! > child.pid; wait`
- **WHEN** `azimuth verify T-001.3` receives SIGTERM after `child.pid` appears
- **THEN** it exits 143, the pid in `child.pid` no longer exists, `verify.lock` doesn't exist and `.azimuth/cache/runs/` holds no file
