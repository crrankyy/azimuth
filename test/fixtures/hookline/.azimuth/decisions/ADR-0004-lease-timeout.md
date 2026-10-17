---
id: ADR-0004
title: 30-second lease for in-flight attempts
status: proposed
date: 2026-10-18
supersedes: null
superseded_by: null
resolves: []
links: [F-005, T-005.5]
decided_by: null
decided_at: null
review_ack_at: null
---
# ADR-0004: 30-second lease for in-flight attempts

## Context
T-005.5 needs a lease so a crashed worker's delivery gets picked up again. Too short and slow receivers get sent the same delivery twice; too long and recovery is slow. The HTTP timeout is 15 s.

## Options
- **10 s**: fast recovery, but double-sends whenever a receiver takes more than 10 s
- **30 s**: double the HTTP timeout; recovery within 30 s
- **120 s**: safest against double-sends; slow recovery

## Decision
Use a 30 s lease that is never renewed, because an attempt can't outlive the 15 s HTTP timeout.

## Consequences
- A crashed worker delays its deliveries by up to 30 s.
- The HTTP timeout must stay below the lease; config validation enforces it.
