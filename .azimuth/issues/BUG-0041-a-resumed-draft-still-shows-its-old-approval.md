---
id: BUG-0041
type: bug
title: A resumed draft still shows its old approval
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/transitions.ts, viewer/src/screens/feature/FeatureHeader.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Approve a feature, defer it, then resume it to draft.

## Expected
The draft shows no approval.

## Actual
It keeps its approval fields, and the header says 'Approved Oct 18'.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
