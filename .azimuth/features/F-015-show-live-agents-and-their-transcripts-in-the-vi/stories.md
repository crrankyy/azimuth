# F-015: Stories

"The fixture" is `test/fixtures/live/agents.ts` (contract.md, Test fixture): `agentsLive()` in
`indexWithLive(…)`, rendered at `AGENTS_NOW` (2026-10-18 12:05:00 UTC) with `TZ=UTC` and a
`live` connection unless a scenario says otherwise.

## ST-015.1 · Agents in the sidebar and on the keyboard
**Intent:** As the developer, I want an Agents item under Inbox that counts the sessions still working, and `g a` to open it, so that I can get to my agents from anywhere.

### S-015.1.1 · The sidebar lists Agents under Inbox with the sessions not done {happy}
- **GIVEN** the fixture (two running, one waiting and three done sessions)
- **WHEN** the sidebar renders with current section `agents`
- **THEN** its second nav link is "Agents" with href `#/agents`, `aria-current="page"` and the count "3"

### S-015.1.2 · No count when no session is working {edge}
- **GIVEN** the fixture's three done sessions only (`c1100`, `c0930`, `c1430`)
- **WHEN** the sidebar renders
- **THEN** the Agents link's text is exactly "Agents" (no count)

### S-015.1.3 · `g a` goes to Agents and `g t` to Activity {happy}
- **GIVEN** the go-to map `GOTO`
- **WHEN** the keys `a` and `t` are looked up
- **THEN** `href(GOTO.a)` is `#/agents`, `href(GOTO.t)` is `#/activity`, and `t` is the only key mapped to `activity`

### S-015.1.4 · The palette offers Agents with its keys {happy}
- **GIVEN** the command palette open with an empty query
- **WHEN** it renders
- **THEN** its Go to items read "Inbox" (`g` `i`), then "Agents" (`g` `a`), and "Activity" shows `g` `t`

### S-015.1.5 · The footer strip follows the first session still working {happy}
- **GIVEN** the fixture
- **WHEN** the sidebar renders
- **THEN** the footer strip links to `#/agents`, reads "T-005.4 · pnpm vitest run src/retry/policy.test.ts" and has a mark labelled "Running"

### S-015.1.6 · A waiting session's strip says what it waits for {edge}
- **GIVEN** the fixture's sessions `c1140`, `c1100` and `c0930` only
- **WHEN** the sidebar renders
- **THEN** the footer strip reads "F-010 · Permission prompt: WebFetch prometheus.io" and has a mark labelled "Waiting on you"

### S-015.1.7 · Done sessions leave no strip {negative}
- **GIVEN** the fixture's session `c0930` only, done with `ended_at` null and `last_seen_at` changed to 30 seconds before now
- **WHEN** the sidebar renders
- **THEN** it has no element with class `live-strip`

## ST-015.2 · Every live session on the Agents screen
**Intent:** As the developer, I want each session that is running or waiting on me shown as a card with its subagents, and today's finished ones as rows, so that I can see at a glance who is doing what.

### S-015.2.1 · The header and the filter count sessions by status {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the header reads "3 sessions · 4 subagents" and "Live · 12:05", and the filter's buttons read "Active 3", "Running 2", "Waiting on you 1" and "Finished today 2", with "Active" pressed

### S-015.2.2 · Running, then waiting, then finished today {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the sections are, in order, "Running" (cards `SES-20261018-1201`, `SES-20261018-1202`), "Waiting on you" (`SES-20261018-1140`) and "Finished today" (rows `SES-20261018-1100`, `SES-20261018-0930`), and `SES-20261017-1430` appears nowhere

### S-015.2.3 · A running session's card {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the `SES-20261018-1201` card shows the mark and label "Running", the tag "build", "started 12:01 · 3m 56s", "Turn S-005.2.1 green: implement retry exhaustion", "Working on" with chips F-005 and T-005.4 and "Exhaustion & policy validation (red → green)", the action "Edit src/retry/policy.ts" with "+4", "−1" and "48s ago", and a "Transcript" link to `#/agents/c1201`

