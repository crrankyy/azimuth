---
completed_at: 2026-09-27
files_changed:
  - path: src/store/migrations/002_deliveries.sql
    change: create
  - path: src/store/deliveries.ts
    change: create
  - path: src/api/events.ts
    change: create
  - path: src/api/server.ts
    change: modify
  - path: src/worker/lease.ts
    change: create
  - path: src/worker/deliver.ts
    change: create
  - path: src/worker/loop.ts
    change: create
  - path: src/worker/events.ts
    change: create
deviations: []
follow_ups: []
---
# F-003: As built

## Summary
Events are accepted at `POST /events` and fanned out to matching endpoints. The worker leases due deliveries, signs and sends them, and records the outcome. Failed deliveries are not retried yet.

## Deviations
None.

## Follow-ups
None.
