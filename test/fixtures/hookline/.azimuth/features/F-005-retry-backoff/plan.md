---
tasks:
  - id: T-005.1
    title: Types & scaffolding
    status: done
    after: []
    covers: []
    files: [src/retry/types.ts, src/retry/policy.ts, src/retry/classify.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-005.2
    title: Backoff with full jitter (red → green)
    status: done
    after: [T-005.1]
    covers: [S-005.1.1, S-005.1.3, S-005.1.4]
    files: [src/retry/policy.ts, src/retry/backoff.test.ts]
    verify: pnpm vitest run src/retry/backoff.test.ts
    note: null
  - id: T-005.3
    title: Response classification (red → green)
    status: done
    after: [T-005.1]
    covers: [S-005.1.2]
    files: [src/retry/classify.ts, src/retry/classify.test.ts]
    verify: pnpm vitest run src/retry/classify.test.ts
    note: null
  - id: T-005.4
    title: Exhaustion & policy validation (red → green)
    status: in-progress
    after: [T-005.2]
    covers: [S-005.2.1, S-005.2.2]
    files: [src/retry/policy.ts, src/config/schema.ts, src/retry/policy.test.ts]
    verify: pnpm vitest run src/retry/policy.test.ts
    note: null
  - id: T-005.5
    title: Lease-based crash safety
    status: blocked
    after: [T-005.1]
    covers: [S-005.3.1, S-005.3.2]
    files: [src/store/migrations/004_retry.sql, src/worker/deliver.ts, test/worker.crash.test.ts]
    verify: pnpm vitest run test/worker.crash.test.ts
    note: Waiting for a decision on ADR-0004 (lease timeout).
  - id: T-005.6
    title: Wire into the delivery worker & full verification
    status: todo
    after: [T-005.3, T-005.4, T-005.5]
    covers: []
    files: [src/worker/deliver.ts]
    verify: pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .
    note: null
---
