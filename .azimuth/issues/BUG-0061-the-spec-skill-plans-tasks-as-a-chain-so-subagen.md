---
id: BUG-0061
type: bug
title: The spec skill plans tasks as a chain, so subagents can't work in parallel
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [plugin/skills/spec/SKILL.md]
found_by: SES-20261018-1745
created: 2026-10-18
resolved_at: null
---
## Repro
Run `/azimuth:spec` on a feature that splits naturally (four Markdown block kinds).

## Expected
Where the work splits, the plan gives each part its own files and a task that depends only on the shared scaffolding, so an orchestrator can hand them to subagents at once.

## Actual
The plan chained every task after the previous one and put all four kinds in `src/markdown/mod.rs`, so the build skill's delegation rule allowed no parallel work. It took a change request from the user to get four independent tasks.

Found in the subagent-delegation rehearsal on 2026-10-18 (Sonnet orchestrating Haiku subagents, ~/projects/azimuth-rust-rehearsal F-002).
