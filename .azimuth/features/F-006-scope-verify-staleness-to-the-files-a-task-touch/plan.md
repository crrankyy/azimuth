---
tasks:
  - id: T-006.1
    title: Scaffolding and the verify.shared_paths key
    status: todo
    after: []
    covers: [S-006.6.1, S-006.6.2, S-006.6.3]
    files: [src/core/config.ts, src/core/run-scope.ts, src/core/derive.ts, test/helpers/project.ts, test/core/parse.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/parse.test.ts -t S-006.6 --reporter=verbose
    note: null
  - id: T-006.2
    title: Which paths a run depends on (red → green)
    status: todo
    after: [T-006.1]
    covers: [S-006.1.1, S-006.1.2, S-006.1.3, S-006.2.1, S-006.2.2, S-006.2.3]
    files: [src/core/run-scope.ts, test/core/run-scope.test.ts]
    verify: pnpm exec vitest run test/core/run-scope.test.ts --reporter=verbose
    note: null
  - id: T-006.3
    title: Which later commit made a run stale (red → green)
    status: todo
    after: [T-006.1]
    covers: [S-006.3.1, S-006.3.2, S-006.3.3, S-006.3.4, S-006.3.5, S-006.3.6]
    files: [src/core/derive.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t S-006.3 --reporter=verbose
    note: null
  - id: T-006.4
    title: The done gate names the commit and path (red → green)
    status: todo
    after: [T-006.2, T-006.3]
    covers: [S-006.4.1, S-006.4.2, S-006.4.3, S-006.4.4, S-006.4.5, S-006.4.6]
    files: [src/core/gates.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t "S-006.4|S-002.1" --reporter=verbose
    note: null
  - id: T-006.5
    title: Reproduce issue 1 against real git
    status: todo
    after: [T-006.4]
    covers: [S-006.5.1, S-006.5.2]
    files: [test/core/git-trace.test.ts]
    verify: pnpm exec vitest run test/core/git-trace.test.ts -t "S-006.5|S-002.3" --reporter=verbose
    note: null
  - id: T-006.6
    title: Verify skill, docs and full verification
    status: todo
    after: [T-006.5]
    covers: []
    files: [plugin/skills/verify/SKILL.md, docs/concepts.md, docs/file-format.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-006: Plan

Test-first. The scaffolding (T-006.1) adds the `verify.shared_paths` key with its tests, the
`RunScope` and `StaleCause` types with the signatures of `runScope`, `inScope` and `staleCause`
(placeholder bodies the next tasks replace), exports `sameCommit`, and lets `featureFiles` write
a task's `files`. After it, the scope (T-006.2, `run-scope.ts`) and the commit walk (T-006.3,
`derive.ts`) touch separate files and can be built in parallel. The gate (T-006.4) joins them; it
also updates the expected details of S-002.1.2 and S-002.1.3 to the new format, which is why its
verify runs them too. The real-git test (T-006.5) is the acceptance test from issue #1, and
re-runs F-002's close-out tests, which must keep passing unchanged. T-006.6 changes the verify
skill's close-out to rerun only the runs the done gate names, documents the rule and the key,
and runs everything; the Hookline golden index must not change.
