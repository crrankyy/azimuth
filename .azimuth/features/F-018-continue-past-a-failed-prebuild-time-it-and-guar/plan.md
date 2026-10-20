---
tasks:
  - id: T-018.1
    title: Scaffolding, the run field, the config keys and the golden fixture
    status: done
    after: []
    covers: []
    files: [src/core/types.ts, src/core/config.ts, src/core/verify.ts, src/core/parse/run.ts, test/fixtures/hookline/expected-index.ts, test/cli/verify-report.test.ts]
    verify: pnpm typecheck
    note: null
  - id: T-018.2
    title: Config keys, init template and the run file's prebuild (red → green)
    status: done
    after: [T-018.1]
    covers: [S-018.1.1, S-018.1.2, S-018.1.3, S-018.1.4, S-018.2.1, S-018.2.2, S-018.2.3]
    files: [src/core/parse/run.ts, src/core/init.ts, test/core/verify-config.test.ts]
    verify: pnpm exec vitest run test/core/verify-config.test.ts test/golden/index.test.ts -t "S-018.1|S-018.2|S-007.1|runs" --reporter=verbose
    note: null
  - id: T-018.3
    title: verifyBatch stops or continues past a failed prebuild (red → green)
    status: done
    after: [T-018.1]
    covers: [S-018.3.1, S-018.3.2, S-018.3.3, S-018.3.4, S-018.3.5, S-018.3.6, S-018.3.7, S-018.3.8]
    files: [src/core/verify.ts, test/core/verify-batch.test.ts]
    verify: pnpm exec vitest run test/core/verify-batch.test.ts -t "S-007.5|S-007.6|S-018.3" --reporter=verbose
    note: null
  - id: T-018.4
    title: verify prints the prebuild's time and marks runs after a failed one (red → green)
    status: in-progress
    after: [T-018.3]
    covers: [S-018.4.1, S-018.4.2, S-018.4.3]
    files: [src/cli/verify-report.ts, test/cli/verify-report.test.ts, test/cli/verify.test.ts]
    verify: pnpm exec vitest run test/cli/verify-report.test.ts test/cli/verify.test.ts -t "S-007.7|S-018.4" --reporter=verbose
    note: null
  - id: T-018.5
    title: The done gate asks for a rerun after a failed prebuild (red → green)
    status: in-progress
    after: [T-018.2]
    covers: [S-018.5.1, S-018.5.2, S-018.5.3, S-018.5.4]
    files: [src/core/gates.ts, test/core/prebuild-gate.test.ts]
    verify: pnpm exec vitest run test/core/prebuild-gate.test.ts test/core/analysis.test.ts -t "S-018.5|S-002.1|requires passing runs" --reporter=verbose
    note: null
  - id: T-018.6
    title: task finish's verify line and log name the prebuild (red → green)
    status: in-progress
    after: [T-018.3]
    covers: [S-018.6.1, S-018.6.2, S-018.6.3, S-018.6.4]
    files: [src/core/finish.ts, test/core/finish.test.ts]
    verify: pnpm exec vitest run test/core/finish.test.ts -t "S-009.3|S-009.5|S-018.6" --reporter=verbose
    note: null
  - id: T-018.7
    title: Disk guard in verify, task finish and doctor (red → green)
    status: done
    after: [T-018.1]
    covers: [S-018.7.1, S-018.7.2, S-018.7.3, S-018.7.4, S-018.7.5, S-018.7.6, S-018.7.7, S-018.7.8, S-018.7.9, S-018.7.10]
    files: [src/core/disk.ts, src/cli/commands/work.ts, src/cli/commands/task.ts, src/cli/commands/harness.ts, test/core/disk.test.ts, test/cli/disk.test.ts, test/cli/doctor.test.ts]
    verify: pnpm exec vitest run test/core/disk.test.ts test/cli/disk.test.ts test/cli/doctor.test.ts --reporter=verbose
    note: null
  - id: T-018.8
    title: Docs, the build skill's early-finish rule and full verification
    status: todo
    after: [T-018.2, T-018.4, T-018.5, T-018.6, T-018.7]
    covers: []
    files: [docs/cli.md, docs/file-format.md, docs/concepts.md, plugin/skills/build/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-018: Plan

The tests come first. F-018 starts once F-019 is done (`depends_on`). F-019 changes
`src/core/finish.ts`, `src/cli/commands/task.ts`, their tests and the build skill first. F-018 then
touches only `verifyOutcome` in `finish.ts` and two lines in `task.ts`. If F-019 renamed what these
notes name, use what it built and record the difference with `azimuth note`.

## The tasks

- **T-018.1 (scaffolding)** lays down every type the later tasks share, so that they typecheck on
  their own:
  - `RunPrebuild` and the required `VerifyRun.prebuild` (`types.ts`).
  - `PREBUILD_FAILURES`, `Config.verify.prebuild_failure` and `min_free_gb`, with their defaults
    and `SHAPE` readers (`config.ts`).
  - In `verify.ts`: `PrebuildResult.timed_out`, set by `runPrebuild` from `result.timed_out`;
    `RunContext.prebuild` and `timeout_seconds`; and `runVerify` writing
    `prebuild: context.prebuild ?? null`.
  - `parseRun` writing `prebuild: null`, a placeholder that T-018.2 replaces.
  - The required field breaks three literals, which it fixes:
    - `"prebuild": null` on the six runs of `test/fixtures/hookline/expected-index.ts`;
    - `prebuild: null` in the `run()` helper of `test/cli/verify-report.test.ts`;
    - `timed_out: false` in its two `prebuilt` results.
- **After T-018.1, three slices touch separate files and can run in parallel:**
  - T-018.2: config, init and parsing.
  - T-018.3: the batch.
  - T-018.7: the disk guard.
- **After T-018.3:** T-018.4 (verify's report) and T-018.6 (finish).
- **After T-018.2:** T-018.5 (the gate), since its tests write run files that `parseRun` must read.
- **T-018.8** changes the docs and the build skill, then runs everything.

## Notes for builders

- **verifyBatch (T-018.3).**
  - After `onProgress({ kind: "prebuilt" })`, return with no runs when
    `!prebuild.ok && (prebuild.timed_out || verify.prebuild_failure === "stop")`.
  - Otherwise pass every `runVerify` call
    `prebuild: prebuild && { ok: prebuild.ok, duration_ms: prebuild.duration_ms }` and
    `timeout_seconds`. That is `build_timeout_seconds + timeout_seconds` when the prebuild failed,
    else `timeout_seconds`.
  - `runVerify` uses `context.timeout_seconds` both for `timeoutMs` and in
    `[azimuth] timed out after <N>s`.
- **verify-batch tests (T-018.3).** They reuse the file's `project()`, `batch()`, `runJson()`,
  `runFiles()`, `LONG_SLEEP`, `until`, `childPid` and `killError`.
  - S-018.3.6's prebuild is ``${LONG_SLEEP} & echo $! > child.pid; wait``.
  - S-018.3.7 takes about 5 s, within the 30 s `testTimeout`.
- **verify's report (T-018.4).**
  - In `reportLines`, `prebuilt` no longer returns `[]` for a passing prebuild in summary mode.
  - `run` appends ` after a failed prebuild` when `event.run.prebuild?.ok === false`.
  - `src/cli/commands/work.ts` needs no change for S-018.4.3: its exit rule already gives 1.
  - `test/cli/verify.test.ts` is new. It runs `runCli(root, ["verify", "T-001.1"])` on a
    `writeTree` project and compares stdout lines with every ` in \d+\.\ds` replaced by
    ` in <n>s`, as `test/cli/task.test.ts` does. It doesn't assert stderr: the real disk may be low
    on the machine running it.
- **The done gate (T-018.5).** In `doneGate`'s loop, between `!run.ok` and the staleness check, add:
  `else if (run.prebuild?.ok === false) stale.push(`${task.id} passed after a failed prebuild`)`.
  Nothing else in `gates.ts` changes.
  - `test/core/prebuild-gate.test.ts` is new. It follows `test/core/analysis.test.ts`'s
    `load`/`analyze` helpers: `loadTree`, `derive`, `validate` and `nextGate`, with run files in
    `.azimuth/cache/runs/`.
  - Its facts are `makeFacts({ git: { available: true, head: "aaaaaaa", commits: [...] } })`, so
    every run is at HEAD.
- **task finish (T-018.6).**
  - `verifyOutcome` still reports the prebuild's failure when there is no run (`stop`, or a
    timeout).
  - When there is a run, it adds ` (prebuild <s>)` after a passing prebuild, or
    ` after a failed prebuild (exit <code>, <s>)` after a failed one, to the run's detail. After a
    failed prebuild, its `logged` text adds ` after a failed prebuild` before the final period.
  - The finish tests reuse `repo({ verify: … })`, `finish()`, `step()`, `steps()`, `head()` and
    `lastLogBody()`. They compare details with a regular expression, as S-009.5.2 does.
- **Disk guard (T-018.7).**
  - `src/core/disk.ts` reads the threshold with `loadConfig(root).config.verify.min_free_gb`.
    `statfsFreeBytes` is `statfsSync(path)`'s `bavail * bsize` (`node:fs`).
    `formatGb` is `(Math.floor(bytes / 1e8) / 10).toFixed(1)` plus ` GB`.
  - `verify` (`work.ts`) writes `diskWarning(diskSpace(rt.root))` and a newline to
    `process.stderr` after `verifyTargets` and only when there are targets. `task finish`
    (`task.ts`) writes it after its argument checks and before `finishTask`.
  - `doctor` (`harness.ts`) calls `diskCheck(diskSpace(root))` after the viewer line, and prints
    its result with `line()` when it isn't null.
  - `test/core/disk.test.ts` passes a source to `diskSpace` (a `vi.fn` for S-018.7.3's "not
    called").
  - `test/cli/disk.test.ts` mocks the module so that the commands use a fixed source: a `let free`
    from `vi.hoisted`, and
    `vi.mock("../../src/core/disk", async (importOriginal) => { const actual = await importOriginal<typeof import("../../src/core/disk")>(); return { ...actual, diskSpace: (root: string) => actual.diskSpace(root, () => free) }; })`.
    This is how `test/cli/new.test.ts` mocks `src/core/session`.
  - Its task finish scenario builds a repository like `test/cli/task.test.ts`'s `repo()`, with
    `T-001.1` covering `S-001.1.1` and `S-001.1.2`. It stubs the `GIT_` variables of `gitEnv()`
    with `vi.stubEnv` in `beforeEach`, or the developer's hooks and signing would run.
  - `diskCheck`'s tests go in `test/cli/doctor.test.ts` beside `pluginCheck`'s.
- **T-018.8: docs and the build skill.** Format the changed Markdown with
  `pnpm exec prettier --write <files>` before the full chain.
  - `docs/cli.md`:
    - **doctor.** It also checks the free disk space against `verify.min_free_gb`.
    - **Verify.** Explain `verify.prebuild_failure: continue`: after a failed prebuild each command
      runs under both timeouts and its run line ends with ` after a failed prebuild`. verify still
      exits 1, and a timed-out or interrupted prebuild records nothing.
    - `--summary` now keeps a passing prebuild's line. Replace "leaves out the commands and a
      passing prebuild's line".
    - Below `verify.min_free_gb`, a warning goes to stderr before the commands run.
    - **Finish a task.** Step 5's verify line shows the prebuild (`R-0142 passed in 1.2s (prebuild
      41.2s)`). Under `continue` a task whose command passes after a failed prebuild is done, and
      the done gate asks for a rerun. Finish prints the same disk warning.
  - `docs/file-format.md`:
    - the two keys in the config.yaml example, with comments and a paragraph after
      `verify.prebuild`'s;
    - `"prebuild": { "ok": true, "duration_ms": 41200 }` in the run JSON example, with a sentence:
      `null` when none ran, and a run file without the key reads as `null`.
  - `docs/concepts.md`: in the paragraph after the gate table, add one sentence. A run that passed
    after a failed prebuild (`verify.prebuild_failure: continue`) needs a rerun with a working
    build: `T-006.2 passed after a failed prebuild`.
  - `plugin/skills/build/SKILL.md`, "Delegating to subagents":
    - In "Parallel only when independent", replace "Wait for the whole batch to report before
      finishing any of its tasks, since a half-finished change elsewhere can break the build."
      with the early-finish rule. Finish a lane as soon as it reports, unless a lane still running
      lists a shared file it lists, or edits files in the same package or crate. Its commit would
      take that lane's half-written insertion, or its verify command would compile that lane's
      half-written code; wait for that lane. `verify.prebuild_failure: continue` is what lets a
      finish pass while another lane's code doesn't build, and the done gate then asks for a rerun
      once the workspace builds.
    - "Then finish the batch one task at a time" becomes: finish each lane's task as the rule
      allows, one finish at a time, never two in parallel. The rest of that bullet stays.

## Files shared with other 0.3 features

Merge by hunk. F-018 changes only the parts named here.

- `src/core/finish.ts` and `src/cli/commands/task.ts`: F-019 comes first. F-018 changes
  `verifyOutcome` and the disk warning only.
- `src/core/gates.ts`: shared with F-020 (`done.scenarios-passing`), F-021 (`done.as-built`) and
  F-023 (the strict rule). F-018 changes only the `done.verify-passed` loop.
- `src/core/types.ts`: other 0.3 features may add their own types there. F-018 adds
  `RunPrebuild` and `VerifyRun.prebuild` only.
- `test/core/finish.test.ts`: F-019 adds its own scenarios. F-018 adds a `describe` for ST-018.6.
- The docs and the build skill: F-019 to F-024 change other sections of `docs/cli.md`,
  `docs/file-format.md`, `docs/concepts.md` and `plugin/skills/build/SKILL.md`.
- `test/fixtures/hookline/expected-index.ts`: F-020 may add fields to its tests. F-018 adds
  `"prebuild": null` to its runs only.
