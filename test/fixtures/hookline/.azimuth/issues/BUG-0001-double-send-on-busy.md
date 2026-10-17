---
id: BUG-0001
type: bug
title: Worker can double-send when SQLite returns SQLITE_BUSY after the request
status: open
severity: high
likelihood: null
impact: null
links: [F-003, F-005]
files: [src/worker/deliver.ts]
found_by: you
created: 2026-10-14
resolved_at: null
---
## Repro
1. Run two workers against one database.
2. Hold a write lock for 6 s during an attempt.

## Expected
The attempt is recorded once and not sent again.

## Actual
The outcome write fails with SQLITE_BUSY, the lease expires, and the second worker sends the delivery again.
