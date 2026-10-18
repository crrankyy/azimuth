---
id: F-001
title: Keep the viewer running while a Claude Code session is open
summary: The viewer stays up for as long as any Claude Code session in the project is open, and comes back on the next prompt if it stopped, so its URL always works while you work.
status: draft
priority: P2
size: M
mode: brownfield
milestone: null
depends_on: []
superseded_by: null
tags: []
created: 2026-10-18
updated: 2026-10-18
---
# F-001: Keep the viewer running while a Claude Code session is open

## Objective
The viewer stays up for as long as any Claude Code session in the project is open, and comes back
on the next prompt if it stopped for any other reason (crash, kill, a rebuild that replaced it), so
its URL always works while you work.

## Out of scope
- Shutting the viewer down when the last session closes: after that, the existing rule still
  applies (it exits after two idle hours with no page open).
- Sessions run outside Claude Code (no hooks, no `CLAUDE_PID`): they keep the existing rule.
- Restarting from hooks other than SessionStart and UserPromptSubmit.

## Integration points
- `src/hooks/handlers.ts`: SessionStart and UserPromptSubmit record Claude Code's process ID
  (`CLAUDE_PID`, which Claude Code sets in hook commands) in the session's live log;
  UserPromptSubmit also makes sure the viewer runs, like SessionStart does.
- `src/core/live.ts`: the live record types and the rule for when a Claude Code session is open.
- `src/server/server.ts`: the idle check keeps the viewer up while a session is open.
- `src/server/autostart.ts` and `src/cli/commands/harness.ts`: starting the viewer without
  waiting for it, so the prompt hook stays fast.

## Invariants
- A hook never blocks or slows a prompt noticeably: the prompt hook starts the viewer without
  waiting for it to come up.
- `viewer.autostart: false`, `AZIMUTH_NO_VIEWER=1` and `CLAUDE_CODE_REMOTE=true` still mean no
  viewer is started by any hook.
- Live logs stay append-only; existing records without a process ID keep working.
- The index contract (`src/core/types.ts`) doesn't change: process IDs stay inside the live logs.

## Assumptions
- A session counts as open while it has no end record after its latest start and its recorded
  Claude Code process is running. Process IDs are only trusted while the log was written in the
  last 24 hours (live logs are pruned after that), so a reused process ID can't keep a viewer up
  forever.
- A session without a recorded process ID counts as open while it was active within the idle
  limit (the existing rule).
- The SessionEnd hook isn't documented to run when the terminal is closed or Claude Code is
  killed, so the process check, not the end record alone, decides.
- `/reload-plugins` isn't documented to run SessionStart; the prompt hook records the process ID
  and starts the viewer, so a session that enabled the plugin mid-way is covered from its next
  prompt.
