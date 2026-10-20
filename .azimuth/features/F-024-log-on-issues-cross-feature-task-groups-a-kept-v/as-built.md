---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: plugin/skills/bug/SKILL.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: src/cli/commands/write.ts, change: modify }
  - { path: src/core/next.ts, change: modify }
  - { path: src/core/transitions.ts, change: modify }
  - { path: src/server/autostart.ts, change: modify }
  - { path: src/server/registry.ts, change: modify }
  - { path: src/server/server.ts, change: modify }
  - { path: test/cli/log.test.ts, change: create }
  - { path: test/cli/parallel.test.ts, change: modify }
  - { path: test/core/next.test.ts, change: modify }
  - { path: test/core/transitions.test.ts, change: modify }
  - { path: test/server/autostart.test.ts, change: modify }
  - { path: viewer/src/screens/issues/IssueHistory.tsx, change: modify }
  - { path: viewer/src/screens/issues/history.test.tsx, change: modify }
  - { path: viewer/src/screens/issues/history.ts, change: modify }
deviations: []
follow_ups: [BUG-0082]
---
# F-024: As built

## Summary
`azimuth log` takes issue IDs and adds a dated `<stamp> · <actor> · <text>` bullet to the issue's Status notes, which the Issue page's History dates and sorts. `azimuth next` (no ID, text) ends with the ready tasks of different features that can run together. Autostart waits for a replaced viewer to exit and keeps its port unless `viewer.port` changed (the record keeps `config_port`). Refusing to reapprove a verifying feature explains that the done gate doesn't check the approval, and the skills show the reapproval rule and the `--option` syntax.

## Deviations
None.

## Follow-ups
BUG-0082: the inbox still asks to reapprove a verifying feature whose spec changed.
