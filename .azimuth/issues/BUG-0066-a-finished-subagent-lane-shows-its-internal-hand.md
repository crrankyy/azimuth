---
id: BUG-0066
type: bug
title: A finished subagent lane shows its internal hand-back step
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/hooks/handlers.ts]
found_by: SES-20261018-1839
created: 2026-10-18
resolved_at: null
---
## Repro
Let a subagent finish; look at its lane in the live view.

## Expected
The lane shows its last real step (an edit, a command) or nothing.

## Actual
It shows `subagenthandback SubagentHandback`: Claude Code's internal hand-back tool, recorded like any other tool call.

Found in the two-feature subagent rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
