---
id: BUG-0002
type: bug
title: An agent can move your rejected ADR back to proposed, erasing your note
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/core/transitions.ts]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
1. In Decisions, reject ADR-0008 with a note.
2. As the agent: `azimuth move ADR-0008 proposed`.

## Expected
Refused, the same way moving an accepted ADR back to proposed is: only you can undo your decision.

## Actual
Exit 0. The file now has `status: proposed`, `decided_by: null`, `decision_note: null`: your rejection and note are gone. `transitions.ts` only guards the accepted → proposed move.
