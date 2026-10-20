---
id: F-018
title: Continue past a failed prebuild, time it and guard the disk
summary: "verify.prebuild_failure: continue lets each target's own command run after a failed prebuild while the done gate asks for a rerun with a working build; runs record the prebuild that served them; verify.min_free_gb warns before a verify on a nearly full disk."
status: in-progress
priority: P1
size: M
mode: brownfield
milestone: M-02
depends_on: [F-019]
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
approved_at: 2026-10-20
approved_by: agent
approved_hash: sha256:dc449e4bc75d57677ec773dc188a2594fad196e33fe2277dd8f32358923ef23c
approved_commit: 7f7a8c2
review_ack_at: null
---
# F-018: Continue past a failed prebuild, time it and guard the disk

## Objective
In the second ZenithMD run, finished lanes waited about 35 minutes in all for the slowest lane of
their batch (experience report §4.1). `task finish` runs `verify.prebuild` on the working tree,
and another lane's half-written code makes it fail. Today a failed prebuild records no run, so the
build skill says to finish nothing until the whole batch has reported. The review of the 0.3 plan
found two limits (findings 1 and 2):

- Running anyway can pass a run against old build output.
- It can also miss a break in another package that only the prebuild would have caught.
- It gains less than 35 minutes, because a lane that shares a file or a package with a lane still
  running must still wait.

This feature makes running past a failed prebuild an opt-in and has the done gate ask for a rerun.
It also covers two smaller items (§4.8, §5.7, §5.10):

- **`verify.prebuild_failure: stop | continue`** (default `stop`, today's behaviour). Under
  `continue`, a prebuild that exits non-zero no longer stops the batch. Each target's own command
  runs under `verify.build_timeout_seconds + verify.timeout_seconds`, since it now builds what the
  prebuild would have built. A prebuild that times out or is interrupted still records nothing.
- **Every run records the prebuild that served it:** `prebuild: { ok, duration_ms }`, or `null`
  when none ran. Run files written before this feature read as `null`.
  - `verify` (full and `--summary`) prints the prebuild's time.
  - `task finish`'s verify line prints it too.
  - A run made after a failed prebuild says so.
- **`done.verify-passed`** treats a passing run whose `prebuild.ok` is false as needing a rerun
  (`T-001.1 passed after a failed prebuild`). So a feature reaches done only once the whole
  workspace builds.
- **Disk guard, `verify.min_free_gb`** (default 10; 0 turns it off). It reads the free space of the
  project root's filesystem with `fs.statfsSync`.
  - Below the threshold, `azimuth verify` and `azimuth task finish` print a warning on stderr
    before running, and `azimuth doctor` shows a warning line.
  - It never blocks anything.
- **The build skill** replaces "wait for the whole batch" with an early-finish rule. A lane
  finishes as soon as it reports, unless a lane still running lists a shared file it lists, or
  edits files in the same package or crate. `init` and the docs gain both keys.

## Out of scope
- Scoping the prebuild to a task's package or crate (report §5.1's suggestion). The opt-in
  fallback replaces it (decided by the user).
- Changing the default (`stop`), `--no-prebuild`, the verify lock, or any timeout after a passing
  prebuild.
- Keeping a prebuild's output tail or exit code in run files: a run records only `ok` and
  `duration_ms`.
- Showing the prebuild in the viewer (run cards, `RunResult`). The field reaches the index, but no
  viewer component reads it.
- `done.scenarios-passing` and coverage: a scenario a run passed after a failed prebuild still
  counts as passing. `done.verify-passed` holds the feature back until the rerun.
