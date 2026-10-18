---
id: BUG-0052
type: bug
title: "Activity: a session link hidden by the filter shows nothing"
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Activity.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Filter Activity so a session is hidden; open that session's link.

## Expected
The session shows, or the filter says it hides it.

## Actual
Nothing shows.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
