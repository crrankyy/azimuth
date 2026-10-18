---
completed_at: 2026-10-19
files_changed:
  - { path: plugin/hooks/hooks.json, change: modify }
  - { path: src/hooks/handlers.ts, change: modify }
  - { path: src/cli/commands/harness.ts, change: modify }
  - { path: src/core/live.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: viewer/src/screens/activity/LiveStrip.tsx, change: modify }
  - { path: viewer/src/screens/activity/activity.css, change: modify }
  - { path: viewer/src/data/IndexProvider.tsx, change: modify }
  - { path: test/hooks/hooks.test.ts, change: modify }
  - { path: test/core/live.test.ts, change: modify }
  - { path: viewer/src/screens/activity/LiveStrip.test.tsx, change: create }
  - { path: docs/claude-code.md, change: modify }
  - { path: docs/viewer.md, change: modify }
deviations:
  - { path: viewer/src/data/IndexProvider.tsx, kind: unplanned-modify, reason: Exports the index state's context so the LiveStrip test can render ID chips without a live server }
  - { path: src/core/live.ts, kind: plan-change, reason: T-005.2's hooks use launchRefs from live.ts, so T-005.3 was moved after T-005.2 instead of running beside it }
follow_ups: [BUG-0066]
---
# F-005: As built

## Summary
Three new hooks (PreToolUse for the Agent tool, SubagentStart, SubagentStop) append `launch`,
`subagent` and `subagent-stop` records, and the Agent tool's own record keeps its tool use ID and
the subagent it started. `summarizeLive` joins them: an exact match from the Agent tool's
response, otherwise launches in order. Each live agent carries its description, task, feature and
finish time, and each session the features in flight. The live view names lanes after their
assignment with a task chip and "Finished", and the session row shows a chip per feature in
flight. Wake-ups follow every feature in flight.

Checked in a real run: a Sonnet orchestrator building F-003 and F-005 of the Rust rehearsal crate
with four Haiku subagents at once showed `F-003 F-005` on the session row and lanes "T-003.2 inline
code", "T-003.3 links", "T-003.4 emphasis strong", "T-005.1 LineCol scaffold" and "Finished
T-003.1 span scaffold".

## Deviations
- `viewer/src/data/IndexProvider.tsx` exports its context for component tests.
- T-005.3 ran after T-005.2: the hooks needed `launchRefs` from `live.ts`.
- Closing out found BUG-0064 (Vitest runs credited no scenarios); the verify commands now use
  `--reporter=verbose`.

## Follow-ups
- BUG-0066: a finished lane shows Claude Code's internal hand-back step as its latest action.
