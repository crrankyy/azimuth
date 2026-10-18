---
id: BUG-0051
type: bug
title: Resolving the first issue with no ID in the route shows another issue
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Issues.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open `#/issues` with no issue selected, so the first issue shows; resolve it.

## Expected
The resolved issue stays shown.

## Actual
The detail swaps to another issue.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
