---
tasks:
  - id: T-009.1
    title: Token bucket (red → green)
    status: todo
    after: []
    covers: [S-009.2.1, S-009.2.3]
    files: [src/worker/rate-limit.ts, src/worker/rate-limit.test.ts]
    verify: pnpm vitest run src/worker/rate-limit.test.ts
    note: null
  - id: T-009.2
    title: Endpoint rate-limit setting (red → green)
    status: todo
    after: []
    covers: [S-009.1.1, S-009.1.2]
    files: [src/store/migrations/006_rate_limits.sql, src/store/endpoints.ts, src/api/endpoints.ts, src/api/endpoints.rate-limit.test.ts]
    verify: pnpm vitest run src/api/endpoints.rate-limit.test.ts
    note: null
  - id: T-009.3
    title: Limit-aware leasing (red → green)
    status: todo
    after: [T-009.1, T-009.2]
    covers: [S-009.2.2, S-009.3.1, S-009.3.2]
    files: [src/worker/lease.ts, src/worker/lease.rate-limit.test.ts]
    verify: pnpm vitest run src/worker/lease.rate-limit.test.ts
    note: null
  - id: T-009.4
    title: Share the limiter across polls
    status: todo
    after: [T-009.3]
    covers: []
    files: [src/worker/loop.ts]
    verify: pnpm vitest run src/worker
    note: null
  - id: T-009.5
    title: Full verification
    status: todo
    after: [T-009.4]
    covers: []
    files: []
    verify: pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .
    note: null
---
