---
files:
  - path: src/store/migrations/002_deliveries.sql
    change: create
    note: events and deliveries tables
  - path: src/store/deliveries.ts
    change: create
    note: insertDeliveries(), claimDue(), recordOutcome()
  - path: src/api/events.ts
    change: create
    note: POST /events
  - path: src/api/server.ts
    change: modify
    note: Register the events route
  - path: src/worker/lease.ts
    change: create
    note: "leaseDue(): claim a batch of due deliveries"
  - path: src/worker/deliver.ts
    change: create
    note: Sign, send and record one delivery
  - path: src/worker/loop.ts
    change: create
    note: Poll loop
  - path: src/worker/events.ts
    change: create
    note: In-process event bus
  - path: src/signing/hmac.ts
    change: read
    note: sign()
  - path: src/api/events.test.ts
    change: test
    note: Ingestion scenarios
  - path: src/worker/lease.test.ts
    change: test
    note: Leasing scenarios
  - path: src/worker/deliver.test.ts
    change: test
    note: Sending and outcome scenarios
  - path: test/worker.e2e.test.ts
    change: test
    note: End-to-end delivery against a fake receiver
---
