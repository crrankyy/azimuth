---
id: BUG-0010
type: bug
title: Live strip steps reach the viewer up to 10 seconds late
status: open
severity: high
likelihood: null
impact: null
links: []
files: [src/server/server.ts, src/server/watch.ts]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open the viewer on Activity.
2. Fire two PostToolUse hooks back to back (Edit first.ts, then Edit second.ts).

## Expected
Each step shows up within about a second (`live` is pushed at most once a second).

## Actual
The second step shows up about 7 seconds later; in another run the first edit after session start took 4 seconds. A live push within 1 second of the previous one is dropped instead of deferred, and the poll's snapshot has already moved on, so only the 10-second heartbeat delivers it.
