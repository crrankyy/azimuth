---
id: BUG-0009
type: bug
title: Pressing g then a on the Inbox acknowledges the selected item
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/lib/keys.ts, viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Have a review-auto item in the Inbox (e.g. `accept_adrs: auto`, agent runs `azimuth move ADR-0004 accepted`).
2. On `#/inbox`, press j until that row is selected.
3. Press `g`, then `a` (go to Activity).

## Expected
The page goes to Activity and nothing is written.

## Actual
The page goes to Activity, a toast says "Acknowledged ADR-0004" and `review_ack_at` is written. The list keys treat `a` as the primary action without checking for a pending `g`. The same root cause makes `g k` on the Plan tab move the task selection instead of opening Knowledge, and a plain `a` that opens the inline answer types a stray "a" into it.
