---
completed_at: 2026-10-18
files_changed:
  - { path: src/core/live.ts, change: modify }
  - { path: src/server/server.ts, change: modify }
  - { path: src/hooks/handlers.ts, change: modify }
  - { path: src/cli/commands/harness.ts, change: modify }
  - { path: test/core/live.test.ts, change: create }
  - { path: test/server/server.test.ts, change: modify }
  - { path: test/hooks/hooks.test.ts, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: docs/claude-code.md, change: modify }
deviations: []
follow_ups: []
---
# F-001: As built

## Summary
The SessionStart and UserPromptSubmit hooks record Claude Code's process ID (`CLAUDE_PID`) in the
session's live log. The viewer's idle check keeps it running while any session of the project is
open: no end record since its latest start, and its process still runs (process IDs are trusted
only while the log is under a day old). Sessions without a process ID keep the two-hour idle
rule. The prompt hook also starts a stopped viewer without waiting for it.

Checked end to end through the plugin's launcher: with the viewer stopped, the prompt hook
returned in 0.35 s, the viewer answered its health check right after, and the prompt record
carried the Claude Code process ID.

## Deviations
None. `src/server/autostart.ts` was only read, as planned: `ensureViewer` already took a wait
time.

## Follow-ups
- Not filed (medium; only high-priority bugs go into Azimuth for now): scenario markers in test
  names that contain an apostrophe, such as `it("S-001.1.2 doesn't …")`, are traced as mentions
  instead of markers, because the title pattern in `src/core/trace.ts` stops at any quote
  character.
- This session enabled the plugin mid-way, so its hooks run only after `/reload-plugins` or in
  the next session; the viewer's process record for it was written once by hand through the hook.
