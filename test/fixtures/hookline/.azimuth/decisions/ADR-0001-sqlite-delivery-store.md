---
id: ADR-0001
title: SQLite (better-sqlite3) as the delivery store
status: accepted
date: 2026-09-02
supersedes: null
superseded_by: null
resolves: []
links: [F-003]
decided_by: you
decided_at: 2026-09-02T10:00:00Z
review_ack_at: null
---
# ADR-0001: SQLite (better-sqlite3) as the delivery store

## Context
Hookline must run as one process on a small host, with durable queues and no external services.

## Options
- **SQLite (better-sqlite3)**: no ops, synchronous API, one writer at a time.
- **Postgres**: concurrent writers, but another service to run.
- **Redis streams**: fast, but durability depends on configuration.

## Decision
Use SQLite in WAL mode through better-sqlite3. All SQL lives in `src/store`.

## Consequences
- Single-writer throughput is a ceiling (see RISK-0001).
- A backup is a file copy.
