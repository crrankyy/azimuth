# F-014: Stories

Times written as `10:02:00` are on 2026-10-20 UTC; records are live records in order.

## ST-014.1 · Hooks record when an agent waits on you
**Intent:** As the viewer, I want a live record each time Claude Code asks you for permission, so that the Agents tab can say which agent waits on you and why.

### S-014.1.1 · A permission request of the main agent is recorded {happy}
- **GIVEN** a permission-request hook input for Claude Code session `f014-perm` with tool_name `Bash`, tool_input `{command: "pnpm vitest run\npnpm lint"}` and no agent_id
- **WHEN** the permission-request hook runs through the launcher
- **THEN** it exits 0 with empty stdout, and the session's live log ends with a record matching `{kind: "wait", source: "permission", reason: "Permission prompt: Bash pnpm vitest run", tool: "Bash", target: "pnpm vitest run", agent_id: null}`

### S-014.1.2 · A subagent's permission request names the subagent {happy}
- **GIVEN** a permission-request hook input for session `f014-perm-agent` with tool_name `Edit`, tool_input `{file_path: "<project root>/src/app.ts"}` and agent_id `a1`
- **WHEN** the permission-request hook runs through the launcher
- **THEN** the live log ends with a record matching `{kind: "wait", source: "permission", reason: "Permission prompt: Edit src/app.ts", tool: "Edit", target: "src/app.ts", agent_id: "a1"}`

### S-014.1.3 · A permission-prompt notification is recorded {happy}
- **GIVEN** a notification hook input for session `f014-note` with notification_type `permission_prompt`, message "Claude needs your permission to use WebFetch" and no agent_id
- **WHEN** the notification hook runs through the launcher
- **THEN** it exits 0 with empty stdout and the live log ends with a record matching `{kind: "wait", source: "notification", reason: "Permission prompt: Claude needs your permission to use WebFetch", tool: null, target: null, agent_id: null}`

### S-014.1.4 · Other notifications record nothing {negative}
- **GIVEN** a notification hook input for session `f014-idle` with notification_type `idle_prompt` and message "Claude is waiting for your input"
- **WHEN** the notification hook runs through the launcher
- **THEN** it exits 0 with empty stdout and `readLiveRecords(root, "f014-idle")` is `[]`

### S-014.1.5 · The plugin registers the new hooks {edge}
- **GIVEN** `plugin/hooks/hooks.json`
- **WHEN** it is parsed
- **THEN** `hooks.PermissionRequest[0].hooks[0]` is `{type: "command", command: "\"${CLAUDE_PLUGIN_ROOT}/bin/azimuth\" hook permission-request", timeout: 5}`, `hooks.Notification[0]` has no matcher and one hook whose command ends with `hook notification` and whose `async` is `true`, and `hooks.PostToolUseFailure[0]` has matcher `*` and one hook whose command ends with `hook post-tool-use-failure` and whose `async` is `true`

## ST-014.2 · Hooks record failed tools, edit sizes and subagent transcripts
**Intent:** As the viewer, I want failed tools, the size of each edit and each subagent's transcript path in the live log, so that agents' actions and transcripts can be shown.

### S-014.2.1 · A failed tool is recorded with the first line of its error {happy}
- **GIVEN** a post-tool-use-failure hook input for session `f014-fail` with tool_name `Bash`, tool_input `{command: "pnpm build"}`, error "Exit code 1\nsrc/a.ts(3,1): error TS2304" and agent_id `a1`
- **WHEN** the post-tool-use-failure hook runs through the launcher
- **THEN** it exits 0 with empty stdout and the live log ends with a record matching `{kind: "tool", tool: "Bash", file: null, summary: "pnpm build", agent_id: "a1", failed: true, error: "Exit code 1"}`

### S-014.2.2 · An edit records the lines it added and removed {happy}
- **GIVEN** a post-tool-use hook input for session `f014-edit` with tool_name `Edit`, tool_input `{file_path: "<project root>/src/app.ts", old_string: "b", new_string: "c\nd"}` and tool_response `{structuredPatch: [{oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [" a", "-b", "+c", "+d", " e"]}]}`
- **WHEN** the post-tool-use hook runs through the launcher
- **THEN** the live log ends with a record matching `{kind: "tool", tool: "Edit", file: "src/app.ts", added: 2, removed: 1}`

