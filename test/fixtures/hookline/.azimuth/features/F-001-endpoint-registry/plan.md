---
tasks:
  - id: T-001.1
    title: Endpoints schema & store queries
    status: done
    after: []
    covers: []
    files: [src/store/db.ts, src/store/migrations/001_endpoints.sql, src/store/endpoints.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-001.2
    title: Register endpoints (red → green)
    status: done
    after: [T-001.1]
    covers: [S-001.1.1, S-001.1.2, S-001.1.3]
    files: [src/api/server.ts, src/api/endpoints.ts, src/api/endpoints.test.ts]
    verify: pnpm vitest run src/api/endpoints.test.ts
    note: null
  - id: T-001.3
    title: Update and remove endpoints (red → green)
    status: done
    after: [T-001.2]
    covers: [S-001.2.1, S-001.2.2, S-001.2.3]
    files: [src/api/endpoints.ts, src/store/endpoints.ts, src/api/endpoints.test.ts]
    verify: pnpm vitest run src/api/endpoints.test.ts
    note: null
---
