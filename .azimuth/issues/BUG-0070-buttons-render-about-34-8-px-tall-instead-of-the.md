---
id: BUG-0070
type: bug
title: Buttons render about 34.8 px tall instead of the 32 px minimum
status: open
severity: low
likelihood: null
impact: null
links: [F-017]
files: [viewer/src/styles/base.css]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
Open any screen and measure a `.lc-btn` button (for example the won't-fix dialog's buttons).

## Expected
Buttons are 32 px tall, the design's `--tap-min`.

## Actual
The shared rule in `viewer/src/styles/base.css` sets a 32 px minimum, but padding and line height
make buttons about 34.8 px. Only the issue page's Source buttons are pinned to 32 px (F-017).
