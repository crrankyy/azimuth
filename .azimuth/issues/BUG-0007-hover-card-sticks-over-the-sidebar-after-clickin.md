---
id: BUG-0007
type: bug
title: Hover card sticks over the sidebar after clicking an ID chip
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/components/IdChip.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
1. On `#/features/F-005/context`, hover the F-006 chip, then click it.
2. Move the mouse anywhere.

## Expected
The hover card closes when its chip goes away (navigation).

## Actual
The F-006 card stays pinned at the top-left over the logo, the Inbox link and the breadcrumb, and survives later navigation until you scroll or hover another chip. The click's focus schedules a show 350ms later on a chip that is already unmounted, whose rect is all zeros.
