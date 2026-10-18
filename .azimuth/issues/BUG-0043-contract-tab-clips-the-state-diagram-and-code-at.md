---
id: BUG-0043
type: bug
title: Contract tab clips the state diagram and code at 1280px
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/ContractTab.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open a feature's Contract tab at 1280px wide.

## Expected
The state diagram and code fit, or scroll inside their boxes.

## Actual
The state diagram is clipped; a long code line runs under the 'ts' label and Copy button.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
