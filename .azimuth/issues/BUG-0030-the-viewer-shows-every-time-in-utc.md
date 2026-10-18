---
id: BUG-0030
type: bug
title: The viewer shows every time in UTC
status: resolved
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/lib/format.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
Open any screen with times (Activity, Inbox, a feature's log) on a machine outside UTC.

## Expected
Times in the machine's time zone.

## Actual
Times in UTC.

Decided by the user on 2026-10-18. Show local time; files keep storing UTC.

## Status notes
- 2026-10-18T16:35:49Z · agent · in-progress → resolved: Fixed in f281fb3; checked in the viewer
