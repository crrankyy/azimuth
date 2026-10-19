---
completed_at: 2026-10-20
files_changed:
  - { path: plugin/hooks/hooks.json, change: modify }
  - { path: src/hooks/handlers.ts, change: modify }
  - { path: src/cli/commands/harness.ts, change: modify }
  - { path: src/core/tools.ts, change: create }
  - { path: src/core/live-agents.ts, change: create }
  - { path: src/core/live.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/transcript.ts, change: create }
  - { path: src/server/transcript.ts, change: create }
  - { path: src/server/server.ts, change: modify }
  - { path: test/core/tools.test.ts, change: create }
  - { path: test/core/live-agents.test.ts, change: create }
  - { path: test/core/live.test.ts, change: modify }
  - { path: test/core/transcript.test.ts, change: create }
  - { path: test/fixtures/transcripts/c1.jsonl, change: create }
  - { path: test/fixtures/transcripts/c1/subagents/agent-a1.jsonl, change: create }
  - { path: test/hooks/hooks.test.ts, change: modify }
  - { path: test/server/transcript.test.ts, change: create }
  - { path: test/server/live-refresh.test.ts, change: create }
  - { path: viewer/src/screens/activity/LiveStrip.test.tsx, change: modify }
deviations:
  - { path: src/core/live-agents.ts, kind: design-change, reason: "spansOf drops every zero-length wait span, not only the ones the 30-minute rule closes, as feature.md says. Records are stamped to the second, so a wait that ends in the second it opened (the PermissionRequest wait of a claude -p run, for one) has nothing to show" }
  - { path: src/core/tools.ts, kind: shared-change, reason: "displayPath and clip moved here from src/hooks/handlers.ts and are exported, so toolTarget and the transcript normaliser use them as describeTool does; contract.md lists only editSize, patchLines, lineCount and toolTarget for tools.ts" }
  - { path: src/core/live.ts, kind: scope-addition, reason: "Exports AGENT_ID (letters, digits, _ and -, 1 to 64 characters), which contract.md doesn't list, so transcriptPathOf and the route's agent check in src/server/transcript.ts share one pattern" }
  - { path: src/core/live.ts, kind: clarification, reason: "A wait record with an agent_id updates that agent's last_seen_at, and creates the agent when no other record named it, as tool records do" }
  - { path: src/core/transcript.ts, kind: clarification, reason: "A forward read that finds no line end between after and the end of the file (a line still being written) returns no lines, next = after and skipped false, so a later read returns the line once it is complete. contract.md covers only a line end found past the window, and after at the end of the file" }
  - { path: src/hooks/handlers.ts, kind: clarification, reason: "A PermissionRequest without tool_name records the reason Permission prompt, with tool and target null, and a wait's target is null when toolTarget gives an empty string" }
  - { path: src/core/transcript.ts, kind: clarification, reason: "A Bash result whose toolUseResult has no stdout shows the tail of the tool_result text as its output, where feature.md names only stdout then stderr" }
  - { path: test/fixtures/transcripts/c1.jsonl, kind: test-change, reason: "Line 10's tool_result content is the Bash stdout text, where contract.md's fixture table writes an ellipsis" }
follow_ups: []
---
# F-014: As built

