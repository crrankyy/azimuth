---
id: BUG-0046
type: bug
title: Command palette gaps
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/components/CommandPalette.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open ⌘K; type a task, run, story or scenario ID; move the selection down a long list.

## Expected
Every ID kind can be jumped to; the selection stays in view; each group header appears once.

## Actual
Task, run, story and scenario IDs can't be jumped to; the selection scrolls out of view; a group header repeats.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
