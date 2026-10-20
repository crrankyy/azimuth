---
id: BUG-0078
type: bug
title: Timeline action labels clip at 1024 px and late in each quarter hour
status: open
severity: low
likelihood: null
impact: null
links: [F-016]
files: [viewer/src/screens/activity/timeline.ts]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: null
---
## Repro
Open Activity at 1024 px wide, or at 1440 px in the last minutes before a quarter hour, while
sessions are running.

## Expected
Each running row's action ("Edit policy.ts") is readable after its span.

## Actual
The "Last 75 min" window ends at the next quarter hour, so near that point the now line sits
around 95% and leaves about 30 px for the label ("Ed…"); at 1024 px every running row's label was
cut (scratchpad shots/F-016/polish-report.json). Ending the window at least ten minutes after now,
or putting the label left of the span when there is no room, would fix it; the window rule is the
user's call.

## Decision

Decided by the user on 2026-10-20: the "Last 75 min" window ends at the first quarter hour at
least 10 minutes after now, and a label that still doesn't fit after its span (narrow screens)
is drawn left of the now line instead of being cut.
