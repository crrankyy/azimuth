---
id: BUG-0054
type: bug
title: Glossary terms only get a native tooltip
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/lib/markdown.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Hover a glossary term in a spec.

## Expected
A hover card with the definition, like ID chips.

## Actual
A plain browser tooltip.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
