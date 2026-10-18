---
id: BUG-0067
type: bug
title: The build skill doesn't ask to commit Azimuth's records at the end
status: open
severity: low
likelihood: null
impact: null
links: []
files: [plugin/skills/build/SKILL.md]
found_by: SES-20261018-1839
created: 2026-10-18
resolved_at: null
---
## Repro
Run `/azimuth:build` to the end of a feature.

## Expected
Pending `.azimuth/` changes (task moves, logs, the session) are committed, as the protocol asks.

## Actual
Step 7 only says hand off, close and report; one orchestrator left feature.md, log.md and plan.md uncommitted, another committed them.

Found in the two-feature subagent rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
