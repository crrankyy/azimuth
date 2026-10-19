---
files:
  - path: plugin/hooks/hooks.json
    change: modify
    note: PermissionRequest (sync, timeout 5), Notification (no matcher, async; the handler filters permission_prompt) and PostToolUseFailure (matcher *, async)
  - path: src/hooks/handlers.ts
    change: modify
    note: HookInput fields; permissionRequest, notification and postToolUseFailure in HOOKS; edit sizes on tool records; subagent-stop keeps transcript_path
  - path: src/cli/commands/harness.ts
    change: modify
    note: The hook command's usage lists post-tool-use-failure, permission-request and notification
  - path: src/core/tools.ts
    change: create
    note: editSize, patchLines, lineCount and toolTarget, shared by the hooks and the transcript normaliser
  - path: src/core/live-agents.ts
    change: create
    note: deriveActivity (waits, statuses, current actions, edits, wait spans), toLiveEvent and latestGoal; pure (no I/O)
  - path: src/core/live.ts
    change: modify
    note: wait record and new tool/subagent-stop fields; summarizeLive takes now and merges deriveActivity; 72-hour readLiveSessions and pruneLive; goal, skill and transcript flags; transcriptPathOf
  - path: src/core/types.ts
    change: modify
    note: AgentStatus, LiveWait, LiveWaitSpan, LiveEdit, LiveActivity; new LiveEvent, LiveAgent and LiveSession fields; TranscriptEntry and TranscriptPage
  - path: src/core/transcript.ts
    change: create
    note: readTranscriptWindow (bounded reads of complete lines) and normalizeTranscript
  - path: src/server/transcript.ts
    change: create
    note: defaultTranscriptRoots and serveTranscript (lookup of recorded paths, realpath checks, window, normalisation)
  - path: src/server/server.ts
    change: modify
    note: GET /api/transcript/<claude-session> behind the token; transcriptRoots and statusRefreshMs options; status refresh pushes
  - path: src/core/paths.ts
    change: read
    note: tidyPaths and Places for display targets
  - path: src/core/ids.ts
    change: read
    note: ID_PATTERNS.session guards the session file read for goal and skill
  - path: src/core/parse/records.ts
    change: read
    note: parseSession gives goal, skill and (with F-011) goals
  - path: src/core/errors.ts
    change: read
    note: AzimuthError("invalid") for an offset past the end
  - path: src/core/build-index.ts
    change: read
    note: buildIndex keeps calling readLiveSessions(root, now)
  - path: src/server/http.ts
    change: read
    note: hostAllowed and sendJson for the new route
  - path: src/server/export.ts
    change: read
    note: exportHtml already sets live to []
  - path: viewer/src/screens/activity/LiveStrip.tsx
    change: read
    note: Reads LiveSession and LiveEvent fields that keep their meaning
  - path: viewer/src/screens/activity/LiveStrip.test.tsx
    change: test
    note: The session and agent builders gain the new required fields
  - path: test/core/tools.test.ts
    change: test
    note: Edit sizes and tool targets
  - path: test/core/live-agents.test.ts
    change: test
    note: Waits, statuses, current actions and edits per agent
  - path: test/core/live.test.ts
    change: test
    note: Live sessions with activity, goal and skill, 72-hour retention and transcript flags
  - path: test/core/transcript.test.ts
    change: test
    note: Transcript windows and normalised entries
  - path: test/fixtures/transcripts/c1.jsonl
    change: test
    note: Synthetic main transcript built from Claude Code's line shapes, with no real content
  - path: test/fixtures/transcripts/c1/subagents/agent-a1.jsonl
    change: test
    note: Synthetic subagent transcript at the documented location
  - path: test/hooks/hooks.test.ts
    change: test
    note: Wait, failed-tool, edit-size and subagent-stop records, and the hooks.json registration
  - path: test/server/transcript.test.ts
    change: test
    note: The transcript route (token, path checks, paging, window) and exports without transcripts
  - path: test/server/live-refresh.test.ts
    change: test
    note: Time-based status changes are pushed while a client is connected
  - path: docs/claude-code.md
    change: modify
    note: The new hooks; transcripts read only by the live server, never exported, with the path checks
  - path: docs/file-format.md
    change: modify
    note: Live record kinds (wait; tool sizes and failures; subagent-stop transcript path); live logs kept 72 hours
  - path: docs/viewer.md
    change: modify
    note: GET /api/transcript in the HTTP API table and the security section
  - path: docs/concepts.md
    change: modify
    note: Agent statuses (running, waiting on you, done) in Sessions and live activity
---
# F-014: Impact map

The hooks append three more kinds of facts to the live log (waits, failures, edit sizes and
subagent transcript paths), using `tools.ts` for targets and sizes. `live-agents.ts` turns a
log's records into each agent's activity; `live.ts` merges it into the live sessions the index
and the server's `live` pushes already carry, and resolves transcript paths from F-011's sidecar
and the records. The transcript route lives in the server only: `server/transcript.ts` finds a
recorded path, checks it, reads a window with `core/transcript.ts` and normalises it. Nothing in
the index's other sections, the CLI output or the viewer screens changes.
