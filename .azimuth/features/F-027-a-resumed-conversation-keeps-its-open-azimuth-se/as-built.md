---
completed_at: 2026-10-31
files_changed:
  - { path: docs/claude-code.md, change: modify }
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/core/live.ts, change: modify }
  - { path: src/core/session.ts, change: modify }
  - { path: src/hooks/handlers.ts, change: modify }
  - { path: test/core/live.test.ts, change: modify }
  - { path: test/core/session.test.ts, change: modify }
  - { path: test/hooks/hooks.test.ts, change: modify }
deviations: []
follow_ups: []
---
# F-027: As built

## Summary
Built as specced in four tasks. `linkedSession` (`src/core/session.ts`) gives the session the CLI
uses without `--id` (`currentSession`) and the state of its own file: open, closed, missing or
invalid. `pruneLive` takes a `keep` callback, and the SessionStart hook passes
`(c) => linkOpen(root, c)`, so the live log and sidecar of a Claude Code session whose Azimuth
session is open are never pruned; once it is closed they age out after 72 hours as before. On
resume, `/clear` and compaction the hook prints two lines from `linkedSession`, so the hook and
the CLI agree. The CLI is unchanged. The old session's goal line belongs to the continued
session and goes in with the next records commit. S-011.7.3's test setup gained an open session
file; its assertion is unchanged.

## Deviations

## Follow-ups
None. ZenithMD's SES-20261020-1343 lost its link before this fix; close it with `azimuth session close --stale` there (reported to the user).
