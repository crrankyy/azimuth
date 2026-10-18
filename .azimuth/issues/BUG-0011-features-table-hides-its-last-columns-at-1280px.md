---
id: BUG-0011
type: bug
title: Features table hides its last columns at 1280px
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/screens/features/FeatureTable.tsx, viewer/src/screens/features/features.css]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open `#/features` at 1280×900.
2. Set Group to Status (adds the Milestone column).

## Expected
Every column is visible at 1280px, the narrowest width that must look right.

## Actual
"Last activity" is clipped, and with Group = Status it is hidden entirely: the table is 1032–1104px wide in a 983px container, reachable only through a horizontal scroll whose scrollbar macOS hides.
