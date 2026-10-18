---
id: BUG-0044
type: bug
title: State diagram labels are truncated despite free space
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/components/StateDiagram.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open a state diagram whose labels are longer than a word.

## Expected
Labels show in full when there is room.

## Actual
Labels are cut off with free space around them.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
