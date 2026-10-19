# F-011: Stories

## ST-011.1 · session start keeps one Azimuth session per Claude Code session
**Intent:** As an orchestrator running several skills in one Claude Code session, I want every `session start` to land in the same Azimuth session, so that a day of work leaves a few sessions instead of eighty.

### S-011.1.1 · A second start in the same Claude Code session reuses the open session {happy}
- **GIVEN** `startSession` created `SES-20261020-0900` at 2026-10-20T09:00:00Z with skill `spec`, goal "Spec F-011", touched `["F-011"]` and Claude Code session `c1`
- **WHEN** `startSession` runs at 2026-10-20T10:15:00Z with skill `build`, goal "Build F-011", touched `["F-011", "T-011.1"]` and Claude Code session `c1`
- **THEN** it returns `SES-20261020-0900`, `.azimuth/sessions/` holds only `SES-20261020-0900.md`, whose `goals` is `- 10:15 · build · Build F-011`, `skill` is `spec`, `goal` is "Spec F-011" and `touched` is `["F-011", "T-011.1"]`

### S-011.1.2 · Each reuse adds its goal below the last {happy}
- **GIVEN** the session of S-011.1.1 after its second start
- **WHEN** `startSession` runs at 2026-10-20T11:40:00Z with skill `null`, goal "Triage BUG-0003" and Claude Code session `c1`
- **THEN** it returns `SES-20261020-0900` and the session's `goals` is `- 10:15 · build · Build F-011\n- 11:40 · Triage BUG-0003`

### S-011.1.3 · A closed session is not reused {edge}
- **GIVEN** `SES-20261020-0900`, started in Claude Code session `c1` and closed with `ended_at` `2026-10-20T09:30:00Z`
- **WHEN** `startSession` runs at 2026-10-20T10:15:00Z with goal "Build F-011" and Claude Code session `c1`
- **THEN** it returns `SES-20261020-1015`, `readLiveMeta(root, "c1").ses` is `SES-20261020-1015`, and `SES-20261020-0900`'s `ended_at` is still `2026-10-20T09:30:00Z`

### S-011.1.4 · Another Claude Code session gets its own session {edge}
- **GIVEN** `SES-20261020-0900` open in Claude Code session `c1`
- **WHEN** `startSession` runs at 2026-10-20T09:00:30Z with goal "Review F-012" and Claude Code session `c2`
- **THEN** it returns `SES-20261020-0900-2`

### S-011.1.5 · Without a Claude Code session ID every start creates a session {negative}
- **GIVEN** a project with no session files
- **WHEN** `startSession` runs twice at 2026-10-20T09:00:00Z with goal "Triage" and Claude Code session `null`
- **THEN** it returns `SES-20261020-0900` and then `SES-20261020-0900-2`, and both sessions have `goals` `""`

### S-011.1.6 · The CLI prints the reused ID {happy}
- **GIVEN** `CLAUDE_CODE_SESSION_ID=c1` and `azimuth session start --skill spec --goal "Spec F-011"` printed an ID
- **WHEN** `azimuth session start --skill build --goal "Build F-011" --touch F-011` runs with the same environment
- **THEN** it exits 0 and prints the same line as the first start, and `.azimuth/sessions/` holds one file

## ST-011.2 · A sidecar keeps the Claude Code session's start and Azimuth session
**Intent:** As the CLI and the viewer, I want a Claude Code session's start time and Azimuth session kept outside the live log's tail, so that long sessions don't lose them.

### S-011.2.1 · The sidecar merges what each writer knows {happy}
- **GIVEN** no sidecar for Claude Code session `c1`
- **WHEN** `updateLiveMeta(root, "c1", …)` runs with `{ started_at: "2026-10-20T09:00:00Z", transcript_path: "/tmp/t1.jsonl" }`, then `{ ses: "SES-20261020-0900" }`, then `{ started_at: "2026-10-20T11:00:00Z", transcript_path: "/tmp/t2.jsonl" }`
- **THEN** `readLiveMeta(root, "c1")` returns `{ started_at: "2026-10-20T09:00:00Z", ses: "SES-20261020-0900", transcript_path: "/tmp/t2.jsonl" }` and `liveMetaFile(root, "c1")` is `<liveDir>/c1.meta.json`

### S-011.2.2 · A missing or unreadable sidecar reads as null {negative}
- **GIVEN** no sidecar for `c1`, and a sidecar for `c2` that contains `{not json`
- **WHEN** `readLiveMeta` reads `c1` and `c2`
- **THEN** both return `null`