### S-014.2.3 · Other tools record no size {negative}
- **GIVEN** a post-tool-use hook input for session `f014-read` with tool_name `Read` and tool_input `{file_path: "<project root>/src/app.ts"}`
- **WHEN** the post-tool-use hook runs through the launcher
- **THEN** the last record has kind `tool` and neither an `added` nor a `removed` key

### S-014.2.4 · A finishing subagent keeps its transcript path {happy}
- **GIVEN** a subagent-stop hook input for session `f014-sub` with agent_id `a1` and agent_transcript_path `/home/dev/.claude/projects/-work-demo/c1/subagents/agent-a1.jsonl`
- **WHEN** the subagent-stop hook runs through the launcher
- **THEN** the live log ends with a record matching `{kind: "subagent-stop", agent_id: "a1", transcript_path: "/home/dev/.claude/projects/-work-demo/c1/subagents/agent-a1.jsonl"}`

### S-014.2.5 · A subagent stop without a transcript path {edge}
- **GIVEN** a subagent-stop hook input for session `f014-sub-none` with agent_id `a2` and no agent_transcript_path
- **WHEN** the subagent-stop hook runs through the launcher
- **THEN** the live log ends with a record matching `{kind: "subagent-stop", agent_id: "a2", transcript_path: null}`

## ST-014.3 · One rule for an edit's size and a call's target
**Intent:** As the hooks and the transcript reader, I want one rule for how many lines an edit changed and what a call acts on, so that the Agents tab and the transcript agree.

### S-014.3.1 · The structured patch decides an edit's size {happy}
- **GIVEN** tool `Edit`, input `{old_string: "x", new_string: "y"}` and a response whose structuredPatch has two hunks with lines `[" a", "-b", "+c", "+d"]` and `["-e", " f"]`
- **WHEN** `editSize` runs
- **THEN** it returns `{added: 2, removed: 2}`

### S-014.3.2 · A created file counts its content {edge}
- **GIVEN** tool `Write`, input `{file_path: "a.ts", content: "x\ny\nz\n"}` and response `{type: "create", structuredPatch: []}`
- **WHEN** `editSize` runs
- **THEN** it returns `{added: 3, removed: 0}`

### S-014.3.3 · Without a response the input decides {edge}
- **GIVEN** tool `MultiEdit`, input `{edits: [{old_string: "a", new_string: "b\nc"}, {old_string: "d\ne", new_string: ""}]}` and response `undefined`
- **WHEN** `editSize` runs
- **THEN** it returns `{added: 2, removed: 3}`

### S-014.3.4 · Tools that don't edit text have no size {negative}
- **GIVEN** tool `NotebookEdit` with input `{notebook_path: "n.ipynb", new_source: "x"}`, and tool `Read` with input `{file_path: "a.ts"}`
- **WHEN** `editSize` runs for each with response `undefined`
- **THEN** both return `null`

### S-014.3.5 · Each tool's target {happy}
- **GIVEN** root `/home/dev/work/tally`, home `/home/dev` and the calls Bash `{command: "cat /home/dev/work/tally/src/a.ts\nls"}`, Edit `{file_path: "/home/dev/notes.md"}`, WebFetch `{url: "https://prometheus.io/docs/"}`, Agent `{description: "Find callers"}` and Skill `{skill: "x"}`
- **WHEN** `toolTarget` runs for each
- **THEN** it returns `"cat src/a.ts"`, `"~/notes.md"`, `"prometheus.io"`, `"Find callers"` and `""`

## ST-014.4 · Waits open and close per agent
**Intent:** As the Agents tab, I want to know exactly which agent waits on you and since when, so that a prompt waiting in Claude Code is never missed and never shown after it was answered.

