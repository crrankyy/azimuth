---
id: BUG-0005
type: bug
title: Decisions note field is too narrow to read at 1280px
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/screens/decisions/decisions.css]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open a proposed ADR in `#/decisions` at 1280px wide.
2. Type a note in the "Your call" field.

## Expected
The note field is wide enough to read what you type at every supported width (1280–1920).

## Actual
The field is 63px wide at 1280 (149px at 1366): the placeholder shows only "Option" and a typed note can't be read. The `@media (max-width: 1279px)` stacking rule stops one pixel short of 1280.