### S-011.2.3 · Live sessions take the Azimuth session and start time from the sidecar {happy}
- **GIVEN** a live log for `c1` holding only `tool` records from 2026-10-20T11:00:00Z to 11:05:00Z, and a sidecar `{ started_at: "2026-10-20T09:00:00Z", ses: "SES-20261020-0900", transcript_path: null }`
- **WHEN** `readLiveSessions(root, now)` runs at 2026-10-20T11:06:00Z
- **THEN** `c1`'s live session has `started_at` `2026-10-20T09:00:00Z` and `ses` `SES-20261020-0900`

### S-011.2.4 · Without a sidecar the tail still answers {edge}
- **GIVEN** records `start` at 2026-10-20T09:00:00Z, `session` `SES-20261020-0900` at 09:01:00Z and `tool` at 09:02:00Z
- **WHEN** `summarizeLive("c1", records, null)` runs
- **THEN** its `started_at` is `2026-10-20T09:00:00Z` and its `ses` is `SES-20261020-0900`

### S-011.2.5 · The current session survives a long live log {happy}
- **GIVEN** `startSession` created `SES-20261020-0900` in Claude Code session `c1`, followed by 1,000 `tool` records in `c1`'s live log (more than 64 KB)
- **WHEN** `currentSession(root, { CLAUDE_CODE_SESSION_ID: "c1" })` runs
- **THEN** it returns `SES-20261020-0900`

### S-011.2.6 · AZIMUTH_SESSION still wins {edge}
- **GIVEN** the live log and sidecar of S-011.2.5
- **WHEN** `currentSession(root, { AZIMUTH_SESSION: "SES-20261019-0800", CLAUDE_CODE_SESSION_ID: "c1" })` runs
- **THEN** it returns `SES-20261019-0800`

### S-011.2.7 · Without a sidecar the current session comes from the tail {edge}
- **GIVEN** a live log for `c2` with a `session` record for `SES-20261020-0900` and no sidecar
- **WHEN** `currentSession(root, { CLAUDE_CODE_SESSION_ID: "c2" })` runs
- **THEN** it returns `SES-20261020-0900`

## ST-011.3 · session note records running progress
**Intent:** As an orchestrator, I want to append short progress notes to my session, so that the viewer and the next session see what happened between handoffs.

### S-011.3.1 · The first note creates the Notes section {happy}
- **GIVEN** `SES-20261020-0900` with the template's empty Summary and Handoff sections and no Notes section
- **WHEN** `appendNote(root, "SES-20261020-0900", "T-011.2 green; starting T-011.3", now)` runs at 2026-10-20T10:30:00Z
- **THEN** it returns `.azimuth/sessions/SES-20261020-0900.md` and the file ends with `## Notes\n- 10:30 · T-011.2 green; starting T-011.3\n`

### S-011.3.2 · Later notes go below earlier ones and leave the other sections alone {happy}
- **GIVEN** the session of S-011.3.1 with the handoff "Finish T-011.3."
- **WHEN** `appendNote` runs at 2026-10-20T11:05:00Z with "T-011.3 green"
- **THEN** the session's `notes` is `- 10:30 · T-011.2 green; starting T-011.3\n- 11:05 · T-011.3 green` and its `handoff` is still "Finish T-011.3."

### S-011.3.3 · A note spanning lines becomes one bullet {edge}
- **GIVEN** `SES-20261020-0900` with no Notes section
- **WHEN** `appendNote` runs at 2026-10-20T10:30:00Z with "Done.\n\n  Next: T-011.4"
- **THEN** the session's `notes` is `- 10:30 · Done. Next: T-011.4`

### S-011.3.4 · The CLI appends to the current session {happy}
- **GIVEN** `CLAUDE_CODE_SESSION_ID=c1` and a session started with `azimuth session start --skill build --goal "Build F-011"` in that environment
- **WHEN** `azimuth session note "T-011.2 green"` runs with the same environment
- **THEN** it exits 0, prints `Updated .azimuth/sessions/<that ID>.md`, and the session's `notes` is one bullet `- <HH:MM> · T-011.2 green` with the current UTC time

### S-011.3.5 · A note without a current session {negative}
- **GIVEN** no `AZIMUTH_SESSION`, `AZIMUTH_CLAUDE_SESSION` or `CLAUDE_CODE_SESSION_ID`
- **WHEN** `azimuth session note "T-011.2 green"` runs
- **THEN** it exits 1 and stderr is ``✗ No current session. Start one with `azimuth session start` or pass --id.``

### S-011.3.6 · A note needs text {negative}
- **GIVEN** an open session `SES-20261020-0900`
- **WHEN** `azimuth session note --id SES-20261020-0900` runs without text
- **THEN** it exits 2 and stderr starts with `session note needs "<text>".`

