---
files:
  - path: src/core/config.ts
    change: modify
    note: PREBUILD_FAILURES; Config.verify.prebuild_failure and min_free_gb, their defaults (stop, 10) and readers (r.oneOf, r.int(0))
  - path: src/core/types.ts
    change: modify
    note: RunPrebuild and VerifyRun.prebuild only (shared with other 0.3 features)
  - path: src/core/parse/run.ts
    change: modify
    note: parseRun reads prebuild; a missing or malformed value is null, with no problem
  - path: src/core/verify.ts
    change: modify
    note: PrebuildResult.timed_out; RunContext.prebuild and timeout_seconds in runVerify; verifyBatch applies prebuild_failure
  - path: src/core/gates.ts
    change: modify
    note: doneGate's done.verify-passed lists a run that passed after a failed prebuild (shared with F-020, F-021, F-023)
  - path: src/core/finish.ts
    change: modify
    note: verifyOutcome only, the verify step's detail and log text with the prebuild (shared with F-019)
  - path: src/core/disk.ts
    change: create
    note: statfsFreeBytes, diskSpace (reads verify.min_free_gb), formatGb and diskWarning, with an injectable free-space source
  - path: src/core/init.ts
    change: modify
    note: configYaml writes prebuild_failure and min_free_gb in the verify section
  - path: src/cli/verify-report.ts
    change: modify
    note: reportLines prints a passing prebuild in summary mode too and marks runs made after a failed prebuild
  - path: src/cli/commands/work.ts
    change: modify
    note: verify writes the disk warning to stderr before the batch; the exit-code rule is unchanged
  - path: src/cli/commands/task.ts
    change: modify
    note: task finish writes the disk warning to stderr before finishTask (shared with F-019)
  - path: src/cli/commands/harness.ts
    change: modify
    note: diskCheck, doctor's disk line after the viewer line
  - path: test/fixtures/hookline/expected-index.ts
    change: modify
    note: Each of its six runs gains a null prebuild (the golden index test compares them)
  - path: src/core/shell.ts
    change: read
    note: runShell's timeoutMs, timed_out and exit code 124
  - path: src/core/schema.ts
    change: read
    note: r.oneOf and r.int, whose expected text makes the E-SCHEMA messages
  - path: src/core/derive.ts
    change: read
    note: lastRun, the latest run per task the done gate reads
  - path: src/core/model.ts
    change: read
    note: readRuns parses run files with parseRun
  - path: src/cli/io.ts
    change: read
    note: print, color and runtime
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process and captures stdout and stderr
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll and gitEnv for the task finish scenarios
  - path: test/helpers/project.ts
    change: read
    note: featureFiles, loadTree and makeFacts
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG
  - path: test/golden/index.test.ts
    change: read
    note: Compares the Hookline index with expected-index.ts, runs included
  - path: test/core/verify-config.test.ts
    change: test
    note: The two config keys, the init template and the run file's prebuild
  - path: test/core/verify-batch.test.ts
    change: test
    note: verifyBatch under stop and continue, the recorded prebuild and the per-target timeout
  - path: test/cli/verify-report.test.ts
    change: test
    note: reportLines for a passing prebuild in summary mode and runs after a failed prebuild
  - path: test/cli/verify.test.ts
    change: test
    note: azimuth verify in process under continue, its exit code and lines
  - path: test/core/prebuild-gate.test.ts
    change: test
    note: done.verify-passed for runs after a failed, a passing or no prebuild
  - path: test/core/finish.test.ts
    change: test
    note: task finish's verify step and log with a passing, a failed or no prebuild
  - path: test/core/disk.test.ts
    change: test
    note: diskSpace and diskWarning with an injected free-space source
  - path: test/cli/disk.test.ts
    change: test
    note: verify and task finish print the disk warning on stderr and still run
  - path: test/cli/doctor.test.ts
    change: test
    note: diskCheck lines for ok, low, off and unreadable
  - path: docs/cli.md
    change: modify
    note: doctor's disk check, Verify (prebuild_failure, the summary's prebuild line, the disk warning), Finish a task (verify line)
  - path: docs/file-format.md
    change: modify
    note: config.yaml's two keys and the run JSON's prebuild
  - path: docs/concepts.md
    change: modify
    note: The done-gate paragraph names runs after a failed prebuild
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: The early-finish rule replaces waiting for the whole batch; prebuild_failure continue
---
# F-018: Impact map

The policy lives in `verifyBatch` (`verify.ts`), and the run field in `types.ts` and
`parse/run.ts`. The done gate adds one branch to its task loop, and `finish.ts` changes only
`verifyOutcome`. The disk guard is a new core module (`disk.ts`) that the `verify` and
`task finish` commands and `doctor` call. The CLI prints its warning, because core never writes to
stderr.

`VerifyRun.prebuild` is required, so every literal typed as a run gains it. Those are
`runVerify`'s run, the Hookline expected index (`satisfies Index`) and the `run()` helper in
`test/cli/verify-report.test.ts`. `PrebuildResult.timed_out` is required too, so the two
`prebuilt` literals in that test gain `timed_out: false`. Run files written in other tests
(`analysis.test.ts`, `git-trace.test.ts`) are JSON and read as `null`.
