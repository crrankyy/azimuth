---
id: F-007
title: Delivery attempt log
summary: Record every delivery attempt and expose the history at GET /deliveries/:id/attempts.
status: verifying
priority: P1
size: M
mode: brownfield
milestone: M-02
depends_on: [F-003]
superseded_by: null
tags: [observability]
created: 2026-10-03
updated: 2026-10-17
approved_at: 2026-10-06
approved_by: you
approved_hash: "{{approved_hash}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-007: Delivery attempt log

## Objective
Record every HTTP attempt a worker makes and expose a delivery's attempt history at `GET /deliveries/:id/attempts`, so operators can debug receivers without database access.

## Out of scope
- Aggregated metrics
- Retention and pruning of old attempts

## Integration points
- `src/worker/deliver.ts` inserts an attempt row after every request
- New `attempts` table, created by `src/store/migrations/003_attempts.sql`
- New route registered in `src/api/server.ts`

## Invariants
- Exactly one attempt row per HTTP request
- Recording an attempt never fails the delivery itself

## Assumptions
- Response bodies are truncated to 2048 bytes
- Attempts are returned oldest first, without pagination
