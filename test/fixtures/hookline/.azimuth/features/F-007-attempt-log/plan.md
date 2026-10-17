---
tasks:
  - id: T-007.1
    title: Attempts table & store queries (red → green)
    status: done
    after: []
    covers: [S-007.1.3]
    files: [src/store/migrations/003_attempts.sql, src/store/attempts.ts, src/store/attempts.test.ts]
    verify: pnpm vitest run src/store/attempts.test.ts
    note: null
  - id: T-007.2
    title: Record attempts in the worker (red → green)
    status: done
    after: [T-007.1]
    covers: [S-007.1.1, S-007.1.2]
    files: [src/worker/deliver.ts, src/worker/record-attempt.test.ts]
    verify: pnpm vitest run src/worker/record-attempt.test.ts
    note: null
  - id: T-007.3
    title: GET /deliveries/:id/attempts (red → green)
    status: done
    after: [T-007.1]
    covers: [S-007.2.1, S-007.2.2]
    files: [src/api/attempts.ts, src/api/attempts.schema.ts, src/api/server.ts, src/api/attempts.test.ts]
    verify: pnpm vitest run src/api/attempts.test.ts
    note: null
  - id: T-007.4
    title: Full verification
    status: done
    after: [T-007.2, T-007.3]
    covers: []
    files: []
    verify: pnpm vitest run && pnpm eslint .
    note: null
---
