---
id: BUG-0022
type: bug
title: The session that runs init records no start and starts no viewer
status: resolved
severity: low
likelihood: null
impact: null
links: []
files: [src/cli/commands/work.ts, src/core/init.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
In a new repo, run `/azimuth:init` in a Claude Code session.

## Expected
From the moment `.azimuth/` exists, the session is tracked like any other: a start record with its process ID, and the viewer running.

## Actual
SessionStart ran before `.azimuth/` existed, so the session's live log has no start record and no process ID, and no viewer starts until the next session.
