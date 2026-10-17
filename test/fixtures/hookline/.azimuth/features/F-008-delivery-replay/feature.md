---
id: F-008
title: Delivery replay API
summary: Re-send any past delivery on demand through POST /deliveries/:id/replay.
status: draft
priority: P1
size: M
mode: brownfield
milestone: M-03
depends_on: [F-006, F-007]
superseded_by: null
tags: [api]
created: 2026-10-14
updated: 2026-10-18
approved_at: null
approved_by: null
approved_hash: null
approved_commit: null
review_ack_at: null
overrides: []
---
# F-008: Delivery replay API

## Objective
Let operators re-send any past delivery, or every dead letter of an endpoint, so events a receiver lost can be recovered.

## Out of scope
- Editing a payload before replaying it
- Scheduled or automatic replays

## Integration points
- `POST /deliveries/:id/replay` and `POST /endpoints/:id/dead-letters/replay` in `src/api/replay.ts`, registered in `src/api/server.ts`
- Copies the delivery row through `src/store/deliveries.ts`, with `replay_of` pointing at the original
- Signs with `sign()` from `src/signing/hmac.ts`

## Invariants
- A replay never changes the original delivery or its attempts
- A replay is a new delivery with its own attempts

## Assumptions
- A bulk replay sends at most 1000 deliveries per request
- Which secret signs a replay depends on Q-0003
