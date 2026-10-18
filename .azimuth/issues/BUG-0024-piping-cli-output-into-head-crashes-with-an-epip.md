---
id: BUG-0024
type: bug
title: Piping CLI output into head crashes with an EPIPE stack trace
status: in-progress
severity: medium
likelihood: null
impact: null
links: []
files: [src/cli/io.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
`azimuth doctor | head -2` (or any command whose output is longer than what the reader takes, e.g. `azimuth status | head -1`).

## Expected
The command stops quietly when the reader closes the pipe, as `ls | head` does.

## Actual
An unhandled `Error: write EPIPE` stack trace from `print` in `src/cli/io.ts` on stderr. Agents pipe CLI output into `head` often, and the trace reads like a crash.
