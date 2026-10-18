---
id: BUG-0042
type: bug
title: "Verification: the selected run is often off-screen"
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Verification.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open `#/verification/R-NNNN` for a run far down the list.

## Expected
The selected run scrolls into view.

## Actual
The page scrolls to the top on hashchange, and the run is off-screen.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
