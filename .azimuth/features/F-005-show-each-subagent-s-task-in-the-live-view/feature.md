---
id: F-005
title: Show each subagent's task in the live view
summary: When an orchestrator hands tasks to subagents, the viewer's live view names each subagent's task and feature and shows every feature the session has in flight, so you can follow parallel work across features.
status: done
priority: P1
size: M
mode: brownfield
milestone: null
depends_on: []
superseded_by: null
tags: []
created: 2026-10-18
updated: 2026-10-18
approved_at: 2026-10-18
approved_by: agent
approved_hash: sha256:c499afb9686bed03cd27f6e90aa49ee88ce89fb396503c6356bdcf4d1ce7a564
approved_commit: 8c06490
review_ack_at: 2026-10-18T18:39:50Z
---
# F-005: Show each subagent's task in the live view

## Objective
When an orchestrator hands tasks to subagents, the viewer's live view names each subagent's task
and feature, shows when it finished, and lists every feature the session has in flight, so you
can follow parallel work across several features. Wake-ups follow every feature in flight too.

## Out of scope
- Showing which model a subagent runs on: the hooks don't report it.
- Subagents started outside the Agent tool (none exist today).
- Live state across several git worktrees beyond what the hooks already record: subagents in
  worktrees report through the same Claude Code session, which is enough here.
- Feature pages and the sidebar strip: they keep showing task status and the latest step.

## Integration points
- `plugin/hooks/hooks.json`: new PreToolUse (Agent|Task), SubagentStart and SubagentStop hooks.
- `src/hooks/handlers.ts`: handlers that append `launch`, `subagent` and `subagent-stop` live
  records; the PostToolUse record for the Agent tool keeps the tool use ID and the new subagent's
  ID; wake-ups look at every feature in flight.
- `src/core/live.ts`: the record types, and matching each subagent to its launch.
- `src/core/types.ts`: the live part of the index contract (each agent's assignment, the
  session's features in flight).
- `viewer/src/screens/activity/LiveStrip.tsx`: lanes named after their assignment, a chip per
  feature in flight, finished lanes.

## Invariants
- Hooks never block or slow tool calls noticeably: the new hooks only append one line.
- Live logs stay append-only, and logs written before this feature still summarize as before
  (agents without an assignment fall back to their type).
- A subagent's exact match (from the Agent tool's response) always wins over a match by order.

## Assumptions
- Verified on 2026-10-18 with hook logging: PreToolUse for the Agent tool carries the
  description and prompt; SubagentStart carries `agent_id` and `agent_type` but no description;
  the Agent tool's PostToolUse response carries `agentId`, right away for a background subagent
  and only when it finishes for a foreground one. While a foreground subagent runs, it is matched
  to the oldest launch not yet matched, which is right when launches start subagents in order.
- A launch's task and feature come from the IDs in its description, or from its prompt when the
  description names none; orchestrators following the build skill name the task.
- A subagent counts as in flight until its SubagentStop record.
