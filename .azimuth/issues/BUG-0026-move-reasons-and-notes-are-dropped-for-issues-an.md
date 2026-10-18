---
id: BUG-0026
type: bug
title: Move reasons and notes are dropped for issues and some task moves
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/transitions.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
`azimuth move BUG-NNNN wontfix --reason "duplicate"`, or reopen a resolved issue with `--reason`; move a task with `--reason` or `--note` where the note isn't a blocked/skipped note.

## Expected
The reason is saved in the item's log entry for the move, as it is for features.

## Actual
The reason is accepted and silently discarded. Reopening three bugs earlier needed the reasons added to their bodies by hand.

Decided by the user on 2026-10-18. Fix it.