### S-014.4.1 · A permission request makes its agent wait {happy}
- **GIVEN** records `start` at 10:00:00, `subagent a1` at 10:00:10, a `tool` of a1 at 10:01:00 and a `wait` (source permission, agent a1, reason "Permission prompt: Bash pnpm build") at 10:02:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** agent a1 has status `waiting`, waiting `{reason: "Permission prompt: Bash pnpm build", since: "2026-10-20T10:02:00Z"}` and waits `[{from: "2026-10-20T10:02:00Z", to: null, reason: "Permission prompt: Bash pnpm build"}]`, and the session has status `waiting` with the same waiting

### S-014.4.2 · The agent's next tool ends the wait {happy}
- **GIVEN** the records of S-014.4.1 followed by a `tool` of a1 at 10:03:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** a1 has status `running`, waiting `null` and waits `[{from: "2026-10-20T10:02:00Z", to: "2026-10-20T10:03:00Z", reason: "Permission prompt: Bash pnpm build"}]`, and the session has status `running` and waiting `null`

### S-014.4.3 · Another agent's activity leaves the wait open {negative}
- **GIVEN** the records of S-014.4.1 followed by a main-agent `tool` at 10:03:00 and a `prompt` at 10:04:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** a1 has status `waiting` with since `2026-10-20T10:02:00Z`, and the session has status `waiting`

### S-014.4.4 · A notification for an unknown agent ends at any agent's next record {edge}
- **GIVEN** records `start` at 10:00:00, a main-agent `tool` at 10:01:00, `subagent a1` at 10:01:30, a `wait` (source notification, no agent, reason "Permission prompt: Claude needs your permission to use Bash") at 10:02:00 and a `tool` of a1 at 10:03:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** the main agent has waiting `null` and waits `[{from: "2026-10-20T10:02:00Z", to: "2026-10-20T10:03:00Z", reason: "Permission prompt: Claude needs your permission to use Bash"}]`

### S-014.4.5 · A notification during an open permission wait adds nothing {edge}
- **GIVEN** records `start` at 10:00:00, `subagent a1` at 10:00:10, a `wait` (source permission, agent a1) at 10:02:00 and a `wait` (source notification, no agent) at 10:02:06
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** the main agent has status `running` and waits `[]`, and a1's waits are one span with from `2026-10-20T10:02:00Z` and to `null`

### S-014.4.6 · A repeated request keeps the first wait's start {edge}
- **GIVEN** records `start` at 10:00:00, a `wait` (source permission, no agent, reason "Permission prompt: Bash pnpm build") at 10:02:00 and a `wait` (source permission, no agent, reason "Permission prompt: Bash pnpm lint") at 10:02:30
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** the main agent has waiting `{reason: "Permission prompt: Bash pnpm lint", since: "2026-10-20T10:02:00Z"}` and waits `[{from: "2026-10-20T10:02:00Z", to: null, reason: "Permission prompt: Bash pnpm lint"}]`

## ST-014.5 · Running, waiting on you and done
**Intent:** As the Agents tab and the timeline, I want every session and agent to carry one status by fixed rules, so that every view groups them the same way.

### S-014.5.1 · A main agent that finished its turn waits for your prompt {happy}
- **GIVEN** records `start` at 10:00:00, `prompt` at 10:00:05, a main-agent `tool` at 10:01:00 and `stop` at 10:02:00
- **WHEN** `deriveActivity` runs at 10:10:00
- **THEN** the main agent has status `waiting`, waiting `{reason: "Waiting for your next prompt", since: "2026-10-20T10:02:00Z"}` and waits `[{from: "2026-10-20T10:02:00Z", to: null, reason: "Waiting for your next prompt"}]`, and the session has status `waiting`

### S-014.5.2 · An idle session is done after 30 minutes {edge}
- **GIVEN** the records of S-014.5.1
- **WHEN** `deriveActivity` runs at 10:32:00 and at 10:32:01
- **THEN** the main agent's status is `waiting` at 10:32:00, and at 10:32:01 it is `done` with ended_at `2026-10-20T10:02:00Z`, waiting `null` and waits `[]`, and the session's status is `done`

