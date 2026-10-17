---
id: F-009
title: Per-endpoint rate limiting
summary: Cap deliveries per endpoint per second so slow receivers aren't overwhelmed.
status: draft
priority: P2
size: M
mode: brownfield
milestone: M-03
depends_on: [F-003]
superseded_by: null
tags: [api, reliability]
created: 2026-10-12
updated: 2026-10-17
approved_at: null
approved_by: null
approved_hash: null
approved_commit: null
review_ack_at: null
overrides: []
---
# F-009: Per-endpoint rate limiting

## Objective
Cap deliveries per endpoint per second with a token bucket, so a slow receiver isn't overwhelmed by a burst.

## Out of scope
- A global rate limit across all endpoints
- Adapting the limit from 429 responses

## Integration points
- `rate_limit_per_s` column on `endpoints`, set through `PATCH /endpoints/:id`
- `src/worker/lease.ts` skips endpoints without tokens when it leases due deliveries

## Invariants
- A postponed delivery never counts as an attempt
- Endpoints without a limit are never slowed down

## Assumptions
- Buckets live in worker memory; one worker process per database
- A bucket's capacity equals its per-second limit
