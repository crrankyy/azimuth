---
tasks:
  - id: T-004.1
    title: Draft suggestion for a specced idea (red → green)
    status: done
    after: []
    covers: [S-004.1.1, S-004.1.2]
    files: [src/core/next.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t S-004.1
    note: null
  - id: T-004.2
    title: Full verification
    status: done
    after: [T-004.1]
    covers: []
    files: []
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run --no-file-parallelism
    note: null
---
# F-004: Plan

One test-first slice in `nextForFeature`, then the full suite.
