---
id: BUG-0023
type: bug
title: Live steps show absolute paths, including the plugin's skill files
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/hooks/handlers.ts, plugin/skills/ship/SKILL.md]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
Run `/azimuth:ship` (it reads other skills' SKILL.md files) and watch the Inbox or the Live strip.

## Expected
Steps show paths relative to the project, and nothing about the machine's folders.

## Actual
"An agent is working on F-001: cat /Users/…/plugin/skills/azimuth/SKILL.md"; live summaries keep absolute paths.