### S-014.5.3 · Your next prompt ends the idle span {happy}
- **GIVEN** the records of S-014.5.1 followed by `prompt` at 10:12:00 and a main-agent `tool` at 10:12:30
- **WHEN** `deriveActivity` runs at 10:13:00
- **THEN** the main agent has status `running` and waits `[{from: "2026-10-20T10:02:00Z", to: "2026-10-20T10:12:00Z", reason: "Waiting for your next prompt"}]`

### S-014.5.4 · A subagent at work keeps an idle session running {edge}
- **GIVEN** records `start` at 10:00:00, `subagent a1` at 10:00:30, `stop` at 10:02:00 and a `tool` of a1 at 10:04:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** the main agent has status `waiting`, a1 has status `running`, and the session has status `running` and waiting `null`

### S-014.5.5 · A finished subagent is done at its stop {happy}
- **GIVEN** records `start` at 10:00:00, `subagent a1` at 10:00:30, a `tool` of a1 at 10:01:00 and `subagent-stop a1` at 10:04:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** a1 has status `done`, started_at `2026-10-20T10:00:30Z` and ended_at `2026-10-20T10:04:00Z`

### S-014.5.6 · An ended session is done with all its agents {happy}
- **GIVEN** records `start` at 10:00:00, `subagent a1` at 10:00:30, a `wait` (source permission, agent a1, reason "Permission prompt: Bash pnpm build") at 10:01:00 and `end` at 10:03:00
- **WHEN** `deriveActivity` runs at 10:05:00
- **THEN** the main agent and a1 have status `done` and ended_at `2026-10-20T10:03:00Z`, a1's waits are `[{from: "2026-10-20T10:01:00Z", to: "2026-10-20T10:03:00Z", reason: "Permission prompt: Bash pnpm build"}]`, and the session has status `done` and waiting `null`

### S-014.5.7 · A session that went quiet without stopping is done after 30 minutes {edge}
- **GIVEN** records `start` at 10:00:00 and a main-agent `tool` at 10:01:00
- **WHEN** `deriveActivity` runs at 10:31:00 and at 10:31:01
- **THEN** the main agent's status is `running` at 10:31:00, and at 10:31:01 it is `done` with ended_at `2026-10-20T10:01:00Z`

### S-014.5.8 · A permission wait doesn't expire {edge}
- **GIVEN** records `start` at 10:00:00 and a `wait` (source permission, no agent, reason "Permission prompt: WebFetch prometheus.io") at 10:02:00
- **WHEN** `deriveActivity` runs at 12:00:00
- **THEN** the main agent and the session have status `waiting` and waiting `{reason: "Permission prompt: WebFetch prometheus.io", since: "2026-10-20T10:02:00Z"}`

### S-014.5.9 · A resumed session runs again {edge}
- **GIVEN** records `start` at 10:00:00, `end` at 10:03:00, `start` (source resume) at 10:20:00 and a main-agent `tool` at 10:20:30
- **WHEN** `deriveActivity` runs at 10:21:00
- **THEN** the main agent has status `running` and ended_at `null`, and the session has status `running`

## ST-014.6 · Each agent's current action and recent edits
**Intent:** As the Agents tab, I want each agent's own latest action and the files it edited, so that I can see what every agent is doing and whether two of them edit the same file.

### S-014.6.1 · Current action and edits per agent {happy}
- **GIVEN** records `start` at 10:00:00, a main-agent `tool` Edit (file `src/a.ts`, summary "Edited src/a.ts", added 4, removed 1) at 10:01:00, `subagent a1` at 10:01:10, a `tool` Read of a1 (file `src/b.ts`) at 10:02:00 and a failed `tool` Edit of a1 (file `src/c.ts`, error "String to replace not found") at 10:03:00
- **WHEN** `deriveActivity` runs at 10:04:00
- **THEN** the main agent's current is `{at: "2026-10-20T10:01:00Z", tool: "Edit", file: "src/a.ts", summary: "Edited src/a.ts", agent_id: null, added: 4, removed: 1, error: null}` and its edits `[{file: "src/a.ts", at: "2026-10-20T10:01:00Z", added: 4, removed: 1}]`, and a1's current has tool `Edit`, file `src/c.ts` and error "String to replace not found" while its edits are `[]`

