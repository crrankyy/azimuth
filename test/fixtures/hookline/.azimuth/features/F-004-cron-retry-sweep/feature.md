---
id: F-004
title: Cron retry sweep
summary: Retry failed deliveries with a periodic sweep job.
status: superseded
priority: P1
size: M
mode: brownfield
milestone: M-02
depends_on: [F-003]
superseded_by: F-005
tags: [delivery]
created: 2026-09-29
updated: 2026-10-07
approved_at: null
approved_by: null
approved_hash: null
approved_commit: null
review_ack_at: null
overrides: []
---
# F-004: Cron retry sweep

## Objective
Retry failed deliveries with a sweep job that re-queues them every 30 seconds, up to 5 retries.

## Out of scope
- Backoff between retries
- Dead-lettering deliveries that run out of retries

## Integration points
- A 30 s timer started by the worker loop in `src/worker/loop.ts`
- Reads and re-queues failed deliveries through `src/store/deliveries.ts`

## Invariants
- One sweep never re-queues a delivery twice
- 4xx responses are never retried

## Assumptions
- Sweep interval 30 s and 5 retries, per ADR-0002
