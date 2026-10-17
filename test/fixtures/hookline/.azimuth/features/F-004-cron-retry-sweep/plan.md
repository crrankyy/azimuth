---
tasks:
  - id: T-004.1
    title: Sweep config & validation (red → green)
    status: todo
    after: []
    covers: [S-004.2.2]
    files: [src/config/schema.ts, src/worker/sweep.ts, src/worker/sweep.test.ts]
    verify: pnpm vitest run src/worker/sweep.test.ts
    note: null
  - id: T-004.2
    title: Select and re-queue failed deliveries (red → green)
    status: todo
    after: [T-004.1]
    covers: [S-004.1.1, S-004.1.2]
    files: [src/worker/sweep.ts, src/store/deliveries.ts, src/worker/sweep.test.ts]
    verify: pnpm vitest run src/worker/sweep.test.ts
    note: null
  - id: T-004.3
    title: Overlap guard (red → green)
    status: todo
    after: [T-004.2]
    covers: [S-004.1.3]
    files: [src/worker/sweep.ts, src/worker/sweep.test.ts]
    verify: pnpm vitest run src/worker/sweep.test.ts
    note: null
  - id: T-004.4
    title: Retry limit (red → green)
    status: todo
    after: [T-004.2]
    covers: [S-004.2.1, S-004.2.3]
    files: [src/worker/sweep.ts, src/store/deliveries.ts, src/worker/sweep.test.ts]
    verify: pnpm vitest run src/worker/sweep.test.ts
    note: null
  - id: T-004.5
    title: Start the sweep from the worker loop
    status: todo
    after: [T-004.3, T-004.4]
    covers: []
    files: [src/worker/loop.ts]
    verify: pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .
    note: null
---
