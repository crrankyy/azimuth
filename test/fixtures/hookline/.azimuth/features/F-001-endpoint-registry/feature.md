---
id: F-001
title: Endpoint registry
summary: Register, update and remove subscriber endpoints with their secrets and event filters.
status: done
priority: P0
size: S
mode: greenfield
milestone: M-01
depends_on: []
superseded_by: null
tags: [api]
created: 2026-09-02
updated: 2026-09-10
approved_at: 2026-09-03
approved_by: you
approved_hash: "{{approved_hash}}"
approved_commit: null
review_ack_at: null
overrides: []
---
# F-001: Endpoint registry

## Objective
Let operators register, update and remove subscriber endpoints, each with a signing secret and an event filter, so the worker knows where to deliver each event.

## Out of scope
- Signing payloads with the secret (F-002)
- Scoping endpoints to tenants

## Integration points
- `POST /endpoints`, `PATCH /endpoints/:id` and `DELETE /endpoints/:id` in `src/api/endpoints.ts`
- The `endpoints` table, created by `src/store/migrations/001_endpoints.sql`

## Invariants
- A secret is returned once, when the endpoint is created, and never again
- An endpoint URL is absolute and uses http or https

## Assumptions
- Secrets are 32 random bytes, base64url-encoded
- An event filter lists exact event types; `*` matches every type
