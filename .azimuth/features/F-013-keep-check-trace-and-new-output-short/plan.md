---
tasks:
  - id: T-013.1
    title: In-process CLI test harness
    status: done
    after: []
    covers: []
    files: [test/helpers/cli.ts]
    verify: pnpm typecheck
    note: null
  - id: T-013.2
    title: check counts warnings by code unless --warnings or an ID (red → green)
    status: done
    after: [T-013.1]
    covers: [S-013.1.1, S-013.1.2, S-013.1.3, S-013.1.4, S-013.1.5]
    files: [src/cli/commands/read.ts, test/cli/check.test.ts]
    verify: pnpm exec vitest run test/cli/check.test.ts -t S-013.1 --reporter=verbose
    note: null
  - id: T-013.3
    title: trace hides mention-only references unless --all (red → green)
    status: done
    after: [T-013.2]
    covers: [S-013.2.1, S-013.2.2, S-013.2.3, S-013.2.4]
    files: [src/cli/commands/read.ts, test/cli/trace.test.ts]
    verify: pnpm exec vitest run test/cli/trace.test.ts -t S-013.2 --reporter=verbose
    note: null
  - id: T-013.4
    title: new prints only the ID, before any later step can fail (red → green)
    status: done
    after: [T-013.1]
    covers: [S-013.3.1, S-013.3.2, S-013.3.3, S-013.3.4, S-013.3.5, S-013.3.6]
    files: [src/cli/commands/write.ts, src/core/create.ts, test/cli/new.test.ts]
    verify: pnpm exec vitest run test/cli/new.test.ts test/core/transitions.test.ts --reporter=verbose
    note: null
  - id: T-013.5
    title: Docs and full verification
    status: done
    after: [T-013.3, T-013.4]
    covers: []
    files: [docs/cli.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-013: Plan

Test-first. T-013.1 adds `runCli()`, which runs `main()` in-process with stdout and stderr
captured, so the CLI tests need no build. After it, `check` (T-013.2) and `new` (T-013.4) touch
separate files and can be built in parallel; `trace` (T-013.3) follows `check` only because both
live in `src/cli/commands/read.ts`.

Fixtures: the check and trace tests build their project with `writeTree`, `MINIMAL_CONFIG` and
`featureFiles()` (slug `thing`), plus `src/app.ts` so the default impact entry exists; init a git
repository with `test/helpers/git.ts` if the index needs one. `test/cli/new.test.ts` replaces
`recordInSession` with `vi.mock("../../src/core/session", …)`, delegating to the real function
except in S-013.3.5, where it throws `new AzimuthError("busy", "Another Azimuth command is
writing; try again in a moment.")`.

T-013.4 also runs `test/core/transitions.test.ts`, which creates issues and questions through
`createIssue` and `createQuestion`, to catch regressions from moving `patch()` into `createRecord`.

T-013.5 updates `docs/cli.md`: the `check` and `trace` rows of the Read table (new options and
what they hide), and a paragraph in Create on what `new` prints on stdout and stderr and that the
ID is printed even when recording it in the session fails afterwards. Run Prettier on it.
