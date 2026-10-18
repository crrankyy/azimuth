---
id: BUG-0037
type: bug
title: Send-back and conflict toasts show raw or wrong wording
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/ActionDialogs.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Send a spec back; separately, trigger a stale-rev conflict.

## Expected
Plain wording, and a conflict toast that says what to do in the viewer.

## Actual
The send-back toast is the raw server message; the conflict toast says 'Reload'.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
