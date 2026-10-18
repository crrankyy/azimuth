---
id: BUG-0032
type: bug
title: Unknown ADR and run IDs in the URL show the wrong page
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Decisions.tsx, viewer/src/screens/Verification.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open `#/decisions/ADR-0099` and `#/verification/R-9999` in a project without them.

## Expected
A 'not found' state naming the ID.

## Actual
The decisions route shows another ADR; the verification route shows no 'not found'.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
