---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/config.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/parse/run.ts, change: modify }
  - { path: src/core/shell.ts, change: create }
  - { path: src/core/lock.ts, change: modify }
  - { path: src/core/verify.ts, change: modify }
  - { path: src/cli/verify-report.ts, change: create }
  - { path: src/cli/commands/work.ts, change: modify }
  - { path: test/core/verify-config.test.ts, change: create }
  - { path: test/core/shell.test.ts, change: create }
  - { path: test/core/verify-lock.test.ts, change: create }
  - { path: test/core/verify-batch.test.ts, change: create }
  - { path: test/cli/verify-report.test.ts, change: create }
  - { path: test/e2e/verify.test.ts, change: create }
  - { path: docs/cli.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
deviations:
  - { path: .azimuth/features/F-007-verify-several-tasks-with-one-prebuild/stories.md, kind: spec-change, reason: "S-007.3.2 and S-007.3.3 time out after 1 s instead of 300 ms, and S-007.3.3's duration bound follows (1200 ms), so the kill tests stay reliable under load; corrected in 7a35fa8 and re-approved" }
  - { path: src/cli/commands/work.ts, kind: scope-addition, reason: "Signal handling came with the process-group runner rather than from the experience report: a detached command no longer gets the terminal's Ctrl-C, so abortOnSignals turns SIGINT and SIGTERM into an abort that kills the command's group, records no run, releases the verify lock and exits 130 or 143 (S-007.8.5)" }
  - { path: test/core/shell.test.ts, kind: test-change, reason: "The process-group tests here and in test/core/verify-batch.test.ts and test/e2e/verify.test.ts run sleep 60.<pid><n> where the stories say sleep 60, so afterEach can pkill a stray grandchild by its unique argument without touching other sleep processes" }
follow_ups: [DEBT-0004]
---
# F-007: As built

## Summary
`azimuth verify` takes several task and feature IDs. It resolves them all before anything waits
or runs, deduplicated in the order named; with none it takes every task of in-progress and
verifying features, as before. `verifyBatch` (`src/core/verify.ts`) takes the verify lock, runs
`verify.prebuild` once under `verify.build_timeout_seconds` (default 1800; no prebuild by
default), then each target, and releases the lock. The verify lock (`acquireVerifyLock` in
`src/core/lock.ts`, `verify.lock` in the shared cache) waits for a live holder instead of failing
busy. It takes over only a dead pid's lock or an unparseable one older than 30 s, and reports how
long it waited. Every command runs through `runShell` (new `src/core/shell.ts`): `/bin/sh -c`,
detached as its own process group, which a timeout kills as a whole (SIGTERM, then SIGKILL after
2 s). Runs gain the optional fields `waited_ms` and `ses`; older run files parse unchanged.

`src/cli/verify-report.ts` prints each progress event in full, or one line per run with
`--summary`. `--no-prebuild` skips the build. `--json` keeps stdout to the array of runs and
prints a failed prebuild on stderr. SIGINT or SIGTERM stops the running command's group and exits
128 plus the signal number. The build and verify skills verify a batch in one call and no longer
build by hand first.

From R-0066 on, this repository's runs were made by the new verify: they carry `waited_ms: 0` and
`ses: SES-20261019-2021`.

## Deviations
- S-007.3.2 and S-007.3.3 time out after 1 s instead of 300 ms (and S-007.3.3 expects at least
  1200 ms), so the kill tests stay reliable under load. The stories were corrected in 7a35fa8 and
  re-approved.
- SIGINT and SIGTERM handling (`abortOnSignals` in `work.ts`) came with the process-group runner,
  not from the experience report: a detached command no longer gets the terminal's Ctrl-C, so
  `azimuth verify` has to stop the group itself.
- The tests start `sleep 60.<pid><n>` where the stories say `sleep 60`, so `afterEach` can
  `pkill` a stray grandchild by its unique argument without touching other `sleep` processes.

Otherwise the files match `impact.md`.

## Follow-ups
- DEBT-0004: `pidAlive` in `src/core/lock.ts` duplicates the exported `processAlive` in
  `src/core/live.ts`.
