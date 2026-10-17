---
tasks:
  - id: T-008.1
    title: Types & scaffolding
    status: todo
    after: []
    covers: []
    files: [src/api/replay.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-008.2
    title: Single replay (red → green)
    status: todo
    after: [T-008.1]
    covers: [S-008.1.1, S-008.1.2, S-008.1.3]
    files: [src/api/replay.ts, src/store/deliveries.ts, src/api/replay.test.ts]
    verify: pnpm vitest run src/api/replay.test.ts
    note: null
  - id: T-008.3
    title: Re-sign replays (red → green)
    status: todo
    after: [T-008.2]
    covers: [S-008.2.1, S-008.2.2, S-008.2.3]
    files: [src/api/replay.ts, src/api/replay.test.ts]
    verify: pnpm vitest run src/api/replay.test.ts
    note: null
  - id: T-008.4
    title: Bulk dead-letter replay (red → green)
    status: todo
    after: [T-008.2]
    covers: [S-008.3.1, S-008.3.2]
    files: [src/api/replay.ts, src/api/replay-bulk.test.ts]
    verify: pnpm vitest run src/api/replay-bulk.test.ts
    note: null
  - id: T-008.5
    title: Register the replay routes
    status: todo
    after: [T-008.3, T-008.4]
    covers: []
    files: [src/api/server.ts]
    verify: pnpm vitest run src/api
    note: null
  - id: T-008.6
    title: Full verification
    status: todo
    after: [T-008.5]
    covers: []
    files: []
    verify: pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .
    note: null
---
