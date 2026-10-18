---
id: BUG-0048
type: bug
title: Roadmap dependency graph overflows at 1280px with no cue
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/roadmap/GraphView.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open Roadmap → Graph at 1280px wide.

## Expected
The graph fits, or shows that it scrolls.

## Actual
It needs a horizontal scroll with nothing showing there is more.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
