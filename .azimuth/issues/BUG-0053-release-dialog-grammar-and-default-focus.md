---
id: BUG-0053
type: bug
title: Release dialog grammar and default focus
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Roadmap.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open the release dialog for a milestone with one feature.

## Expected
'The 1 feature is done', and focus starts on Cancel so Enter doesn't release.

## Actual
'All 1 feature are done', and focus starts on the release button.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
