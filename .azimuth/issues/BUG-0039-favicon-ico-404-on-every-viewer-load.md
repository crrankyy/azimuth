---
id: BUG-0039
type: bug
title: favicon.ico 404 on every viewer load
status: open
severity: low
likelihood: null
impact: null
links: []
files: [src/server/server.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Open the viewer with the browser console open.

## Expected
No failed requests.

## Actual
`GET /favicon.ico` returns 404 on every load.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
