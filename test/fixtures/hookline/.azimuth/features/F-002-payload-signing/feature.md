---
id: F-002
title: Payload signing
summary: Sign every payload with HMAC-SHA256 using the endpoint secret, with a timestamp that stops replays.
status: done
priority: P0
size: S
mode: greenfield
milestone: M-01
depends_on: [F-001]
superseded_by: null
tags: [security]
created: 2026-09-05
updated: 2026-09-16
approved_at: 2026-09-06
approved_by: you
approved_hash: "{{approved_hash}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-002: Payload signing

## Objective
Sign every payload with HMAC-SHA256 using the endpoint's secret, together with a timestamp, so receivers can check where a request came from and reject replays.

## Out of scope
- Rotating secrets
- Verifying signatures for receivers beyond the exported `verify()` helper

## Integration points
- The worker calls `sign()` just before it sends a delivery
- Receivers read the `Hookline-Signature` header: `t=<unix seconds>,v1=<hex>`

## Invariants
- The signature covers the exact bytes that are sent
- Signatures are compared in constant time

## Assumptions
- The timestamp tolerance defaults to 300 s
