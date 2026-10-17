---
tasks:
  - id: T-006.1
    title: Types & migration
    status: todo
    after: []
    covers: []
    files: [src/store/migrations/005_dead_letters.sql, src/store/dead-letters.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-006.2
    title: Dead-letter storage (red → green)
    status: todo
    after: [T-006.1]
    covers: [S-006.2.1, S-006.2.2, S-006.2.3]
    files: [src/store/dead-letters.ts, src/store/dead-letters.test.ts]
    verify: pnpm vitest run src/store/dead-letters.test.ts
    note: null
  - id: T-006.3
    title: Exhausted subscriber (red → green)
    status: todo
    after: [T-006.2]
    covers: [S-006.1.1, S-006.1.2]
    files: [src/worker/dead-letter.ts, src/worker/events.ts, src/worker/dead-letter.test.ts]
    verify: pnpm vitest run src/worker/dead-letter.test.ts
    note: null
  - id: T-006.4
    title: Deleted endpoints (red → green)
    status: todo
    after: [T-006.3]
    covers: [S-006.1.3]
    files: [src/worker/dead-letter.ts, src/worker/dead-letter.test.ts]
    verify: pnpm vitest run src/worker/dead-letter.test.ts
    note: null
  - id: T-006.5
    title: Full verification
    status: todo
    after: [T-006.4]
    covers: []
    files: []
    verify: pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .
    note: null
---
