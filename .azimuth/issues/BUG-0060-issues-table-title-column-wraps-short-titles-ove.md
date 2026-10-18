---
id: BUG-0060
type: bug
title: Issues table title column wraps short titles over several lines
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/issues/IssueTable.tsx, viewer/src/screens/issues/issues.css]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open Issues at 1440px wide with an issue titled "Undo history grows without bound".

## Expected
The title fits on one or two lines; the table gives Title most of the width.

## Actual
The Title column is about 60px wide, so the title wraps over five lines while other columns have space.

Found in the Rust rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
