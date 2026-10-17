---
id: F-006
title: Dead-letter queue
summary: Move exhausted deliveries to a dead-letter queue with their full attempt history.
status: approved
priority: P1
size: M
mode: brownfield
milestone: M-02
depends_on: [F-005]
superseded_by: null
tags: [reliability]
created: 2026-10-05
updated: 2026-10-16
approved_at: 2026-10-11
approved_by: you
approved_hash: "{{approved_hash:pre}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-006: Dead-letter queue

## Objective
Move deliveries that run out of retries to a dead-letter queue, keeping the payload and the reason they failed, so no event is silently lost.

## Out of scope
- Replaying dead letters
- Alerting when a delivery is dead-lettered

## Integration points
- Subscribes to `delivery.exhausted`, which F-005 emits
- New `dead_letters` table, created by `src/store/migrations/005_dead_letters.sql`
- Emits `delivery.dead_lettered` on the internal event bus

## Invariants
- At most one dead letter per delivery
- The stored payload is byte-identical to the payload that was sent

## Assumptions
- Dead letters are kept until an operator deletes or replays them
