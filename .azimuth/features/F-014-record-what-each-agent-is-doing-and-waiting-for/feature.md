---
id: F-014
title: Record what each agent is doing and waiting for
summary: Hooks record permission waits, failed tools, edit sizes and subagent transcript paths; each live session and agent in the index carries a status (running, waiting, done), its wait, current action, recent edits and wait spans; a token-guarded endpoint serves normalised Claude Code transcripts to the live viewer only.
status: done
priority: P1
size: L
mode: brownfield
milestone: M-01
depends_on: [F-011]
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:17e80e93ff3ba975ca6850e62f176223b87d7f87ca8e8a3eef1c35ba5a5c6c11
approved_commit: 745f055
review_ack_at: 2026-10-20T11:04:35Z
---
# F-014: Record what each agent is doing and waiting for

## Objective
Give the viewer what the Agents tab, the Live transcript page (F-015) and the Activity timeline
(F-016) need, without changing the viewer itself.

- **Hooks** record when an agent waits on you (PermissionRequest, and Notification of type
  `permission_prompt`), tools that failed (PostToolUseFailure, with the first line of the
  error), the lines each Edit, MultiEdit and Write added and removed, and each subagent's
  transcript path (SubagentStop's `agent_transcript_path`). They only observe: exit 0, no
  output, one appended live record each, and never a permission decision.
- **The index's live sessions** carry, for the session as a whole, for its main agent (`main`)
  and for each subagent: a status `running | waiting | done` by fixed rules, what it waits for
  (`{reason, since}`), its current action, start and end, its last five edits with line counts,
  its wait spans for the timeline, and whether its transcript can be served. Each session also
  carries its Azimuth session's latest goal and skill. Live logs are kept 72 hours instead of 24,
  for the timeline's 3-day view.
- **`GET /api/transcript/<claude-session>[?agent=<id>][&after=<offset>]`** serves a window of
  Claude Code's transcript for the main agent or a subagent, normalised into messages, tool
  calls (with status, a capped diff and a capped output tail) and subagent cards. It needs the
  page's token, serves only paths the hooks recorded (or the documented subagent location next
  to them) under Claude Code's `projects` folders, and exists only in the live server: the
  index, the CLI and exports never read or carry transcripts.

## Out of scope
- Viewer screens: the Agents tab, the transcript page and the timeline (F-015, F-016). The live
  strip, the Activity feed and the Inbox's empty-state line keep their own rules (`stopped_at`,
  `ended_at`, the 120-second window) until F-015 moves them to `status`; with 72-hour logs the
  Inbox's "An agent is working" line can name a session up to three days old until then.
- Answering, allowing or denying permission prompts, in the hooks or in the viewer.
- Pushing transcript lines over SSE: the viewer fetches the next page with `after` when a `live`
  event arrives.
