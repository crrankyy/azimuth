---
id: BUG-0033
type: bug
title: Overview recent activity links commit SHAs to the Inbox
status: open
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/overview/activity.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
On Overview, click a commit SHA in recent activity.

## Expected
It opens the commit's context (Activity or the referenced item).

## Actual
It opens the Inbox.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
