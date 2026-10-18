---
id: BUG-0036
type: bug
title: Inbox ages are wrong for validation errors and ADRs
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Inbox.tsx, src/core/inbox.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Leave validation errors in the project and watch the Inbox across rebuilds; look at an ADR raised without a session.

## Expected
Ages count from when the problem appeared and from the ADR's real time.

## Actual
The 'N validation errors' age resets on every rebuild; ADRs without a session date from midnight.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
