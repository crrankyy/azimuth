---
id: BUG-0031
type: bug
title: Inbox 'Open run' opens the wrong run
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
In the Inbox, select a failing-run item for one task while another task has a newer failing run; click Open run.

## Expected
The run the item names opens.

## Actual
The newest failing run of any task opens.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