### S-014.6.2 · Only the last five edits are kept {edge}
- **GIVEN** records `start` at 10:00:00 and seven main-agent `tool` Write records for files `e1.ts` to `e7.ts` at 10:01:00 to 10:07:00
- **WHEN** `deriveActivity` runs at 10:08:00
- **THEN** the main agent's edits name the files `["e3.ts", "e4.ts", "e5.ts", "e6.ts", "e7.ts"]`

### S-014.6.3 · Logs written before this feature {edge}
- **GIVEN** records written before F-014: `start` at 10:00:00 and a main-agent `tool` Edit (file `src/a.ts`) at 10:01:00 without added, removed, failed or error, and no `wait` records
- **WHEN** `deriveActivity` runs at 10:02:00
- **THEN** the main agent has status `running`, waits `[]`, edits `[{file: "src/a.ts", at: "2026-10-20T10:01:00Z", added: null, removed: null}]` and a current event with added, removed and error `null`

## ST-014.7 · Live sessions in the index
**Intent:** As the viewer, I want every live session of the last three days with its agents' activity, transcripts and Azimuth goal, so that the Agents tab and the timeline read them from the index.

### S-014.7.1 · A live session carries its activity and latest goal {happy}
- **GIVEN** a session file `SES-20261020-1000` with skill `spec`, goal "Spec F-014" and a `## Goals` section `- 10:30 · build · Build F-014`, and a live log `c1` with `start` at 10:00:00, `session SES-20261020-1000` at 10:00:05, `subagent a1` at 10:31:00 and a `tool` of a1 at 10:32:00
- **WHEN** `readLiveSessions(root, now)` runs at 10:33:00
- **THEN** c1 has goal "Build F-014", skill `build`, status `running` and main status `running`, and its agent a1 has status `running` and started_at `2026-10-20T10:31:00Z`

### S-014.7.2 · The goal falls back to the session's own, or to nothing {negative}
- **GIVEN** a live log `c2` whose `session` record names `SES-20261020-0900` (skill `build`, goal "Build F-011", no Goals section), and a live log `c3` whose `session` record names `SES-20261019-0800`, which has no file
- **WHEN** `readLiveSessions(root, now)` runs
- **THEN** c2 has goal "Build F-011" and skill `build`, and c3 has goal `null` and skill `null`

### S-014.7.3 · Live logs are kept for three days {edge}
- **GIVEN** live logs `old.jsonl` last modified 73 hours ago and `recent.jsonl` last modified 48 hours ago, each with one `start` record
- **WHEN** `readLiveSessions(root)` runs, then `pruneLive(root)`
- **THEN** readLiveSessions returns only the session `recent`, and afterwards `old.jsonl` is deleted and `recent.jsonl` is kept

### S-014.7.4 · Transcripts are flagged when their file exists {happy}
- **GIVEN** a sidecar for `c1` whose transcript_path is `<tmp>/projects/-demo/c1.jsonl` (a file), c1's live log with `subagent a1` and `subagent a2`, a file `<tmp>/projects/-demo/c1/subagents/agent-a1.jsonl` and none for a2
- **WHEN** `readLiveSessions(root, now)` runs
- **THEN** c1's `main.transcript` is `true`, a1's `transcript` is `true` and a2's `transcript` is `false`

### S-014.7.5 · A subagent's recorded transcript path wins {edge}
- **GIVEN** the sidecar of S-014.7.4 and records with a `subagent-stop` of a2 whose transcript_path is `<tmp>/other/agent-a2.jsonl`
- **WHEN** `transcriptPathOf(meta, records, "a2")` and `transcriptPathOf(meta, records, "a1")` run
- **THEN** they return `<tmp>/other/agent-a2.jsonl` and `<tmp>/projects/-demo/c1/subagents/agent-a1.jsonl`

### S-014.7.6 · A session without a sidecar has no transcript {negative}
- **GIVEN** a live log `c4` with `start` and `subagent a1`, and no sidecar
- **WHEN** `readLiveSessions(root, now)` runs and `transcriptPathOf(null, records, "a1")` runs
- **THEN** c4's `main.transcript` and a1's `transcript` are `false`, and transcriptPathOf returns `null`

