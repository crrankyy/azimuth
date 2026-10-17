---
id: ADR-0003
title: Per-delivery next_attempt_at with full-jitter exponential backoff
status: accepted
date: 2026-10-07
supersedes: ADR-0002
superseded_by: null
resolves: [Q-0001]
links: [F-005, F-004]
decided_by: you
decided_at: 2026-10-07T12:35:00Z
review_ack_at: null
---
# ADR-0003: Per-delivery next_attempt_at with full-jitter exponential backoff

## Context
A sweep sends retries in bursts and can't honour `Retry-After`. Q-0001 settled on full jitter.

## Options
- **Keep the sweep** (ADR-0002)
- **Per-delivery `next_attempt_at`, full jitter**: spreads load and honours `Retry-After`
- **Per-delivery, no jitter**: predictable, but receivers get thundering herds after an outage

## Decision
Each delivery stores `next_attempt_at`. delay = random(0, min(maxDelay, base · factorⁿ⁻¹)). `Retry-After` overrides it, capped at maxDelay.

## Consequences
- F-004 is superseded by F-005.
- Tests need a seedable random source.
