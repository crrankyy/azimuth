---
id: BUG-0008
type: bug
title: Task graph hides tasks past the column width with no scroll cue
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/components/taskdag.css, viewer/src/components/TaskDag.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open `#/features/F-006/plan` at 1440×900 (or F-005 at 1280).

## Expected
Every task in the plan is visible, or it is obvious that the graph continues.

## Actual
T-006.5 is entirely outside the canvas (node right edge at 1236px, canvas ends at 1053px) and T-005.6 is cut off at 1280. The canvas scrolls horizontally, but macOS overlay scrollbars stay hidden, so nothing says a task is missing.
