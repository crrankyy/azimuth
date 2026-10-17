---
id: F-005
title: Retry with exponential backoff
summary: Retry failed deliveries with exponential backoff and full jitter until they succeed or reach maxAttempts.
status: in-progress
priority: P0
size: M
mode: brownfield
milestone: M-02
depends_on: [F-003]
superseded_by: null
tags: [delivery, reliability]
created: 2026-10-02
updated: 2026-10-18
approved_at: 2026-10-09
approved_by: you
approved_hash: "{{approved_hash}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-005: Retry with exponential backoff

## Objective
Retry failed deliveries with exponential backoff and full jitter until they succeed or reach `maxAttempts`, so a receiver's temporary outage never loses events.

## Out of scope
- What happens after the last attempt: dead-lettering is F-006
- Per-endpoint rate limits (F-009)
- Manual replay (F-008)

## Integration points
- `src/worker/deliver.ts` calls `decideRetry()` after every attempt
- The `deliveries` table gains `attempt_count`, `next_attempt_at`, `state` and `lease_until`
- Emits `delivery.exhausted` on the internal event bus (consumed by F-006)

## Invariants
- At most one in-flight attempt per delivery
- Each attempt is counted exactly once, even across worker crashes
- 4xx responses are never retried, except 408 and 429
- `next_attempt_at` is never more than `maxDelayMs` in the future

## Assumptions
- Default policy: base 2 s, factor 2, max delay 1 h, 8 attempts
- `Retry-After` is honoured, capped at `maxDelayMs`
- Jitter strategy: full jitter, per ADR-0003 (from Q-0001)
