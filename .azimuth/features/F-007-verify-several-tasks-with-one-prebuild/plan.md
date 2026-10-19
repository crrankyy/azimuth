---
tasks:
  - id: T-007.1
    title: Config keys, run fields and shared types (red → green)
    status: todo
    after: []
    covers: [S-007.1.1, S-007.1.2, S-007.1.3, S-007.1.4, S-007.1.5, S-007.1.6, S-007.1.7]
    files: [src/core/config.ts, src/core/types.ts, src/core/parse/run.ts, src/core/verify.ts, test/core/verify-config.test.ts]
    verify: pnpm exec vitest run test/core/verify-config.test.ts -t S-007.1 --reporter=verbose && pnpm typecheck
    note: null
  - id: T-007.2
    title: Process-group runner (red → green)
    status: todo
    after: []
    covers: [S-007.3.1, S-007.3.2, S-007.3.3, S-007.3.4]
    files: [src/core/shell.ts, test/core/shell.test.ts]
    verify: pnpm exec vitest run test/core/shell.test.ts -t S-007.3 --reporter=verbose
    note: null
  - id: T-007.3
    title: Verify lock that waits (red → green)
    status: todo
    after: []
    covers: [S-007.4.1, S-007.4.2, S-007.4.3, S-007.4.4]
    files: [src/core/lock.ts, test/core/verify-lock.test.ts]
    verify: pnpm exec vitest run test/core/verify-lock.test.ts -t S-007.4 --reporter=verbose
    note: null
  - id: T-007.4
    title: Full and summary output lines (red → green)
    status: todo
    after: [T-007.1]
    covers: [S-007.7.1, S-007.7.2, S-007.7.3, S-007.7.4, S-007.7.5]
    files: [src/cli/verify-report.ts, test/cli/verify-report.test.ts]
    verify: pnpm exec vitest run test/cli/verify-report.test.ts -t S-007.7 --reporter=verbose
    note: null
  - id: T-007.5
    title: Several targets in one call (red → green)
    status: todo
    after: [T-007.1]
    covers: [S-007.2.1, S-007.2.2, S-007.2.3]
    files: [src/core/verify.ts, src/cli/commands/work.ts, test/core/verify-batch.test.ts]
    verify: pnpm exec vitest run test/core/verify-batch.test.ts -t S-007.2 --reporter=verbose && pnpm typecheck
    note: null
  - id: T-007.6
    title: Batch with lock, prebuild, process groups and run fields (red → green)
    status: todo
    after: [T-007.2, T-007.3, T-007.5]
    covers: [S-007.5.1, S-007.5.2, S-007.5.3, S-007.5.4, S-007.5.5, S-007.6.1, S-007.6.2, S-007.6.3, S-007.6.4]
    files: [src/core/verify.ts, src/cli/commands/work.ts, test/core/verify-batch.test.ts]
    verify: pnpm exec vitest run test/core/verify-batch.test.ts -t "S-007.[56]" --reporter=verbose && pnpm typecheck
    note: null
  - id: T-007.7
    title: CLI options, summary output and signals (red → green)
    status: todo
    after: [T-007.4, T-007.6]
    covers: [S-007.8.1, S-007.8.2, S-007.8.3, S-007.8.4, S-007.8.5]
    files: [src/cli/commands/work.ts, test/e2e/verify.test.ts]
    verify: pnpm build && pnpm exec vitest run test/e2e/verify.test.ts -t S-007.8 --reporter=verbose
    note: null
  - id: T-007.8
    title: Docs and full verification
    status: todo
    after: [T-007.7]
    covers: []
    files: [docs/cli.md, docs/file-format.md, plugin/skills/verify/SKILL.md, plugin/skills/build/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-007: Plan

Test-first. T-007.1 adds the config keys, the optional run fields and the `PrebuildResult` and
`VerifyProgress` types in `verify.ts` (types only). The process-group runner (T-007.2) and the
verify lock (T-007.3) need none of it and can start at once; the output lines (T-007.4) and the
multi-ID `verifyTargets` (T-007.5) follow the scaffolding. All four touch separate files and can
be built in parallel. T-007.6 composes runner and lock into `verifyBatch` and makes `runVerify`
async; it switches the `verify` command to `await verifyBatch(…)` with today's printing so the
project keeps type-checking. T-007.7 then adds the options, `reportLines` and signal handling, and
T-007.8 the docs.

Notes for builders:

- Core tests build projects with `writeTree`/`loadTree` and `featureFiles` from `test/helpers/`
  (F-001 `in-progress` with tasks whose `verify` is a small shell command). Verify commands run
  with the project root as cwd, so marker files (`ran`, `prebuilt`, `child.pid`) land there.
- Kill every `sleep 60` a test starts (`afterEach`), whether or not the test passed.
- Lock tests inject `now` and `sleep` (S-007.4.2, S-007.6.1) so `waited_ms` is exact and no test
  waits in real time. A "dead pid" is the pid of a `spawnSync("true")` child.
- `reportLines` colours through `color` from `src/cli/io.ts`; tests set `NO_COLOR=1`.
- The e2e file runs `plugin/bin/azimuth` the way `test/e2e/cli.test.ts` does (`NO_COLOR`,
  `AZIMUTH_NO_VIEWER`, a temp `XDG_CACHE_HOME`), each scenario in its own temp project. The
  SIGTERM scenario spawns the launcher asynchronously; the launcher `exec`s node, so the signal
  reaches the CLI.
- Keep `test/e2e/cli.test.ts` passing unchanged ("R-0001 T-001.1 passed").
