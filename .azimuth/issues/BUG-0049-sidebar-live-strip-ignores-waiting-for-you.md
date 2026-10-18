---
id: BUG-0049
type: bug
title: Sidebar live strip ignores 'Waiting for you'
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/activity/LiveStrip.tsx, viewer/src/components/AppShell.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Have an agent session wait on a blocking question; look at the sidebar; collapse the sidebar.

## Expected
The live strip shows the session is waiting for you, also when collapsed.

## Actual
It ignores the waiting state, and the collapsed sidebar drops status information.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
