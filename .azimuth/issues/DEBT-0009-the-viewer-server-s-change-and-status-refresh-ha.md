---
id: DEBT-0009
type: debt
title: The viewer server's change and status-refresh handlers swallow every error
status: open
severity: low
likelihood: null
impact: null
links: [F-014]
files: [src/server/server.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
In `src/server/server.ts`, the file-change handler and F-014's status refresh catch every error
with only a comment ("a file caught mid-write"). A real bug in `readLiveSessions`,
`deriveActivity` or the index build would silently stop live pushes.

## Proposed fix
Keep the retry for parse errors of files caught mid-write, and log anything else to
`.azimuth/cache/hooks.log` (or the server's log) so it can be seen.
