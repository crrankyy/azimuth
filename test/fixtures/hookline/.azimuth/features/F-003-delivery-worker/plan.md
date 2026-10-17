---
tasks:
  - id: T-003.1
    title: Deliveries schema & store queries
    status: done
    after: []
    covers: []
    files: [src/store/migrations/002_deliveries.sql, src/store/deliveries.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-003.2
    title: Event ingestion (red → green)
    status: done
    after: [T-003.1]
    covers: [S-003.1.1, S-003.1.2, S-003.1.3]
    files: [src/api/events.ts, src/api/server.ts, src/api/events.test.ts]
    verify: pnpm vitest run src/api/events.test.ts
    note: null
  - id: T-003.3
    title: Leasing (red → green)
    status: done
    after: [T-003.1]
    covers: [S-003.2.2]
    files: [src/worker/lease.ts, src/worker/lease.test.ts]
    verify: pnpm vitest run src/worker/lease.test.ts
    note: null
  - id: T-003.4
    title: Signed sending with a timeout (red → green)
    status: done
    after: [T-003.3]
    covers: [S-003.2.3]
    files: [src/worker/deliver.ts, src/worker/deliver.test.ts]
    verify: pnpm vitest run src/worker/deliver.test.ts
    note: null
  - id: T-003.5
    title: Outcome recording (red → green)
    status: done
    after: [T-003.4]
    covers: [S-003.3.1, S-003.3.2, S-003.3.3]
    files: [src/worker/deliver.ts, src/store/deliveries.ts, src/worker/deliver.test.ts]
    verify: pnpm vitest run src/worker/deliver.test.ts
    note: null
  - id: T-003.6
    title: Worker loop & event bus
    status: done
    after: [T-003.5]
    covers: []
    files: [src/worker/loop.ts, src/worker/events.ts]
    verify: pnpm tsc --noEmit && pnpm vitest run src/worker
    note: null
  - id: T-003.7
    title: End-to-end delivery (red → green)
    status: done
    after: [T-003.2, T-003.6]
    covers: [S-003.2.1]
    files: [test/worker.e2e.test.ts]
    verify: pnpm vitest run test/worker.e2e.test.ts
    note: null
---
