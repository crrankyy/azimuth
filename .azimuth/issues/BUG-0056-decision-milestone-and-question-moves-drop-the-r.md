---
id: BUG-0056
type: bug
title: Decision, milestone and question moves drop the reason given
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/core/transitions.ts, src/server/actions.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
`azimuth move ADR-NNNN deprecated --reason "…"`, `azimuth move M-NN active --reason "…"`, or
`azimuth move Q-NNNN obsolete --reason "…"`; or revert an agent-accepted ADR in the viewer.

## Expected
The reason is kept, as it is for features, tasks and issues since BUG-0026.

## Actual
It is accepted and discarded. The viewer's revert action for decisions doesn't send a reason at all.
Found while fixing BUG-0026, which the user scoped to issues and tasks.