### S-014.7.7 · An agent ID that isn't a plain name gets no path {negative}
- **GIVEN** the sidecar of S-014.7.4
- **WHEN** `transcriptPathOf(meta, records, "../a1")` runs
- **THEN** it returns `null`

## ST-014.8 · Reading a window of a transcript
**Intent:** As the transcript route, I want to read a bounded window of complete lines from the end or from an offset, so that transcripts of 90 MB can be followed live.

### S-014.8.1 · The tail of a small transcript is read whole {happy}
- **GIVEN** a file holding `{"n":1}\n{"n":2}\n{"n":3}\n` (24 bytes)
- **WHEN** `readTranscriptWindow(path, null)` runs
- **THEN** it returns lines `['{"n":1}', '{"n":2}', '{"n":3}']`, next `24` and skipped `false`

### S-014.8.2 · A line still being written is left for later {edge}
- **GIVEN** a file holding `{"n":1}\n{"n":2}\n{"n":` (21 bytes)
- **WHEN** `readTranscriptWindow(path, null)` runs
- **THEN** it returns lines `['{"n":1}', '{"n":2}']`, next `16` and skipped `false`

### S-014.8.3 · A tail window starts at a line boundary {edge}
- **GIVEN** the 24-byte file of S-014.8.1
- **WHEN** `readTranscriptWindow(path, null, 12)` runs
- **THEN** it returns lines `['{"n":3}']`, next `24` and skipped `true`

### S-014.8.4 · Reading on from an offset {happy}
- **GIVEN** the 24-byte file of S-014.8.1
- **WHEN** `readTranscriptWindow(path, 8)` runs
- **THEN** it returns lines `['{"n":2}', '{"n":3}']`, next `24` and skipped `false`

### S-014.8.5 · Reading forward stops at the window {edge}
- **GIVEN** the 24-byte file of S-014.8.1
- **WHEN** `readTranscriptWindow(path, 0, 12)` runs
- **THEN** it returns lines `['{"n":1}']`, next `8` and skipped `false`

### S-014.8.6 · A line longer than the window is skipped whole {edge}
- **GIVEN** a file holding a 38-character line `{"x":"` + 30 × `a` + `"}` and `\n`, followed by `{"n":2}\n` (47 bytes)
- **WHEN** `readTranscriptWindow(path, 0, 16)` runs, then `readTranscriptWindow(path, 39, 16)`
- **THEN** the first returns lines `[]`, next `39` and skipped `true`, and the second returns lines `['{"n":2}']`, next `47` and skipped `false`

### S-014.8.7 · An offset past the end is refused {negative}
- **GIVEN** the 24-byte file of S-014.8.1
- **WHEN** `readTranscriptWindow(path, 25)` runs
- **THEN** it throws an AzimuthError with code `invalid` and message "after must be a byte offset between 0 and 24."

## ST-014.9 · Normalised transcript entries
**Intent:** As the Live transcript page, I want transcript lines turned into messages, tool calls with their results and subagent cards, so that the viewer never parses Claude Code's internal format.

### S-014.9.1 · The main fixture becomes messages, tools and a subagent card {happy}
- **GIVEN** the lines of `test/fixtures/transcripts/c1.jsonl`, root `/work/demo` and home `/home/dev`
- **WHEN** `normalizeTranscript` runs
- **THEN** it returns 8 entries of kinds `["message", "message", "tool", "tool", "tool", "spawn", "tool", "tool"]`; `toolu_read` has target `src/a.ts` and status `ok`; `toolu_edit` has diff `{lines: ["@@ -1,3 +1,4 @@", " a", "-b", "+c", "+d", " e"], added: 2, removed: 1, truncated: false}`; `toolu_bash` has summary "Run the tests" and output `{lines: ["RUN v3", "✓ S-001.1.1 adds", "Test Files 1 passed"], truncated: false}`; the spawn has description "Find callers", agent_type `Explore`, agent_id `a1`, status `ok` and output `{lines: ["Found 1 caller: src/b.ts"], truncated: false}`; `toolu_fail` has status `error` and output lines `["Exit code 1", "src/a.ts:3 error"]`; `toolu_run` has status `running` and output `null`