### S-015.2.4 · A waiting session's card says what it waits for {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the `SES-20261018-1140` card shows the label "Waiting on you", "Permission prompt: WebFetch prometheus.io · since 12:00" and no action line, and "Working on" F-010 "Prometheus metrics"

### S-015.2.5 · Each subagent in the tree {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the `SES-20261018-1201` card's tree has two links: `#/agents/c1201/a1` with "Running", "test-runner", "Re-run policy.test.ts after each edit", "pnpm vitest run src/retry/policy.test.ts" and "40s", then `#/agents/c1201/a2` with "Done", "explorer", "Find every caller of decideRetry()" and "1m 12s"

### S-015.2.6 · A session without an Azimuth session, goal or work {edge}
- **GIVEN** the fixture with `c1202` changed to `claude_session` "7f3a9c2e-1202-4b1d-9c55-0d1e2f3a4b5c", `ses`, `goal`, `skill`, `feature` and `task` null and `features` []
- **WHEN** `#/agents` renders
- **THEN** its card shows "7f3a9c2e", "No goal recorded", no tag, no "Working on" line, and its Transcript link is `#/agents/7f3a9c2e-1202-4b1d-9c55-0d1e2f3a4b5c`

### S-015.2.7 · An action without sizes, and a failed one {edge}
- **GIVEN** the fixture, and separately the fixture with `c1201`'s main `current` given `error` "Exit code 1"
- **WHEN** `#/agents` renders
- **THEN** the `SES-20261018-1202` card's action reads "Edit src/api/attempts.ts" and "21s ago" with no "+" or "−" count, and with the error the `SES-20261018-1201` action also shows "failed"

### S-015.2.8 · Sessions finished today as compact rows {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the first Finished today row links to `#/activity/SES-20261018-1100` and reads "Done", "SES-20261018-1100", "Build F-005 tasks T-005.2 to T-005.4 · 2 subagents · left a handoff" and "11:00–11:58", and the second reads "Write the F-008 spec · left a handoff" and "09:30–10:25"

### S-015.2.9 · A filter shows only its group {edge}
- **GIVEN** `agentGroups(agentsLive(), AGENTS_NOW)`
- **WHEN** `shownGroups` is called with `waiting`, then with `finished`
- **THEN** the first has `running` [], `waiting` [`c1140`] and `finished` []; the second has `running` [], `waiting` [] and `finished` [`c1100`, `c0930`]; and `filterCounts` gives `{active: 3, running: 2, waiting: 1, finished: 2}`

### S-015.2.10 · No agents, or a snapshot {negative}
- **GIVEN** an index with `live` [] on a live connection, and separately the fixture on an `export` connection
- **WHEN** `#/agents` renders
- **THEN** the first shows the empty state "No agent is working right now" with "Sessions show up here while Claude Code works.", and the second "Agents are only shown in the live viewer"

## ST-015.3 · What agents touch and what needs you
**Intent:** As the developer, I want the Agents side panel to show what is running, which files agents are editing, where features in flight overlap and which prompts wait on me, so that I can step in before agents collide or stall.

### S-015.3.1 · Counts right now {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** the "Right now" panel reads "Running" "2 sessions · 2 subagents", "Waiting on you" "1 session" and "Done today" "2 sessions · 4 subagents"

### S-015.3.2 · Files being edited without a conflict {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** "Files being edited" lists "src/retry/policy.ts" with "…1201" and "src/api/attempts.ts" with "…1202", then "No two agents are editing the same file"

### S-015.3.3 · Two agents editing the same file {negative}
- **GIVEN** the fixture with `c1202`'s subagent `a3` given an edit of `src/retry/policy.ts` at 12:04:31
- **WHEN** `editedFiles(live, [])` runs
- **THEN** `conflicts` is `[{path: "src/retry/policy.ts", editors: [{key: "c1201", label: "…1201", href: "#/agents/c1201"}, {key: "c1202/a3", label: "…1202 code-reviewer", href: "#/agents/c1202/a3"}]}]`

