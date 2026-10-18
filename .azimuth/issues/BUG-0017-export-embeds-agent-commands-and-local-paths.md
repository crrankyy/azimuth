---
id: BUG-0017
type: bug
title: Export embeds agent commands and local paths
status: resolved
severity: medium
likelihood: null
impact: null
links: []
files: [src/server/export.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
1. Work in a project with live agent activity and verify runs.
2. `azimuth export -o snapshot.html`.

## Expected
A shareable snapshot with no local paths and no agent command lines.

## Actual
The embedded index has the live sessions (60 recent commands, 10 with /Users/… paths) and run output tails (8 with /Users/… paths). Command lines can carry secrets.