### S-014.9.2 · Thinking, unknown entries, malformed lines and file contents never pass {negative}
- **GIVEN** the lines of `test/fixtures/transcripts/c1.jsonl`
- **WHEN** `normalizeTranscript` runs
- **THEN** `JSON.stringify(entries)` contains none of "FIXTURE-THINKING", "FIXTURE-ATTACHMENT", "FIXTURE-FILE-TEXT", "FIXTURE-ORIGINAL-FILE" and "FIXTURE-SUMMARY"

### S-014.9.3 · A result whose call is outside the page {edge}
- **GIVEN** the fixture's lines from line 7 (the Edit's result) onward
- **WHEN** `normalizeTranscript` runs
- **THEN** its first entry is `{kind: "result", tool_use_id: "toolu_edit", status: "ok", diff: {lines: ["@@ -1,3 +1,4 @@", " a", "-b", "+c", "+d", " e"], added: 2, removed: 1, truncated: false}, output: null, agent_id: null, at: "2026-10-20T10:00:11.000Z"}`

### S-014.9.4 · Long diffs and outputs are capped {edge}
- **GIVEN** a Bash call whose result's stdout is the 100 lines `line 1` to `line 100`, and an Edit whose result's structuredPatch is one hunk `{oldStart: 1, oldLines: 0, newStart: 1, newLines: 120}` with the 120 lines `+n1` to `+n120`
- **WHEN** `normalizeTranscript` runs
- **THEN** the Bash output has 40 lines from `line 61` to `line 100` and truncated `true`, and the Edit's diff has 80 lines, the first being `@@ -1,0 +1,120 @@`, with added `120`, removed `0` and truncated `true`

### S-014.9.5 · A created file shows its content as added lines {edge}
- **GIVEN** a Write call with input content "x\ny\n" whose result's toolUseResult is `{type: "create", filePath: "/work/demo/b.ts", content: "x\ny\n", structuredPatch: []}`
- **WHEN** `normalizeTranscript` runs
- **THEN** its entry has target `b.ts` and diff `{lines: ["+x", "+y"], added: 2, removed: 0, truncated: false}`

### S-014.9.6 · A subagent's transcript {happy}
- **GIVEN** the lines of `test/fixtures/transcripts/c1/subagents/agent-a1.jsonl`
- **WHEN** `normalizeTranscript` runs
- **THEN** it returns entries of kinds `["message", "tool", "message"]`, the tool has name `Grep`, target `decide\(` and status `ok`, and the last message has role `assistant` and text "Found 1 caller: src/b.ts"

## ST-014.10 · Serving transcripts to the live viewer
**Intent:** As the developer, I want the live viewer to read an agent's transcript through a guarded endpoint, so that it can follow agents without exposing other files or leaving this machine.

Unless a scenario says otherwise: a project whose live log `c1` has `start`, `subagent a1` and `subagent a2`; c1's sidecar transcript_path is `<tmp>/claude/projects/-demo/c1.jsonl`, a copy of the main fixture; `<tmp>/claude/projects/-demo/c1/subagents/agent-a1.jsonl` is a copy of the subagent fixture; the server runs with `transcriptRoots: ["<tmp>/claude/projects"]`; requests carry its token in `x-azimuth-token`.

### S-014.10.1 · The main transcript is served {happy}
- **GIVEN** the setup of this story
- **WHEN** `GET /api/transcript/c1` runs
- **THEN** it responds 200 with `ok: true`, `claude_session: "c1"`, `agent: null`, 8 entries, `next` equal to the copied transcript's size in bytes and `skipped: false`

### S-014.10.2 · A subagent's transcript is served from its documented location {happy}
- **GIVEN** the setup of this story
- **WHEN** `GET /api/transcript/c1?agent=a1` runs
- **THEN** it responds 200 with `agent: "a1"` and entries of kinds `["message", "tool", "message"]`

