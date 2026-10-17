---
updated: 2026-09-27
reconciled_at: null
modules:
  - name: api
    path: src/api
    responsibility: HTTP ingestion and management endpoints
    depends_on: [store, config]
  - name: store
    path: src/store
    responsibility: SQLite schema, migrations and queries
    depends_on: []
  - name: signing
    path: src/signing
    responsibility: HMAC-SHA256 payload signatures
    depends_on: []
  - name: worker
    path: src/worker
    responsibility: Lease due deliveries, send them, record attempts
    depends_on: [store, signing, config]
  - name: config
    path: src/config
    responsibility: Load and validate configuration
    depends_on: []
---
# Architecture

## Overview
A Fastify API writes events and deliveries to SQLite. A worker loop leases due deliveries, signs and sends them, and records the outcome.

## Boundaries & invariants
- Only `store` runs SQL.
- The worker never holds a transaction open during an HTTP request.
- Payload bytes are signed exactly as they are sent.
