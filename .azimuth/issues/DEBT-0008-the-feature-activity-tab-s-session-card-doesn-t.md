---
id: DEBT-0008
type: debt
title: The feature Activity tab's session card doesn't show goals and notes
status: open
severity: low
likelihood: null
impact: null
links: [F-011]
files: [viewer/src/screens/feature/ActivityTab.tsx]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
`viewer/src/screens/feature/ActivityTab.tsx` renders its own session card, which doesn't show the
Goals and Notes sections F-011 added to `components/SessionCard.tsx`; docs/viewer.md says an
expanded session card lists them.

## Proposed fix
Reuse `components/SessionCard` in the feature's Activity tab, or render the two sections there.
