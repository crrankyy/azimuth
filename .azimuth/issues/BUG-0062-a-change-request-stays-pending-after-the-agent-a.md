---
id: BUG-0062
type: bug
title: A change request stays pending after the agent applies it
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/core/brief.ts]
found_by: SES-20261018-1745
created: 2026-10-18
resolved_at: null
---
## Repro
Request changes on a draft in the viewer; let the agent apply them and log "Applied change request: …".

## Expected
`azimuth status` and the next session's start context stop listing the request once it has been applied.

## Actual
A review counts as pending until the feature's next status change, so in draft it stays listed ("Decided by the user in the viewer, not yet applied") until you approve. A session started before then would be told to apply it again.

Found in the subagent-delegation rehearsal on 2026-10-18 (Sonnet orchestrating Haiku subagents, ~/projects/azimuth-rust-rehearsal F-002).
