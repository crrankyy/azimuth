---
id: BUG-0015
type: bug
title: Question options containing a comma are refused
status: open
severity: high
likelihood: null
impact: null
links: []
files: [src/cli/commands/create.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
`azimuth new question "Where?" --option a="Per-user: XDG path, else ~/.config" --option b="Project: .tallyrc"`

## Expected
Two options; commas are ordinary text inside an option.

## Actual
Exit 2: `--option must look like key="Label: detail" (got else ~/.config…)`. Option values are split at commas; agents rewrite their text without commas to get past it.
