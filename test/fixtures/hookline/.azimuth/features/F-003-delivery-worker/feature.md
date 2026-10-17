---
id: F-003
title: Delivery worker
summary: Lease due deliveries, sign and send them, and record the outcome.
status: done
priority: P0
size: M
mode: greenfield
milestone: M-01
depends_on: [F-001, F-002]
superseded_by: null
tags: [delivery]
created: 2026-09-08
updated: 2026-09-27
approved_at: 2026-09-10
approved_by: you
approved_hash: "{{approved_hash}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-003: Delivery worker

## Objective
Accept events over HTTP, turn each one into a delivery per matching endpoint, and run a worker that leases due deliveries, signs and sends them, and records the outcome.

## Out of scope
- Retrying failed deliveries; a failed delivery stays failed for now
- Per-endpoint rate limits

## Integration points
- `POST /events` in `src/api/events.ts`
- The `events` and `deliveries` tables, created by `src/store/migrations/002_deliveries.sql`
- `sign()` from `src/signing/hmac.ts` (F-002)

## Invariants
- A delivery is leased by at most one worker at a time
- The worker never holds a transaction open during an HTTP request
- The HTTP timeout is 15 s

## Assumptions
- One worker loop per process, polling every 500 ms
- Deliveries are leased in batches of 10
