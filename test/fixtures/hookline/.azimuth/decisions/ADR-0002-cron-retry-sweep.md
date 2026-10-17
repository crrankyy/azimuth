---
id: ADR-0002
title: Retry failed deliveries with a periodic cron sweep
status: superseded
date: 2026-09-29
supersedes: null
superseded_by: ADR-0003
resolves: []
links: [F-004]
decided_by: you
decided_at: 2026-09-29T10:00:00Z
review_ack_at: null
---
# ADR-0002: Retry failed deliveries with a periodic cron sweep

## Context
Failed deliveries need to be retried.

## Options
- Sweep failed deliveries every 30 s
- Schedule each delivery individually

## Decision
Sweep failed deliveries every 30 seconds and retry them.

## Consequences
- Retries bunch up at sweep boundaries.
- Simple to build.
