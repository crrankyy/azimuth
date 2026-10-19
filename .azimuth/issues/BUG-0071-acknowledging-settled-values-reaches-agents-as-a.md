---
id: BUG-0071
type: bug
title: Acknowledging settled values reaches agents as acknowledging the automatic approval
status: open
severity: low
likelihood: null
impact: null
links: [F-008]
files: [src/core/delta.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
1. An agent approves F-001's spec automatically and you acknowledge it.
2. An agent settles a placeholder in F-001, and you acknowledge F-001 again.

## Expected
The prompt delta says you acknowledged the values settled in F-001.

## Actual
`userEventsSince` (`src/core/delta.ts`) words it "acknowledged the automatic approval of F-001",
because an agent-approved feature always gets that wording (F-008's contract specifies it).
