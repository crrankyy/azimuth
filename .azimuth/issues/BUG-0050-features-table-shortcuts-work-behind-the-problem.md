---
id: BUG-0050
type: bug
title: Features table shortcuts work behind the Problems panel
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/features/FeatureTable.tsx, viewer/src/components/ProblemsPanel.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open the Problems panel over the Features table; press `p` or `m`.

## Expected
Keys go to the open panel.

## Actual
`p` and `m` act on the table behind it.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
