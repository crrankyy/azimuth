---
tasks:
  - id: T-003.1
    title: Titles with quote characters (red → green)
    status: in-progress
    after: []
    covers: [S-003.1.1, S-003.1.2, S-003.1.3, S-003.1.4]
    files: [src/core/trace.ts, test/core/git-trace.test.ts]
    verify: pnpm exec vitest run test/core/git-trace.test.ts -t S-003.1
    note: null
  - id: T-003.2
    title: Full verification
    status: todo
    after: [T-003.1]
    covers: []
    files: []
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run --no-file-parallelism
    note: null
---
# F-003: Plan

One test-first slice for the pattern, then the full suite (the golden test traces the sample
project's tests and must not change).
