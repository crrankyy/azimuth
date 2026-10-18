---
id: BUG-0006
type: bug
title: Feature dialogs apply an action to a status you never saw
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/ActionDialogs.tsx, viewer/src/screens/feature/Lifecycle.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open `#/features/F-009` (approved), click Defer and type a reason.
2. In a shell: `AZIMUTH_ACTOR=agent azimuth move F-009 in-progress`.
3. Click "Defer feature". (Same with Cancel on a draft that you approve from the CLI meanwhile.)

## Expected
Refused, as `docs/viewer.md` promises: the viewer sends the status you saw, and the action is refused if it changed in the meantime.

## Actual
Applied: the toast says "F-009: in-progress → deferred" and the log records the move. The dialogs read the live feature and send its status at click time, not the status when you opened them (ReasonDialog, Approve, Re-approve, Resume).