### S-011.3.7 · An unknown action names note among the actions {edge}
- **GIVEN** an Azimuth project
- **WHEN** `azimuth session pause` runs
- **THEN** it exits 2 and stderr starts with `Unknown session action "pause". Use start, note, handoff or close.`

## ST-011.4 · Claude Code's end closes the Azimuth session
**Intent:** As the developer, I want the session to close itself when Claude Code ends, so that agents no longer spend a call on `session close` and sessions don't stay open.

### S-011.4.1 · SessionEnd closes the open session and collects its commits {happy}
- **GIVEN** a git repository, `SES-20261020-0900` started at 2026-10-20T09:00:00Z in Claude Code session `c1` (its sidecar `ses`), and a commit at 2026-10-20T09:30:00Z with `Refs: T-011.1`
- **WHEN** the session-end hook runs for `c1` with reason `prompt_input_exit` at 2026-10-20T10:00:00Z
- **THEN** it exits 0 with no output, `c1`'s live log ends with `{kind: "end", at: "2026-10-20T10:00:00Z", reason: "prompt_input_exit"}`, and the session has `ended_at` `2026-10-20T10:00:00Z`, `commits` `[<that commit's SHA>]` and `T-011.1` in `touched`

### S-011.4.2 · A session already closed is left alone {edge}
- **GIVEN** the session of S-011.4.1 closed by `closeSession` with `ended_at` `2026-10-20T09:45:00Z`
- **WHEN** the session-end hook runs for `c1` at 2026-10-20T10:00:00Z
- **THEN** its `ended_at` is still `2026-10-20T09:45:00Z`

### S-011.4.3 · A Claude Code session without an Azimuth session only records the end {negative}
- **GIVEN** Claude Code session `c3` with a live log, no sidecar `ses` and no `session` record, and an open `SES-20261020-0900` started in `c1`
- **WHEN** the session-end hook runs for `c3`
- **THEN** it exits 0 with no output, `c3`'s live log ends with an `end` record, and `SES-20261020-0900`'s `ended_at` is still `null`

### S-011.4.4 · Closing fits the SessionEnd budget {edge}
- **GIVEN** the hooks test project with an open session started in Claude Code session `claude-session-1`
- **WHEN** the session-end hook runs through the launcher
- **THEN** it exits 0 in less than 1,500 ms and the session's `ended_at` is no longer `null`

### S-011.4.5 · Closing reads only the session's own file {edge}
- **GIVEN** an open session `SES-20261020-0900`
- **WHEN** `closeSession(root, "SES-20261020-0900", now)` runs
- **THEN** `loadProject` is called 0 times and the session's `ended_at` is `now`

## ST-011.5 · Active sessions are not reported as left open
**Intent:** As the developer, I want W-SESSION-OPEN and `session close --stale` to leave a long session alone while its Claude Code session is still working, so that they only name sessions that were really abandoned.

### S-011.5.1 · The sidecars name each Azimuth session's last activity {happy}
- **GIVEN** sidecars for `c1` (`ses` `SES-20261020-0900`, live log modified at 2026-10-20T11:30:00Z), `c2` (`ses` `null`, with a live log) and `c3` (`ses` `SES-20261019-0800`, no live log)
- **WHEN** `sessionsLastSeen(root)` runs
- **THEN** it returns a map with the single entry `SES-20261020-0900` → `2026-10-20T11:30:00Z`

### S-011.5.2 · A session whose Claude Code session was active within the hour isn't flagged {happy}
- **GIVEN** open session `SES-20261019-2000` started at 2026-10-19T20:00:00Z, `facts.now` 2026-10-20T12:00:00Z and `facts.sesLastSeen` mapping it to `2026-10-20T11:30:00Z`
- **WHEN** the project is validated
- **THEN** no `W-SESSION-OPEN` problem names `SES-20261019-2000`

### S-011.5.3 · A session whose Claude Code session went quiet is flagged {negative}
- **GIVEN** the session and time of S-011.5.2 with `facts.sesLastSeen` mapping it to `2026-10-20T10:30:00Z`
- **WHEN** the project is validated
- **THEN** there is one `W-SESSION-OPEN` problem for `SES-20261019-2000` with the message ``SES-20261019-2000 was never closed. Run `azimuth session close --stale`.``

### S-011.5.4 · A session without a known Claude Code session keeps the 12-hour rule {edge}
- **GIVEN** open sessions `SES-20261019-2000` (started 2026-10-19T20:00:00Z) and `SES-20261020-0100` (started 2026-10-20T01:00:00Z), `facts.now` 2026-10-20T12:00:00Z and an empty `facts.sesLastSeen`
- **WHEN** the project is validated
- **THEN** `W-SESSION-OPEN` problems name exactly `["SES-20261019-2000"]`

### S-011.5.5 · close --stale skips an active session {happy}
- **GIVEN** open sessions `SES-20261019-2000` (named by `c1`'s sidecar, live log modified at 2026-10-20T11:30:00Z) and `SES-20261019-1900` (started 2026-10-19T19:00:00Z, no Claude Code session)
- **WHEN** `closeStaleSessions(root, now)` runs at 2026-10-20T12:00:00Z
- **THEN** it returns `[".azimuth/sessions/SES-20261019-1900.md"]`, `SES-20261019-1900` has `ended_at` `2026-10-20T07:00:00Z`, and `SES-20261019-2000`'s `ended_at` is still `null`

### S-011.5.6 · A stale long session ends at its Claude Code session's last activity {edge}
- **GIVEN** open session `SES-20261019-2000` started at 2026-10-19T20:00:00Z, named by `c1`'s sidecar, whose live log was last modified at 2026-10-20T10:00:00Z
- **WHEN** `closeStaleSessions(root, now)` runs at 2026-10-20T12:00:00Z
- **THEN** the session's `ended_at` is `2026-10-20T10:00:00Z`

## ST-011.6 · The viewer shows a session's goals and notes
**Intent:** As the developer, I want a session card to list the goals and notes of a long session, so that I can follow what one Claude Code session did.

### S-011.6.1 · Goals and Notes sections are parsed {happy}
- **GIVEN** a session file whose body has `## Summary`, `## Handoff`, `## Goals` with `- 10:15 · build · Build F-011` and `## Notes` with `- 10:30 · T-011.2 green`
- **WHEN** `parseSession` reads it
- **THEN** `goals` is `- 10:15 · build · Build F-011`, `notes` is `- 10:30 · T-011.2 green` and `problems` is `[]`

