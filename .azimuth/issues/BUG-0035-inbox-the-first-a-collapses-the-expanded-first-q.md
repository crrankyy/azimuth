---
id: BUG-0035
type: bug
title: "Inbox: the first `a` collapses the expanded first question"
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open the Inbox with a question first in the list; press `a`.

## Expected
`a` acts on the selected item as on every other item.

## Actual
The first question starts expanded, so the first `a` collapses it instead.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
