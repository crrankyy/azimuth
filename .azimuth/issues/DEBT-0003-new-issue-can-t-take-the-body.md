---
id: DEBT-0003
type: debt
title: "`new issue` can't take the body"
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/cli/commands/write.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Problem
Agents create an issue, then hand-edit its Repro, Expected and Actual sections, an extra edit and `check` per issue.

## Proposed fix
Accept the sections as options (`--repro`, `--expected`, `--actual`, or `--body-file`).
