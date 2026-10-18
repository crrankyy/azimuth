---
id: BUG-0003
type: bug
title: Inbox selection jumps to another item when the list changes live
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. In the Inbox, press j until a row below other items is selected (e.g. a review-auto item at row 5).
2. From the CLI, resolve an item above it (`AZIMUTH_ACTOR=you azimuth answer Q-…`).

## Expected
The selection stays on the same item (or moves to a neighbour only if that item itself left).

## Actual
The highlight moves to whatever item now has the same row number. Pressing `a` then acts on that item; acknowledge writes immediately, so you can acknowledge something you never looked at. The selection is a row index (`useState(0)` + `Math.min`).
