---
files:
  - path: plugin/hooks/hooks.json
    change: modify
    note: PreToolUse (Agent|Task), SubagentStart and SubagentStop run the new hook handlers
  - path: src/hooks/handlers.ts
    change: modify
    note: launch, subagent and subagent-stop records; the Agent tool's record keeps its IDs; wake-ups follow every feature in flight
  - path: src/cli/commands/harness.ts
    change: modify
    note: The hook command's usage lists the new events
  - path: src/core/live.ts
    change: modify
    note: New record kinds; matching subagents to launches; features in flight
  - path: src/core/types.ts
    change: modify
    note: Each live agent's assignment and finish time; the session's features in flight
  - path: viewer/src/screens/activity/LiveStrip.tsx
    change: modify
    note: Lanes named after their assignment, feature chips, finished lanes
  - path: viewer/src/screens/activity/activity.css
    change: modify
    note: Styles for assignment chips and finished lanes
  - path: test/hooks/hooks.test.ts
    change: test
    note: The new hooks' records, and wake-ups for every feature in flight
  - path: test/core/live.test.ts
    change: test
    note: Matching subagents to launches and features in flight
  - path: viewer/src/screens/activity/LiveStrip.test.tsx
    change: test
    note: Lane names, feature chips and finished lanes
  - path: docs/claude-code.md
    change: modify
    note: The new hooks
  - path: docs/viewer.md
    change: modify
    note: What the live view shows for subagents
---
# F-005: Impact map

The hooks record what the Agent tool was asked to do and which subagent started; `live.ts` joins
the two; the viewer reads the result from the index. No other part of the index changes.