- Wait spans and edits older than the 64 KB tail of a live log (the tail size doesn't change).
- Notification types other than `permission_prompt` (an idle main agent is known from Stop).
- Transcripts of Claude Code sessions whose sidecar has no `transcript_path` (sessions last
  started before F-011), and of subagents whose IDs have rolled out of the live log's tail.
- The handoff's `failed` and `queued` statuses, models, token usage and the Agent tool's
  `prompt` text.
- Making the 30-minute, 72-hour, window and cap values configurable.
- `src/core/build-index.ts`, `src/core/session.ts` and the golden
  `test/fixtures/hookline/expected-index.ts`: unchanged (`readLiveSessions(root, now)` keeps its
  signature and the sample index has no live sessions).

## Integration points
- `plugin/hooks/hooks.json`: PermissionRequest (sync, 5 s), Notification (no matcher, async)
  and PostToolUseFailure (matcher `*`, async) run
  `azimuth hook permission-request | notification | post-tool-use-failure`.
- `src/hooks/handlers.ts`: `HookInput` gains `agent_transcript_path`, `notification_type`,
  `message`, `title` and `error` (F-011 adds `transcript_path`); new handlers
  `permissionRequest`, `notification` and `postToolUseFailure` in `HOOKS`; `postToolUse` adds
  `added`/`removed` from `editSize`; `subagentStop` keeps `transcript_path`. The usage line of
  `hook` in `src/cli/commands/harness.ts` lists the new events.
- `src/core/tools.ts` (new): `editSize`, `patchLines`, `lineCount` and `toolTarget`, shared by
  the hooks and the transcript normaliser (the server can't import `src/hooks`). `describeTool`
  stays in `handlers.ts` unchanged.
- `src/core/live-agents.ts` (new, pure: no I/O): `deriveActivity` (waits, statuses, current
  actions, edits, spans), `toLiveEvent` and `latestGoal`.
- `src/core/live.ts`: the `wait` record and the new `tool` and `subagent-stop` fields;
  `summarizeLive(claudeSession, records, meta?, now?)` (F-011's `meta`, plus `now`) merges
  `deriveActivity`; `readLiveSessions` keeps 72 hours, reads the goal and skill from
  `.azimuth/sessions/<ses>.md` (`parseSession`, with F-011's `goals`) and sets the transcript
  flags through `transcriptPathOf` (F-011's `LiveMeta.transcript_path`); `pruneLive` deletes
  after 72 hours; `sessionOpen` and `anySessionOpen` keep 24 hours.
- `src/core/types.ts`: `AgentStatus`, `LiveWait`, `LiveWaitSpan`, `LiveEdit`, `LiveActivity`,
  the new `LiveEvent`, `LiveAgent` and `LiveSession` fields, and the transcript API types
  (`TranscriptEntry`, `TranscriptPage`), which the viewer imports.
- `src/core/transcript.ts` (new): `readTranscriptWindow` (bounded reads of complete lines) and
  `normalizeTranscript`.
- `src/server/transcript.ts` (new): `defaultTranscriptRoots` and `serveTranscript` (lookup,
  realpath checks, window, normalisation). `src/server/server.ts` routes
  `GET /api/transcript/…` with the token and the existing Host check, and re-derives live
  statuses once a minute while a client is connected. `src/server/export.ts` already sets
  `live: []`.
- Docs: `docs/claude-code.md` (new hooks; transcripts read only by the live server, never
  exported, with the path checks), `docs/file-format.md` (live record kinds, 72-hour logs),
  `docs/viewer.md` (the route and its security), `docs/concepts.md` (agent statuses).
- Files shared with features in flight, so the build runs after them: F-011 (`types.ts`,
  `live.ts`, `handlers.ts`, `test/core/live.test.ts`, `test/hooks/hooks.test.ts`,
  `docs/claude-code.md`, `docs/file-format.md`, `docs/viewer.md`, `docs/concepts.md`; it also
  provides `LiveMeta`, `readLiveMeta`, `updateLiveMeta` and `Session.goals`), F-008
  (`types.ts`, `docs/file-format.md`, `docs/viewer.md`), and F-007, F-010, F-012 and F-017
  (`types.ts` and docs).

## Invariants
- The new hooks exit 0 with empty stdout on every input, never return a permission decision,
  append at most one live record, and don't call `loadProject` or `buildIndex`.
- Live logs stay append-only JSONL. Logs written before this feature still summarize: their
  edits have `added`/`removed` `null`, they have no permission waits, and their statuses follow
  the same rules from `prompt`, `stop`, `end` and record times.
- Existing live fields keep their meaning: `LiveSession.current` is still the latest tool event
  of any agent, `stopped_at` the last Stop, `ended_at` the last SessionEnd, `events` the last 20
  tool events; `LiveAgent` keeps its F-005 fields.
- The index never carries a transcript path or transcript content (only `transcript: boolean`);
  exports keep `live: []`; `rev` still excludes `live`; the Hookline golden index is unchanged.
- The transcript route reads only a path recorded by a hook (the sidecar's `transcript_path`, a
  `subagent-stop` record's `transcript_path`) or the documented subagent file next to the
  recorded main transcript, only after its real path is a regular `.jsonl` file under one of the
  allowed roots, and never more than the window (plus a scan to the end of an oversized line).
- The route serves nothing without the per-launch token; `GET /api/index`, `/api/events` and
  the other routes don't change.
- `sessionOpen` still trusts a process ID for 24 hours, and `anySessionOpen` (viewer idle
  shutdown) still looks at logs from the last 24 hours.

## Assumptions
- Statuses, evaluated against `now` when the index is built: a subagent is `done` once it has a
  `subagent-stop` or its session ended; `waiting` while it has an open permission wait (these
  never expire); `done` when it has had no record for more than 30 minutes; `running`
  otherwise. The main agent is `done` when the session ended (an `end` after the latest
  `start`); `waiting` while it has an open permission wait (these never expire); `done` when
  the session has had no record for more than 30 minutes (idle or crashed); `waiting` with
  reason "Waiting for your next prompt" while its latest turn record (`start`, `prompt`, `stop`,
  `launch` or its own `tool`) is a `stop`; `running` otherwise. The session is `waiting` when
  any of its agents has an open permission wait, else `running` when any agent runs, else
  `waiting` when the main agent waits for your prompt, else `done`.
- A wait opens at a `wait` record and closes at the waiting agent's next `tool` record (failed
  ones too), or: for a subagent, its `subagent-stop`; for the main agent, the next `prompt` or
  `stop`; for a notification whose agent is unknown (no `agent_id`), the next `tool`, `prompt`,
  `stop` or `subagent-stop` of any agent; for everyone, `end` and `start`. A second wait of the
  same agent while one is open keeps the first `since` and takes the newer reason. A
  notification wait with an unknown agent is ignored while any wait of the session is open,
  because PermissionRequest fires about 6 s earlier for the same prompt; an unknown-agent wait
  belongs to the main agent.
- Idle spans run from a `stop` to the main agent's next `prompt`, `tool`, `launch` or `start`, or
  to `end`. When an agent becomes `done` by the 30-minute rule, its `ended_at` is its last record
  (the session's last record for the main agent), open spans close there and zero-length spans
  are dropped.
- Wait reasons: "Permission prompt: <tool> <target>" for PermissionRequest (target from
  `toolTarget`), "Permission prompt: <message>" for a notification, "Waiting for your next
  prompt" for an idle main agent.
- Caps keep the live section compact: 5 edits and 20 wait spans per agent (the latest, oldest
  first), 20 events per session (unchanged). Edits are successful Edit, MultiEdit, Write and
  NotebookEdit records with a file.
- The goal and skill come from the latest `## Goals` bullet (F-011): `- HH:MM · <skill> · <goal>`
  when the part before the second ` · ` has no spaces, else `- HH:MM · <goal>` with skill null;
  without bullets, the frontmatter `goal` (empty is null) and `skill`. A `ses` that isn't a
  session ID or has no file gives null for both.
- PermissionRequest is registered sync with a 5-second timeout, because an async hook's effect on
  a decision event isn't documented; with no output, Claude Code continues its normal flow.
  Notification and PostToolUseFailure are async: they can't block anyway.
- The Notification entry has no matcher and the handler filters on `notification_type`, so the
  feature doesn't depend on how Claude Code matches notification hooks (not checked); the other
  notification types cost one async no-op run each. Whether a notification carries `agent_id`
  for a subagent isn't documented, so the handler records it when present and null otherwise.
- Checked on 2026-10-20 against a local Claude Code transcript (the format is internal): an
  Edit's `toolUseResult.structuredPatch` holds hunks `{oldStart, oldLines, newStart, newLines,
  lines}` whose lines start with " ", "-" or "+"; a Write that creates a file has `type:
  "create"` and an empty `structuredPatch`; the Agent tool's `toolUseResult` has `agentId`; Bash's
  has `stdout` and `stderr`; subagent files are `<session>/subagents/agent-<id>.jsonl` with
  IDs of letters and digits. PostToolUse's `tool_response` is assumed to carry the same fields
  as `toolUseResult` (F-005 saw the Agent tool's `agentId` in both; not checked for Edit's
  `structuredPatch`), which is why `editSize` falls back to the input.
- `editSize` uses the patch when it has at least one hunk; otherwise Edit counts
  `new_string`/`old_string` lines, MultiEdit sums its `edits`, and Write counts `content` lines as
  added and 0 removed. A text's line count ignores a final newline, and "" has 0 lines.
- The transcript window is 512 KiB (524,288 bytes). Without `after`, the page holds the complete
  lines lying entirely in the file's last 512 KiB; with it, the complete lines from `after` within
  512 KiB. A forward read that finds no line end in the window scans on to the end of that line,
  skips it and reports `skipped: true`. Caps: diffs 80 lines (hunk headers included), output tails
  40 lines, message text 8,000 characters, any diff or output line 500 characters.
- Normalisation: an entry's `toolUseResult` belongs to its first `tool_result` block. Outputs are
  Bash's `stdout` then `stderr` (tail), the result text of a failed tool (tail), and a subagent's
  returned text (its first 40 lines); other successful tools have no output. A Write that created
  a file shows its content as added lines. A result whose call isn't in the same page becomes a
  `result` entry. Thinking blocks, `attachment`, `api-request*`, `summary` and unknown entry types
  are skipped, and so is a line that isn't JSON. Targets are display paths (relative in the
  project, `~` for home); message and output text is passed as written.
- Route statuses: 403 `token` without the right token (checked after the Host check); 400
  `invalid` for an `agent` that isn't `[A-Za-z0-9_-]{1,64}` or an `after` that isn't a whole
  number from 0 to the file size; 404 `not-found` for an unknown session, an agent absent from the
  live log, no recorded path, or a missing file; 403 `forbidden` when the real path isn't a
  regular `.jsonl` file under an allowed root. A session ID outside `[A-Za-z0-9_.-]{1,128}`
  doesn't match the route (404). Allowed roots: `$CLAUDE_CONFIG_DIR/projects` when set, and
  `~/.claude/projects`, both compared by real path.
- `transcript: true` means a recorded or derived path exists on disk; the route still refuses one
  outside the allowed roots. A subagent's `subagent-stop` path wins over the derived one.
- Time-based status changes reach the viewer through a refresh: while a client is connected, the
  server re-reads live sessions every 60 s and pushes `live` when any session's, main agent's or
  subagent's status differs from the last push.
