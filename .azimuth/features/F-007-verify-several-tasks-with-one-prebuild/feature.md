---
id: F-007
title: Verify several tasks with one prebuild
summary: azimuth verify takes several task and feature IDs, runs an optional prebuild once under its own timeout, makes concurrent verify processes take turns, kills a timed-out command's whole process group, records each run's wait and session, and has a one-line-per-run summary.
status: idea
priority: P1
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
---
# F-007: Verify several tasks with one prebuild

## Objective
An orchestrator verifies a batch of tasks with one call, `azimuth verify T-… T-… F-… --summary`,
instead of pre-building by hand and verifying task by task. A configured `verify.prebuild`
command runs once per call under its own `verify.build_timeout_seconds`, so only the tasks'
verify commands count against `verify.timeout_seconds`. Concurrent `azimuth verify` processes
take turns on a verify lock instead of racing each other's builds, and each run records how long
it waited and which Azimuth session ran it. A command that times out is killed with its whole
process group, so no compiler or test process outlives it. (Experience report §4.2, §5.2, §4.8.)

## Out of scope
- Detecting a running `cargo` (or any other build tool) process, or taking a build tool's own
  lock: the verify lock only serialises `azimuth verify` processes.
- Running targets in parallel, and prebuild commands per task or per feature.
- Recording the prebuild as a verify run, or showing `waited_ms` and `ses` in the viewer (the
  fields reach the index; showing them is later work).
- `azimuth init`'s config template: it doesn't gain the new keys, which take their defaults when
  absent.
- Platforms without POSIX process groups (verify already runs commands with `/bin/sh`).
- Other features' config keys (F-006 `verify.shared_paths`, F-012 `autonomy.questions`).

## Integration points
- `src/core/config.ts`: `verify.prebuild` (string or null, default null) and
  `verify.build_timeout_seconds` (default 1800) in `Config`, `DEFAULT_CONFIG` and `SHAPE`.
- `src/core/types.ts` and `src/core/parse/run.ts`: optional run fields `waited_ms` and `ses`.
- `src/core/shell.ts` (new): `runShell` spawns `/bin/sh -c` detached and, on a timeout or an
  abort, kills the process group (SIGTERM, then SIGKILL after a grace period).
- `src/core/lock.ts`: `acquireVerifyLock`, a wait-don't-fail lock on `verify.lock` in
  `sharedCacheDir(root)`, beside the existing `withLock` write lock.
- `src/core/verify.ts`: `verifyTargets` takes a list of IDs; `runVerify` becomes async and
  records `waited_ms` and `ses`; new `verifyBatch` takes the lock, runs the prebuild, then the
  targets, and reports progress events.
- `src/cli/verify-report.ts` (new): the lines printed for each progress event, in full or
  summary mode.
- `src/cli/commands/work.ts`: `verify` takes several IDs, `--no-prebuild` and `--summary`,
  passes `runtime().session` as `ses`, and turns SIGINT/SIGTERM into an abort.

## Invariants
- Runs written before this feature parse to the same objects as before (no `waited_ms` or `ses`
  key), so the index and the Hookline golden index don't change.
- A run's `duration_ms` counts only its own command, never the lock wait or the prebuild.
- Unchanged per run: `/bin/sh -c` from the project root; `AZIMUTH_JUNIT`, `AZIMUTH_TASK` and
  `FORCE_COLOR=0` in the environment; output is stdout followed by stderr; a timeout gives exit
  code 124 and appends `[azimuth] timed out after <N>s` to the output tail; run IDs come from
  `allocateId` under the write lock.
- IDs are resolved before anything waits or runs: an unknown ID fails at once, without taking
  the verify lock or running the prebuild.
- A live process's verify lock is never taken over, however old it is. Only `azimuth verify`
  takes the verify lock, so no other command ever waits for a verify.
- No command started by verify outlives it: a timeout, or SIGINT/SIGTERM to `azimuth verify`,
  kills the command's whole process group.
- `--json` still prints a JSON array of runs and nothing else on stdout.

## Assumptions
- Spawning with `detached: true` makes the shell a process-group leader, so
  `process.kill(-pid, signal)` reaches every process it started (POSIX). `spawnSync` can't
  detach, so `runVerify` becomes async; `Command.run` may already return a Promise
  (`src/cli/types.ts`, awaited in `src/cli/main.ts`).
- A detached command leaves the terminal's process group, so Ctrl-C would no longer reach it.
  `azimuth verify` therefore turns SIGINT and SIGTERM into an abort: it kills the running
  command's group, records no run for that command, skips the remaining targets, releases the
  lock and exits 128 + the signal number (130 for SIGINT, 143 for SIGTERM).
- The kill grace period is 2 s (`KILL_GRACE_MS`); the verify lock is polled every 250 ms.
- The verify lock covers the whole call (prebuild and every target), so another verify can't
  rebuild between the prebuild and the targets. Every run of a call records that call's wait in
  `waited_ms`.
- A verify lock file that can't be parsed and is older than 30 s is abandoned (its writer died
  between creating and filling it). A lock whose pid was reused by an unrelated process waits
  until that process exits; deleting `.azimuth/cache/verify.lock` releases it.
- "waited Ns for another verify" rounds up to whole seconds, so any wait prints at least 1s. It
  is printed once per call, before the prebuild, in full and summary mode.
- With no targets (no ID and nothing in flight), verify neither waits nor prebuilds and exits 0
  without output, as today. A blank `verify.prebuild` counts as none; `--no-prebuild` without a
  prebuild does nothing.
- With `--json`, a failed prebuild prints `[]` on stdout and its failure line and output tail on
  stderr. `--json` wins over `--summary`.
- `runShell` keeps the last 64 MB of each stream (today's `maxBuffer`), dropping older output
  instead of failing the run.