### S-011.6.2 · Sessions without them parse as before {edge}
- **GIVEN** a session file with only `## Summary` and `## Handoff`
- **WHEN** `parseSession` reads it
- **THEN** `goals` is `""`, `notes` is `""` and `problems` is `[]`

### S-011.6.3 · An expanded card shows goals and notes {happy}
- **GIVEN** an expanded `SessionCard` for a session with handoff "Build T-011.3 next.", goals `- 10:15 · build · Build F-011` and notes `- 10:30 · T-011.2 green`
- **WHEN** it renders
- **THEN** the markup has a section with `aria-label="Goals"` containing "10:15 · build · Build F-011" and then a section with `aria-label="Notes"` containing "10:30 · T-011.2 green", both after the handoff section

### S-011.6.4 · A card without goals or notes shows neither {edge}
- **GIVEN** an expanded `SessionCard` for a session with goals `""` and notes `""`
- **WHEN** it renders
- **THEN** the markup contains neither `aria-label="Goals"` nor `aria-label="Notes"`

## ST-011.7 · SessionStart fills the sidecar
**Intent:** As F-014 and the compaction note, I want SessionStart to record when the Claude Code session started and where its transcript is, so that both survive any amount of activity.

### S-011.7.1 · The first start sets the start time and each start the transcript {happy}
- **GIVEN** no sidecar for Claude Code session `c4`
- **WHEN** the session-start hook runs for `c4` with source `startup` and transcript_path `/tmp/c4.jsonl` at 2026-10-20T09:00:00Z, then with source `compact` and transcript_path `/tmp/c4-b.jsonl` at 2026-10-20T11:00:00Z
- **THEN** `readLiveMeta(root, "c4")` returns `{ started_at: "2026-10-20T09:00:00Z", ses: null, transcript_path: "/tmp/c4-b.jsonl" }`

### S-011.7.2 · A start without a transcript path keeps the known one {edge}
- **GIVEN** `c4`'s sidecar with transcript_path `/tmp/c4.jsonl`
- **WHEN** the session-start hook runs for `c4` with source `resume` and no transcript_path
- **THEN** `readLiveMeta(root, "c4").transcript_path` is `/tmp/c4.jsonl`

### S-011.7.3 · The compaction note names the session from the sidecar {happy}
- **GIVEN** `c4`'s sidecar with `ses` `SES-20261020-0900` and a live log without any `session` record
- **WHEN** the session-start hook runs for `c4` with source `compact`
- **THEN** its `additionalContext` contains the line `- You are in Azimuth session SES-20261020-0900.`
