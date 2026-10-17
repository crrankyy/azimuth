---
files:
  - path: src/store/migrations/003_attempts.sql
    change: create
    note: attempts table
  - path: src/store/attempts.ts
    change: create
    note: AttemptRecord, insertAttempt(), listAttempts()
  - path: src/worker/deliver.ts
    change: modify
    note: Insert an attempt row after every request
  - path: src/api/attempts.ts
    change: create
    note: GET /deliveries/:id/attempts
  - path: src/api/attempts.schema.ts
    change: create
    note: Response schema
  - path: src/api/server.ts
    change: modify
    note: Register the attempts route
  - path: src/store/db.ts
    change: read
    note: withTx() transaction helper
  - path: src/store/attempts.test.ts
    change: test
    note: Storage scenarios
  - path: src/worker/record-attempt.test.ts
    change: test
    note: Recording scenarios
  - path: src/api/attempts.test.ts
    change: test
    note: Endpoint scenarios
---