## Summary
Three new hooks only observe: PermissionRequest (sync, 5 s timeout), Notification (no matcher;
the handler keeps `permission_prompt` only) and PostToolUseFailure (matcher `*`, async) run
`azimuth hook permission-request | notification | post-tool-use-failure`, exit 0 with no output
and append at most one live record each. A permission prompt becomes a `wait` record, reason
`Permission prompt: <tool> <target>` (or `Permission prompt: <message>` for a notification), and
a failed tool a `tool` record with `failed: true` and the error's first line. PostToolUse adds `added` and `removed` to
Edit, MultiEdit and Write records (`editSize`: the response's `structuredPatch`, else the input),
and SubagentStop keeps `agent_transcript_path`. The new `src/core/tools.ts` holds `editSize`,
`patchLines`, `lineCount` and `toolTarget` for the hooks and the transcript normaliser.

`deriveActivity` (new `src/core/live-agents.ts`, no I/O) replays a session's records. A wait
opens at a `wait` record and closes at that agent's next `tool` record, the main agent's next
`prompt` or `stop`, a subagent's `subagent-stop`, or `end` and `start`; a notification of an
unknown agent is ignored while any wait is open and otherwise ends at any agent's next record.
Each agent is `done` at its end or stop, `waiting` while a permission wait is open (these never
expire), `done` after 30 minutes without a record, `waiting` for your prompt (main agent) after
a `stop`, else `running`. It also gets its wait, current action, last five edits and last 20 wait
spans, and the session's status and wait follow from its agents'. `summarizeLive` merges this
into `LiveSession.main`, `status`, `waiting` and every `LiveAgent`; events carry `added`,
`removed` and `error`. `readLiveSessions` and `pruneLive` keep logs touched in the last 72 hours
(`sessionOpen` and `anySessionOpen` keep 24), fill `goal` and `skill` from the Azimuth session's
latest Goals bullet, else its frontmatter (`latestGoal`), and set `transcript` when
`transcriptPathOf` gives a path that exists. While a client is connected, the server re-reads
live sessions every 60 s (`statusRefreshMs`) and pushes `live` when a status changed.

`GET /api/transcript/<claude-session>[?agent=<id>][&after=<offset>]` (`serveTranscript`, new
`src/server/transcript.ts`) needs the page's `x-azimuth-token`, checked after the Host check. It
reads only the sidecar's `transcript_path`, a `subagent-stop` record's path or the
`subagents/agent-<id>.jsonl` file beside the main transcript, and only when the real path is a
regular `.jsonl` file under the real `$CLAUDE_CONFIG_DIR/projects` or `~/.claude/projects`.
`readTranscriptWindow` (new `src/core/transcript.ts`) returns the complete lines of a 512 KiB
window, the file's last or the one from `after`, and `normalizeTranscript` turns them into
messages, tool calls with a capped diff and output, subagent cards, and `result` entries for
results whose call is outside the page. The index carries only `transcript: boolean`, exports
keep `live: []`, and `build-index.ts`, `session.ts` and the Hookline golden index are unchanged.
The LiveStrip test's builders gain the new fields.

Smoke test on 2026-10-20 against a real `claude -p` session (Claude Code 2.1.304): the sidecar's
`transcript_path`, the `subagent-stop` transcript path, the PermissionRequest wait (zero-length
in `-p` mode), the edit sizes, and the route serving main and subagent entries with Edit diffs,
and refusing with 403 without the token, all worked. Its Glob record had `file: ""` rather than
null. That predates F-014: `describeTool` in `handlers.ts` has turned any string `path` input
into a project-relative `file` since c30da07, which gives `""` for the project root itself, and
F-014 didn't change it.

## Deviations
- `spansOf` drops every zero-length wait span, not only the ones the 30-minute rule closes, as
  feature.md says. Records are stamped to the second, so a wait that ends in the second it opened
  (the PermissionRequest wait of a `claude -p` run, for one) has nothing to show.
- `displayPath` and `clip` moved from `src/hooks/handlers.ts` to `tools.ts` and are exported, so
  `toolTarget` and the transcript normaliser use them as `describeTool` does. contract.md lists
  only `editSize`, `patchLines`, `lineCount` and `toolTarget` for `tools.ts`.
- `live.ts` exports `AGENT_ID` (`/^[A-Za-z0-9_-]{1,64}$/`), which contract.md doesn't list, so
  `transcriptPathOf` and the route's agent check share one pattern.
- A `wait` record with an `agent_id` updates that agent's `last_seen_at`, and creates the agent
  when no other record named it, as `tool` records do.
- A forward read that finds no line end between `after` and the end of the file (a line still
  being written) returns no lines, `next = after` and `skipped: false`, so a later read returns
  the line once it is complete. contract.md covers only a line end found past the window, and
  `after` at the end of the file.
- A PermissionRequest without `tool_name` records the reason `Permission prompt`, with `tool`
  and `target` null, and a wait's `target` is null when `toolTarget` gives `""`.
- A Bash result whose `toolUseResult` has no `stdout` shows the tail of the `tool_result` text as
  its output, where feature.md names only stdout then stderr.
- Line 10 of the fixture `c1.jsonl` has the Bash stdout text as its `tool_result` content, where
  contract.md's fixture table writes `…`.

Otherwise the files match `impact.md`, except the four docs it names (`docs/claude-code.md`,
`docs/file-format.md`, `docs/viewer.md` and `docs/concepts.md`): they are T-014.10's, which
wasn't committed when this record was written.

## Follow-ups
None filed.
