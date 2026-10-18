---
id: BUG-0001
type: bug
title: "Inbox is unusable at 1024px: the side panel never moves under the list"
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/screens/inbox.css, viewer/src/screens/Inbox.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Have a review-auto item and an open question with three options in the Inbox (Hookline demo: autonomy auto, agent runs `move F-008 approved`).
2. Open `#/inbox` at 1024×900.

## Expected
As `docs/viewer.md` says: layouts stay usable down to 1024px, where side panels move under the main content.

## Actual
The 300px agent-status panel stays beside the list, which shrinks to 387px: review-auto row titles are 0px wide (invisible), each row's age label overlaps its ID chip, the inline answer's note field is 22px wide and option cards spill their tags. `inbox.css` has no breakpoint for `.inbox`/`.inbox-aside`, unlike the other screens.
