---
files:
  - path: src/core/live.ts
    change: modify
    note: Process IDs on start and prompt records; the rule for when a Claude Code session is open
  - path: src/server/server.ts
    change: modify
    note: The idle check keeps the viewer up while any session is open
  - path: src/server/autostart.ts
    change: read
    note: ensureViewer already takes how long to wait for a new viewer
  - path: src/hooks/handlers.ts
    change: modify
    note: Record CLAUDE_PID; the prompt hook starts the viewer without waiting
  - path: src/cli/commands/harness.ts
    change: modify
    note: Pass the wait time through to ensureViewer
  - path: test/core/live.test.ts
    change: create
    note: The open-session rule
  - path: test/server/server.test.ts
    change: test
    note: The viewer outlives its idle limit while a session is open
  - path: test/hooks/hooks.test.ts
    change: test
    note: Process IDs recorded; the prompt hook starts the viewer, or not when autostart is off
  - path: docs/viewer.md
    change: modify
    note: When the viewer stops and restarts
  - path: docs/claude-code.md
    change: modify
    note: The prompt hook's new job
---
# F-001: Impact map
