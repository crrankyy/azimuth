---
id: BUG-0047
type: bug
title: Knowledge layout at 1024px
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Knowledge.tsx, viewer/src/components/ModuleMap.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open Knowledge at 1024px wide.

## Expected
The glossary moves under the article, and the module map fits.

## Actual
The glossary stays beside the article, and the module map needs a horizontal scroll.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
