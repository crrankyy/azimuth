---
files:
  - path: src/store/db.ts
    change: create
    note: openDb() and withTx()
  - path: src/store/migrations/001_endpoints.sql
    change: create
    note: endpoints table
  - path: src/store/endpoints.ts
    change: create
    note: Endpoint queries
  - path: src/api/server.ts
    change: create
    note: Fastify app and route registration
  - path: src/api/endpoints.ts
    change: create
    note: POST, PATCH and DELETE /endpoints
  - path: src/api/endpoints.test.ts
    change: test
    note: Registration, update and removal scenarios
---
