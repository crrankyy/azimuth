---
id: BUG-0055
type: bug
title: The 'As-built' tab label wraps at 1024px
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/FeatureDetail.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open a feature at 1024px wide.

## Expected
Tab labels stay on one line.

## Actual
'As-built' wraps onto two lines.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
