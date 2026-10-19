---
id: BUG-0073
type: bug
title: Every live log access runs git twice to find the shared cache directory
status: open
severity: medium
likelihood: null
impact: null
links: [F-011]
files: [src/core/lock.ts, src/core/live.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
Run any hook or index build in a project with a few Claude Code sessions in the last day, and
count child processes (for example with `dtruss` or a wrapper around `git`).

## Expected
The shared cache directory is worked out once per process and root.

## Actual
`sharedCacheDir` (`src/core/lock.ts`) runs `git rev-parse --git-common-dir` and
`--show-toplevel` on every call, uncached, and `appendLive` calls it twice, so each PostToolUse
append starts four git processes. F-011 added more calls: two per live log on every
`readLiveSessions` (each viewer live push), two to four per sidecar in `sessionsLastSeen` on every
analysis, and SessionEnd now starts about 9 to 11 git processes against its 1.5 s budget.