### S-015.3.4 · Shared files are not conflicts {edge}
- **GIVEN** the live sessions of S-015.3.3
- **WHEN** `editedFiles(live, ["src/retry/*.ts"])` runs
- **THEN** `conflicts` is [] and `files` still lists "src/retry/policy.ts" with both editors

### S-015.3.5 · Features in flight that plan the same file {happy}
- **GIVEN** the fixture (F-005 in flight in `c1201`, F-007 in `c1202`; Hookline's F-005 and F-007 conflict on `src/worker/deliver.ts`)
- **WHEN** `#/agents` renders
- **THEN** "Planned overlaps" reads "F-005 and F-007 both plan changes to src/worker/deliver.ts"

### S-015.3.6 · No overlap when one feature isn't in flight {negative}
- **GIVEN** the fixture with `c1202`'s status and its main agent's status set to `done` and its main agent's `ended_at` to 12:04:40
- **WHEN** `plannedOverlaps(index)` runs and `#/agents` renders
- **THEN** it returns [] and the panel reads "No in-flight features plan changes to the same file"

### S-015.3.7 · A permission prompt needs you {happy}
- **GIVEN** the fixture
- **WHEN** `#/agents` renders
- **THEN** "Needs you" has one link to `#/agents/c1140` reading "SES-20261018-1140 · 5m", "Permission prompt: WebFetch prometheus.io" and "Answer it in the Claude Code terminal running this session", and the panel contains no `<button>`

### S-015.3.8 · Waiting for your next prompt isn't a permission prompt {edge}
- **GIVEN** the fixture with `c1140`'s waits (session and main agent) given F-014's `IDLE_REASON` (imported from `src/core/live-agents.ts`) as their reason
- **WHEN** `needsYou(live)` runs and `#/agents` renders
- **THEN** it returns [] and the panel reads "Nothing is waiting on you", while `c1140` is still in the "Waiting on you" group

### S-015.3.9 · A subagent's permission prompt names it {edge}
- **GIVEN** the fixture with `c1201`'s subagent `a1` set to status `waiting` with `waiting` `{reason: "Permission prompt: Bash pnpm vitest run", since: "2026-10-18T12:04:30Z"}`
- **WHEN** `needsYou(live)` runs
- **THEN** it returns `c1140`'s main agent's wait, then `a1`'s, whose row has `key` "c1201/a1", `name` "test-runner" and `href` `#/agents/c1201/a1`

## ST-015.4 · Following one agent's transcript
**Intent:** As the developer, I want a live transcript of a session and each of its subagents, so that I can see what an agent is reading, changing and running while it works.

### S-015.4.1 · The transcript's header {happy}
- **GIVEN** the fixture's `c1201` and `transcriptPage1` loaded for its main agent
- **WHEN** the transcript renders
- **THEN** the header shows "Running", "SES-20261018-1201", "c1201", the tag "build", "started 12:01:04 · 3m 56s · 7 tool calls", the heading "Turn S-005.2.1 green: implement retry exhaustion", "Working on" F-005 T-005.4 "Exhaustion & policy validation (red → green)", and a "Copy session ID" button

### S-015.4.2 · A tab per agent {happy}
- **GIVEN** the transcript of S-015.4.1
- **WHEN** it renders
- **THEN** its tabs are "Main session" (`aria-selected="true"`, `#/agents/c1201`), "test-runner" with "40s" (`#/agents/c1201/a1`) and "explorer" with "done" (`#/agents/c1201/a2`)

### S-015.4.3 · `[` and `]` step through the tabs and stop at the ends {edge}
- **GIVEN** `agentRows` of the fixture's `c1201`
- **WHEN** `stepAgent` is called with (null, 1), ("a1", 1), ("a2", 1), (null, −1) and ("a1", −1)
- **THEN** it returns the rows with href `#/agents/c1201/a1`, `#/agents/c1201/a2`, null, null and `#/agents/c1201`, and `TRANSCRIPT_KEYS` is `{"[": "prev", "]": "next", f: "follow", Escape: "back"}`

### S-015.4.4 · Messages and tool rows {happy}
- **GIVEN** the transcript of S-015.4.1
- **WHEN** it renders
- **THEN** entries show "12:01:04" "Build T-005.4" and "12:01:09" "Picking up T-005.4 from the handoff."; the Read row shows "Read" "src/retry/policy.test.ts" with `aria-expanded="false"`; the Edit row is expanded with "+4", "−1" and its diff lines, the "+" lines with class `diff-add` and the "-" line with `diff-del`; the `pnpm lint` row is expanded with "src/retry/policy.ts:14 error no-unused-vars" and a glyph labelled "Failed"; the `pnpm build` row shows "running 42s"; and the last item reads "now" and "Waiting for test-runner…"

### S-015.4.5 · Subagent cards link to their transcripts {happy}
- **GIVEN** the transcript of S-015.4.1
- **WHEN** it renders
- **THEN** the explorer card reads "Spawned subagent", "explorer", "Done · 1m 12s", "Find every caller of decideRetry()" and "Found 1 caller: src/worker/deliver.ts", with "Open its transcript →" linking to `#/agents/c1201/a2`; the test-runner card reads "Running · 40s" and links to `#/agents/c1201/a1`

### S-015.4.6 · A subagent card before its ID is known {edge}
- **GIVEN** `transcriptPage1` with entry 9's `agent_id` set to null
- **WHEN** the transcript renders
- **THEN** that card reads "Spawned subagent", "test-runner" and "Running" with no duration and no "Open its transcript →" link

### S-015.4.7 · The "now" line while an agent works {happy}
- **GIVEN** `c1201`'s main row with `transcriptPage1`'s entries, and the same entries without entry 9
- **WHEN** `nowLine` is called
- **THEN** it returns `{status: "running", text: "Waiting for test-runner…"}`, then `{status: "running", text: "Working…"}`

### S-015.4.8 · No "now" line for a done agent; the wait while waiting {edge}
- **GIVEN** `c1201`'s row for `a2` (done), and `c1140`'s main row (waiting)
- **WHEN** `nowLine` is called with no entries
- **THEN** it returns null for `a2` and `{status: "waiting", text: "Permission prompt: WebFetch prometheus.io"}` for `c1140`

### S-015.4.9 · Show all tool output {edge}
- **GIVEN** the transcript of S-015.4.1, once with `showAll` false and once true
- **WHEN** it renders
- **THEN** the `pnpm vitest run src/retry/policy.test.ts` row has `aria-expanded="false"` and no "✓ S-005.2.1 marks delivery exhausted" the first time, and `aria-expanded="true"` with that line the second time

### S-015.4.10 · Following live, and paused {happy}
- **GIVEN** the transcript of S-015.4.1, once with `follow` true and once false
- **WHEN** it renders
- **THEN** with true the button reads "Following live" with `aria-pressed="true"` and the status pill reads "Live · new output appears at the bottom" with a "Pause" button; with false the button reads "Follow live" with `aria-pressed="false"` and the pill reads "Paused" with a "Resume" button

### S-015.4.11 · The side panel {happy}
- **GIVEN** the transcript of S-015.4.1
- **WHEN** it renders
- **THEN** "Agents in this session" lists "Main session" "3m 56s", "test-runner" "running" and "explorer" "done"; "Covers" lists S-005.2.1 "failing" and S-005.2.2 "untested"; "Files" lists "edited" "src/retry/policy.ts" then "read" "src/retry/policy.test.ts"; and "Commits" reads "None yet in this session"

### S-015.4.12 · Commits made in the session {edge}
- **GIVEN** the fixture's `c1100` (SES-20261018-1100) with an empty transcript
- **WHEN** the transcript renders
- **THEN** "Commits" lists "9f3c2e1" "test(F-005): add red tests for retry exhaustion", then "6c0e3d8", then "a41f2b9", and "Covers" lists S-005.2.1 and S-005.2.2

### S-015.4.13 · Snapshots and agents without a transcript {negative}
- **GIVEN** the route `#/agents/c1201` on an `export` connection, and separately on a `live` connection with `c1201`'s subagent `a2` given `transcript: false` at `#/agents/c1201/a2`
- **WHEN** `Screen` renders the route
- **THEN** both show the empty state "Transcripts are only available in the live viewer", the first with "This is a read-only snapshot. Run azimuth view to follow agents live." and the second with "No transcript was recorded for this agent."

### S-015.4.14 · Unknown sessions and subagents {negative}
- **GIVEN** the fixture on a `live` connection
- **WHEN** `Screen` renders `#/agents/c9`, then `#/agents/c1201/a9`
- **THEN** the first shows "No live session c9" and the second "No subagent a9 in this session"

### S-015.4.15 · Skipped earlier entries and a failed load {edge}
- **GIVEN** a transcript state with `transcriptPage1`'s entries, `skipped` true and `error` "No transcript recorded for agent a1."
- **WHEN** the transcript renders
- **THEN** it shows "Earlier entries aren't shown: this view starts in the transcript's last 512 KiB." before the first entry and an alert "Couldn't load the transcript: No transcript recorded for agent a1.", and the nine entries are still shown

## ST-015.5 · Loading the transcript as it grows
**Intent:** As the transcript page, I want to fetch the first page with the page's token and then only what was appended, so that following an agent stays cheap and nothing shown is lost.

### S-015.5.1 · The first page is requested with the token {happy}
- **GIVEN** a fake fetch answering 200 with `transcriptPage1`
- **WHEN** `fetchTranscript({token: "tok", claudeSession: "c1201", agent: null, after: null}, fake)` runs
- **THEN** the fake was called once with `/api/transcript/c1201` and header `x-azimuth-token: tok`, and the result is `{ok: true, page: transcriptPage1}`

### S-015.5.2 · Later pages ask for what comes after {happy}
- **GIVEN** a subagent `a1` and a previous `next` of 48213
- **WHEN** `transcriptUrl("c1201", "a1", 48213)` is built
- **THEN** it is `/api/transcript/c1201?agent=a1&after=48213`

### S-015.5.3 · A later page appends entries and completes an earlier call {happy}
- **GIVEN** `EMPTY_TRANSCRIPT` with `transcriptPage1` applied
- **WHEN** `transcriptPage2` is applied
- **THEN** the state has 10 entries, the `toolu_runner` spawn has status `ok`, output lines ["3 passed"] and agent `a1`, the last entry is the message "All three scenarios pass.", `next` is 50112 and `error` is null

### S-015.5.4 · A result for a call that isn't loaded is dropped {edge}
- **GIVEN** the state after `transcriptPage1`
- **WHEN** a page with `next` 48300 holding only a `result` for `toolu_gone` is applied
- **THEN** the state still has 9 entries, none with `tool_use_id` `toolu_gone`, and `next` is 48300

### S-015.5.5 · A refused request keeps what was loaded {negative}
- **GIVEN** a fake fetch answering 404 with `{ok: false, error: "not-found", message: "No transcript recorded for agent a9."}`, and the state after `transcriptPage1`
- **WHEN** `fetchTranscript` runs and its result is applied
- **THEN** the result is `{ok: false, status: 404, message: "No transcript recorded for agent a9."}` and the state keeps its 9 entries and `next` 48213 with that `error`

### S-015.5.6 · Without a message, or without a server {negative}
- **GIVEN** a fake fetch answering 403 with `{ok: false, error: "token"}`, and another that rejects
- **WHEN** `fetchTranscript` runs with each
- **THEN** the results are `{ok: false, status: 403, message: "403 token"}` and `{ok: false, status: 0, message: "Couldn't reach azimuth view."}`

### S-015.5.7 · Only the first page's skipped flag counts {edge}
- **GIVEN** `transcriptPage1` with `skipped` true, and separately `transcriptPage1` as is
- **WHEN** each is applied to `EMPTY_TRANSCRIPT`, then `transcriptPage2` with `skipped` true is applied to each
- **THEN** `skipped` is true for the first state and false for the second

## ST-015.6 · Shared pieces for agent screens
**Intent:** As the next feature (F-016's timeline), I want status marks, duration formats and a session's agent rows in one place, so that every agent view reads the same.

### S-015.6.1 · Durations {happy}
- **GIVEN** the durations 45,000, 72,000, 241,000, 300,000, 1,500,000, 3,900,000 and 7,200,000 ms
- **WHEN** `elapsed` formats them
- **THEN** they read "45s", "1m 12s", "4m 01s", "5m", "25m", "1h 05m" and "2h"

### S-015.6.2 · Recent times {happy}
- **GIVEN** now 2026-10-18T12:05:00Z
- **WHEN** `liveAgo` formats 12:04:58, 12:04:12 and 11:58:00, and `clockSeconds` formats 2026-10-18T12:01:04Z
- **THEN** they read "just now", "48s ago", "7m ago" and "12:01:04"

### S-015.6.3 · Nothing to format {edge}
- **GIVEN** a negative duration of −5 ms and a missing timestamp
- **WHEN** `elapsed(-5)`, `liveAgo(null, now)` and `clockSeconds(null)` run
- **THEN** they return "0s", "" and ""

### S-015.6.4 · A status mark always carries its label {happy}
- **GIVEN** the statuses running, waiting and done
- **WHEN** `AgentStatusMark` renders each
- **THEN** they render `class="agent-status running"` with an `az-run` span and "Running", `agent-status waiting` with `az-wait` and "Waiting on you", and `agent-status done` with `az-g s-done` and "Done"

### S-015.6.5 · A hidden label stays readable {edge}
- **GIVEN** the status waiting
- **WHEN** `AgentStatusMark` renders it with `short` and with `hideLabel`
- **THEN** the first reads "waiting", and the second has the `az-wait` span and `<span class="sr-only">Waiting on you</span>`

### S-015.6.6 · A session as rows {happy}
- **GIVEN** the fixture's `c1201`
- **WHEN** `agentRows` runs
- **THEN** it returns three rows: `{key: "c1201", agent_id: null, name: "Main session", description: "Turn S-005.2.1 green: implement retry exhaustion", status: "running", task: "T-005.4", href: "#/agents/c1201"}`, then `{key: "c1201/a1", name: "test-runner", status: "running", href: "#/agents/c1201/a1"}`, then `{key: "c1201/a2", name: "explorer", status: "done", ended_at: "2026-10-18T12:02:32Z"}`, and `agentDuration` of the last is 72,000

### S-015.6.7 · A subagent without a type or description {edge}
- **GIVEN** a session whose subagent `a7` has `agent_type` and `description` null
- **WHEN** `agentRows` runs
- **THEN** its row has `name` "subagent" and `description` null

### S-015.6.8 · Labels for sessions and actions {happy}
- **GIVEN** the fixture's `c1201` and its main agent's current Edit, `c1202`'s subagent's Read, `a1`'s Bash, and a session with `ses` null and `claude_session` "7f3a9c2e-1202-4b1d"
- **WHEN** `sessionLabel`, `shortLabel` and `actionLabel` run
- **THEN** they give "SES-20261018-1201" and "…1201"; "Edit src/retry/policy.ts", "Read src/api/attempts.ts" and "pnpm vitest run src/retry/policy.test.ts"; and "7f3a9c2e" for both labels of the session without an SES

## ST-015.7 · The Inbox names agents by their status
**Intent:** As the developer, I want the empty Inbox to say whether an agent is working or waiting on me, by the same status the Agents screen shows, so that it never names a session that finished hours ago.

### S-015.7.1 · A running agent {happy}
- **GIVEN** an empty inbox and the fixture's live sessions
- **WHEN** the Inbox renders
- **THEN** its empty state reads "An agent is working on T-005.4: pnpm vitest run src/retry/policy.test.ts"

### S-015.7.2 · An agent waiting for you {happy}
- **GIVEN** an empty inbox and the fixture's sessions `c1140`, `c1100` and `c0930` only
- **WHEN** the Inbox renders
- **THEN** its empty state reads "An agent on F-010 is waiting for you: Permission prompt: WebFetch prometheus.io."

### S-015.7.3 · A done session without an end isn't named {negative}
- **GIVEN** an empty inbox and the fixture's session `c0930` only (done, `ended_at` null)
- **WHEN** the Inbox renders
- **THEN** its empty state starts with "The last agent session ended" and doesn't contain "An agent"
