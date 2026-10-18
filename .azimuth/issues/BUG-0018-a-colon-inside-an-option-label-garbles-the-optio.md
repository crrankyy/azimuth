---
id: BUG-0018
type: bug
title: A colon inside an option label garbles the option
status: resolved
severity: medium
likelihood: null
impact: null
links: []
files: [src/cli/commands/create.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
`azimuth new question "Format?" --option a='JSON (config.json with {"json": true}): parsed by JSON.parse'`

## Expected
Label `JSON (config.json with {"json": true})`, detail `parsed by JSON.parse`.

## Actual
The value is split at the first ": ", inside the braces: label `JSON (config.json with {"json"`, detail starting `true}): …`.
