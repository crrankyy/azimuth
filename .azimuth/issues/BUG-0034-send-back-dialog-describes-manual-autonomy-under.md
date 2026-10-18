---
id: BUG-0034
type: bug
title: Send-back dialog describes manual autonomy under auto
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/ActionDialogs.tsx, viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
With `approve_specs: auto`, send back an auto-approved spec.

## Expected
The dialog describes what happens under auto: the agent revises the spec and may approve it again itself.

## Actual
It says the spec 'comes back to your inbox' and that 'agents stop building', which isn't what happens under auto.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
