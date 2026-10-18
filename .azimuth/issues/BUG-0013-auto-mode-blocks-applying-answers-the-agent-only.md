---
id: BUG-0013
type: bug
title: Auto mode blocks applying answers the agent only read from files
status: in-progress
severity: high
likelihood: null
impact: null
links: []
files: [src/hooks/handlers.ts, src/core/brief.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
As in BUG-0012, with `--permission-mode auto`; the agent reads the answers from `.azimuth/questions/*.md` and edits the spec to apply them.

## Expected
Your decisions reach the agent through Claude Code itself (hook context), so applying them is plainly acting on your instructions.

## Actual
Claude Code's auto-mode classifier denied the edit as "[Instruction Poisoning]"; the agent stopped and asked whether the answers were really yours. Nothing was applied.
