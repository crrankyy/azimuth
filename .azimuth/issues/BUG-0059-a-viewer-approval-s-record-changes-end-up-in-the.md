---
id: BUG-0059
type: bug
title: A viewer approval's record changes end up in the agent's feature commit
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/hooks/handlers.ts, src/core/brief.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Approve a draft in the viewer, then resume the agent.

## Expected
The agent commits the approval as `chore(azimuth): record decisions`, as the protocol asks; the start context says which records are uncommitted.

## Actual
feature.md and log.md stay uncommitted; the start context says only "(uncommitted changes)", and the agent included them in its `feat(F-001): scaffold …` commit.

Found in the Rust rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