### S-014.10.3 · Following live returns only new lines {happy}
- **GIVEN** the `next` value N of S-014.10.1's response, and then one assistant entry with text "Done." appended to c1's transcript as a line of B bytes
- **WHEN** `GET /api/transcript/c1?after=N` runs
- **THEN** it responds 200 with one entry `{kind: "message", role: "assistant", text: "Done."}` (with its `at`), `next` N + B and `skipped: false`

### S-014.10.4 · Without the token nothing is served {negative}
- **GIVEN** the setup of this story
- **WHEN** `GET /api/transcript/c1` runs without the header, and again with `x-azimuth-token: wrong`
- **THEN** both respond 403 with `{ok: false, error: "token"}`

### S-014.10.5 · Files outside Claude Code's projects folders are refused {negative}
- **GIVEN** live logs `c2`, `c3` and `c5` whose sidecars point at `<tmp>/elsewhere/c2.jsonl` (a file), `<tmp>/claude/projects/-demo/c3.jsonl` (a symlink to `<tmp>/elsewhere/c2.jsonl`) and `<tmp>/claude/projects/-demo/c5.txt` (a file)
- **WHEN** `GET /api/transcript/c2`, `/api/transcript/c3` and `/api/transcript/c5` run
- **THEN** each responds 403 with `ok: false` and `error: "forbidden"`

### S-014.10.6 · Unknown sessions, agents and missing files are not found {negative}
- **GIVEN** the setup of this story, where a2 has no transcript file
- **WHEN** `GET /api/transcript/c9`, `/api/transcript/c1?agent=a9` and `/api/transcript/c1?agent=a2` run
- **THEN** each responds 404 with `ok: false` and `error: "not-found"`

### S-014.10.7 · A malformed offset or agent ID is invalid {negative}
- **GIVEN** the setup of this story
- **WHEN** `GET /api/transcript/c1` runs with `?after=-1`, `?after=abc`, `?after=<size + 1>` and `?agent=..%2Fa1`
- **THEN** each responds 400 with `ok: false` and `error: "invalid"`

### S-014.10.8 · A large transcript is served from its last 512 KiB {edge}
- **GIVEN** c1's transcript replaced by 700 assistant text entries of exactly 1,024 bytes per line (716,800 bytes)
- **WHEN** `GET /api/transcript/c1` runs
- **THEN** it responds 200 with 512 entries, `next` `716800` and `skipped: true`

### S-014.10.9 · Where transcripts may come from by default {happy}
- **GIVEN** the environment `{CLAUDE_CONFIG_DIR: "/cfg"}` and an empty environment, with home `/home/dev`
- **WHEN** `defaultTranscriptRoots` runs for each
- **THEN** it returns `["/cfg/projects", "/home/dev/.claude/projects"]` and `["/home/dev/.claude/projects"]`

### S-014.10.10 · An export holds no live sessions or transcripts {negative}
- **GIVEN** the project of this story, whose index has live session c1 with `main.transcript` `true`
- **WHEN** `exportHtml` writes a snapshot of that index
- **THEN** the snapshot's `live` is `[]` and the HTML contains neither "Reading the module first." nor "Found 1 caller"

## ST-014.11 · Statuses stay current while nothing happens
**Intent:** As the developer, I want a session that went quiet to turn done in the viewer on time, so that the Agents tab never shows an abandoned session as waiting on me.

### S-014.11.1 · An idle session turns done without new activity {happy}
- **GIVEN** a server with `statusRefreshMs` 100 and a clock at 10:20:00, a connected events client, and a live log `c1` with `start` at 10:00:00, `prompt` at 10:00:05 and `stop` at 10:02:00
- **WHEN** the clock moves to 10:32:01
- **THEN** within 2 s the client receives a `live` event in which c1 has status `done`

### S-014.11.2 · Nothing changes, nothing is pushed {negative}
- **GIVEN** the server and live log of S-014.11.1 with the clock staying at 10:20:00
- **WHEN** 1 s passes after the client receives `hello`
- **THEN** the client has received no `live` event