- Blocking on low disk space, or sweeping stale build output (§4.8's other suggestion). Checking
  the disk anywhere but `verify`, `task finish` and `doctor` (hooks, `status`, the viewer) is out
  too.
- Adding `prebuild` or `build_timeout_seconds` to the init template, and editing this
  repository's own `config.yaml`.
- The verify skill. Its rerun step already reruns the tasks named in the done gate's detail.
- F-019's finish changes (unlisted files, `--adopt`, the split `not staged` output). The other
  done-gate checks belong to F-020 (`done.scenarios-passing`), F-021 (`done.as-built`) and F-023
  (warnings).

## Integration points
- `src/core/config.ts`:
  - `Config.verify` gains `prebuild_failure` (`PREBUILD_FAILURES`) and `min_free_gb`.
  - `DEFAULT_CONFIG` gets `"stop"` and `10`.
  - `SHAPE.verify` reads them with `r.oneOf` and `r.int(0)` (`schema.ts`).
- `src/core/types.ts` (shared with other 0.3 features): only `RunPrebuild` and
  `VerifyRun.prebuild`. `types.ts` stays free of Node imports.
- `src/core/parse/run.ts`: `parseRun` reads `prebuild`. A missing or malformed value becomes
  `null`, with no problem.
- `src/core/verify.ts`:
  - `PrebuildResult.timed_out` and `runPrebuild`.
  - `RunContext` gains `prebuild` and `timeout_seconds`. `runVerify` uses them for the run's field,
    its timeout and the timeout line.
  - `verifyBatch`'s prebuild branch applies `prebuild_failure`.
- `src/core/gates.ts` (shared with F-020, F-021, F-023): only the task loop of `doneGate` that
  builds `done.verify-passed`.
- `src/core/finish.ts` (shared with F-019, which changes it first): only `verifyOutcome`, the verify
  step's detail and log text.
- `src/cli/verify-report.ts`: `reportLines` for `prebuilt` (now in both modes) and `run`.
- `src/core/disk.ts` (new): `statfsFreeBytes`, `diskSpace`, `formatGb`, `diskWarning`. It reads
  `verify.min_free_gb` with `loadConfig`.
- `src/cli/commands/work.ts`: `verify` writes `diskWarning(diskSpace(root))` to stderr before the
  batch. Its exit-code rule is unchanged.
- `src/cli/commands/task.ts` (shared with F-019): `task finish` writes the same warning to stderr
  before `finishTask`.
- `src/cli/commands/harness.ts`: `diskCheck(space)` (pure, like `pluginCheck` and `hooksCheck`),
  printed by `doctor` through its `line()` helper.
- `src/core/init.ts`: two lines in `configYaml`'s verify section.
- `test/fixtures/hookline/expected-index.ts`: its six runs gain `"prebuild": null`, which the
  golden test (`test/golden/index.test.ts`) compares.
- Docs and skills, shared with F-019 to F-024:
  - `docs/cli.md`: doctor, Verify, Finish a task.
  - `docs/file-format.md`: config.yaml and the run JSON.
  - `docs/concepts.md`: the done-gate paragraph.
  - `plugin/skills/build/SKILL.md`: "Delegating to subagents". F-019 and F-024 change other parts of
    it.

## Invariants
- Under `prebuild_failure: stop` (also when the key is absent), a failed prebuild runs no target
  command and records no run. verify exits 1, and task finish fails its verify step with
  `prebuild failed (exit N) in Xs`, as before.
- A prebuild that times out or is interrupted never lets a target run or a run be recorded,
  whatever `prebuild_failure` says.
- After a passing prebuild, or with no prebuild, each target keeps `verify.timeout_seconds`.
  The longer timeout applies only after a prebuild that exited non-zero under `continue`.
- `azimuth verify` exits 1 whenever its prebuild failed, also under `continue` when every run
  passed. `--json` still prints only the JSON array of runs on stdout.
- Every run file written from now on has a `prebuild` key. Run files without it parse with
  `prebuild: null` and no problem, and the done gate treats `null` as before.
- A run with `prebuild.ok: false` never satisfies `done.verify-passed`.
- The disk guard never blocks.
  - It changes no exit code and nothing on stdout of `verify` or `task finish`.
  - Its warning goes to stderr only.
  - doctor's disk line never makes doctor exit 1.
  - With `min_free_gb: 0`, nothing reads the free space and nothing is printed.

## Assumptions
- **Exit code.** `azimuth verify` keeps `ok = (prebuild?.ok ?? true) && runs.every(ok)`. A failed
  prebuild under `continue` exits 1 even when every run passed: the call didn't prove the
  workspace builds. `task finish` passes on its run alone, which is what lets a lane finish
  early.
- **Telling a timeout apart.** A timed-out prebuild is recognised by `PrebuildResult.timed_out`,
  not by exit code 124, which a command can return itself.
- **Timeout under continue.** After a failed prebuild under `continue`, each target's limit is
  `build_timeout_seconds + timeout_seconds`. Its timeout line names the sum:
  `[azimuth] timed out after 2400s` with the defaults (1800 + 600).
- **The recorded prebuild.** Every run of one call records the same object: the prebuild's `ok` and
  `duration_ms`. It is `null` when no prebuild ran (none configured, a blank command,
  `--no-prebuild`), as when a run file has no key, or a malformed one (not an object with a
  boolean `ok` and a number `duration_ms` ≥ 0).
- **The done gate.**
  - A task whose latest run passed with `prebuild.ok` false is listed with the stale ones, after
    any failures, as `T-001.1 passed after a failed prebuild`.
  - Its staleness isn't checked as well, since it needs a rerun anyway.
  - A later run with a working prebuild replaces it, because the gate reads each task's latest run.
- **verify's output.**
  - `--summary` now prints a passing prebuild's line (`prebuild passed in 41.2s`), as full mode
    does, so the summary shows the prebuild's time once per call.
  - A run line made after a failed prebuild ends with ` after a failed prebuild` in both modes.
  - The failed prebuild's own lines don't change.
- **task finish's verify line.**
  - After a passing prebuild it adds ` (prebuild 41.2s)`; after a failed one,
    ` after a failed prebuild (exit 2, 3.1s)`.
  - The step's output stays the run's output tail on a failure, and empty on a pass.
  - The log entry adds ` after a failed prebuild` before its final period, and is unchanged
    otherwise.
  - Under `stop`, a failed prebuild reads as before.
- **Disk units.** Free space is `bavail × bsize` from `fs.statfsSync(root)`: the space an
  unprivileged user can write, without the filesystem's reserve. A GB is 10^9 bytes.
  - The disk is low when free < `min_free_gb` × 10^9.
  - Free space prints rounded down to one decimal (`9.9 GB` for 9,999,999,999 bytes), so a low
    value never prints at or above the threshold.
  - `min_free_gb` is a whole number ≥ 0.
- **Unreadable free space.** When `statfsSync` throws, verify and finish print nothing, and
  doctor prints a `?` line with the error message.
- **Where the warning prints.**
  - `verify` prints it once, after its IDs resolve (an unknown ID still exits 1 first) and only
    when there is a target to run.
  - `task finish` prints it once, after its argument checks and before `finishTask`.
  - It prints in `--json` mode too, since it goes to stderr.
- **doctor's disk line.**
  - It comes after the viewer line.
  - It uses doctor's existing marks: `✓` when there is room, and the yellow `?` (which doesn't
    fail doctor) when the disk is low or unreadable.
  - It is left out when `min_free_gb` is 0.
- **Testing the disk guard.** Core functions take the free-space source as a parameter (`FreeBytes`,
  default `statfsFreeBytes`). The CLI tests swap it with `vi.mock` of `src/core/disk`
  (`importOriginal`, then `diskSpace` bound to a fixed source), as `test/cli/new.test.ts` mocks
  `src/core/session`.
- **init template.** It writes `prebuild_failure: stop` and `min_free_gb: 10`, with comments,
  after `output_tail_lines`.
- **The early-finish rule** goes in the build skill's "Delegating to subagents". It replaces "Wait
  for the whole batch to report before finishing any of its tasks". The "Then finish the batch one
  task at a time" bullet then finishes each lane as the rule allows, still one finish at a time.
