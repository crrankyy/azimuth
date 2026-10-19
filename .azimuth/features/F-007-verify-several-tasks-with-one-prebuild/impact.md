---
files:
  - path: src/core/config.ts
    change: modify
    note: verify.prebuild (default null) and verify.build_timeout_seconds (default 1800) in Config, DEFAULT_CONFIG and SHAPE
  - path: src/core/types.ts
    change: modify
    note: Optional VerifyRun fields waited_ms and ses
  - path: src/core/parse/run.ts
    change: modify
    note: Reads waited_ms and ses when present and valid; old runs parse unchanged
  - path: src/core/shell.ts
    change: create
    note: runShell(), a detached /bin/sh -c whose process group is killed on timeout or abort
  - path: src/core/lock.ts
    change: modify
    note: acquireVerifyLock(), the verify.lock that waits instead of failing busy
  - path: src/core/verify.ts
    change: modify
    note: verifyTargets() over several IDs, async runVerify() with waited_ms and ses, verifyBatch() with the prebuild, progress events
  - path: src/core/session.ts
    change: read
    note: currentSession(), which runtime() already resolves for the CLI
  - path: src/core/allocate.ts
    change: read
    note: allocateId() still names runs under the write lock
  - path: src/cli/verify-report.ts
    change: create
    note: reportLines(), the text printed for each verify progress event in full or summary mode
  - path: src/cli/commands/work.ts
    change: modify
    note: verify takes several IDs, --no-prebuild and --summary, awaits verifyBatch, turns SIGINT/SIGTERM into an abort
  - path: src/cli/io.ts
    change: read
    note: runtime().session is the run's ses; color and print
  - path: src/cli/main.ts
    change: read
    note: Already awaits Command.run, so verify can be async
  - path: test/core/verify-config.test.ts
    change: test
    note: The new config keys and run fields
  - path: test/core/shell.test.ts
    change: test
    note: Exit codes, output order, process-group kill on timeout and abort
  - path: test/core/verify-lock.test.ts
    change: test
    note: Waiting for, taking over and giving up the verify lock
  - path: test/core/verify-batch.test.ts
    change: test
    note: Target selection, prebuild, timeouts, waited_ms and ses in runs, interruption
  - path: test/cli/verify-report.test.ts
    change: test
    note: Full and summary output lines
  - path: test/e2e/verify.test.ts
    change: test
    note: The built CLI with several IDs, --summary, --no-prebuild, --json and SIGTERM
  - path: docs/cli.md
    change: modify
    note: verify usage, prebuild, verify lock, --summary, --no-prebuild
  - path: docs/file-format.md
    change: modify
    note: verify.prebuild and verify.build_timeout_seconds, run fields waited_ms and ses, verify.lock in the cache table
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Verify a feature with --summary; prebuild
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: Verify a finished batch of tasks in one call; prebuild instead of building by hand
---
# F-007: Impact map

The process-group runner (`shell.ts`) and the verify lock (`lock.ts`) are new building blocks
that `verify.ts` composes in `verifyBatch`; the CLI only resolves IDs, wires signals and prints
the lines `verify-report.ts` gives it. Runs gain two optional fields, so nothing that reads runs
(index, viewer, gates) has to change.

F-006, specified at the same time, adds `verify.shared_paths` to `config.ts` and
`docs/file-format.md`; whichever feature lands second rebases onto the other there.
