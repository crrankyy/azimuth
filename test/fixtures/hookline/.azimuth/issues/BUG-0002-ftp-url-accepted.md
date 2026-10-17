---
id: BUG-0002
type: bug
title: Endpoint URL validation accepts ftp:// URLs
status: resolved
severity: low
likelihood: null
impact: null
links: [F-001]
files: [src/api/endpoints.ts]
found_by: you
created: 2026-09-12
resolved_at: 2026-09-15
---
## Repro
POST /endpoints with url `ftp://example.test/hook`.

## Expected
422 with `{field: "url", reason: "must be http or https"}`.

## Actual
201 Created.
