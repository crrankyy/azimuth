# F-016: Stories

Unless a scenario says otherwise: the time zone is UTC; now is 2026-10-18T12:05:00Z
(`FIXTURE_NOW`); `fixtureIndex()` (`test/fixtures/live/timeline.ts`) is the Hookline sample index
with the live sessions of contract.md's Live fixture (c1201, c1202, c1140, c1100), and `fixtureIndex([])` the same with
`live: []`; "all kinds" is session, subagent, commit, run and action; the feature filter is
"all"; times written as `11:40` are on 2026-10-18 UTC.

## ST-016.1 · Sessions joined and work attributed to them
**Intent:** As the timeline, the cards and the threads, I want one list of sessions that joins persisted and live data and knows which commits, runs, questions, ADRs and issues each one produced, so that every view places them the same way.

### S-016.1.1 · Persisted and live sessions are joined by SES {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `activitySessions` runs
- **THEN** the keys are, in order, `SES-20261007-1010`, `SES-20261016-1320`, `SES-20261017-0915`, `SES-20261017-1430`, `SES-20261018-0930`, `SES-20261018-1100`, `SES-20261018-1140`, `SES-20261018-1201`, `SES-20261018-1202`
- **AND** `SES-20261018-1100` has live session `c1100`, status `done` and end `2026-10-18T11:58:00Z`, and `SES-20261018-1201` has session `null`, live session `c1201`, status `running`, start `2026-10-18T12:01:00Z`, end `null`, features `["F-005"]`, skill `pm-build` and goal "Implement retry exhaustion"

### S-016.1.2 · An open session's status comes from its live data {edge}
- **GIVEN** `fixtureIndex([])` plus a persisted session `SES-20261018-1150` started at 11:50 with `ended_at` null, once alone and once with a live session `c1150` naming it whose status is `done` and whose main agent ended at 11:57
- **WHEN** `activitySessions` runs each time
- **THEN** `SES-20261018-1150` has status `open` and end `null` the first time, and status `done` and end `2026-10-18T11:57:00Z` the second

### S-016.1.3 · A live session without a SES keeps its Claude Code ID {edge}
- **GIVEN** `fixtureIndex([liveSession({claude_session: "c9abcdef12", ses: null})])`
- **WHEN** `activitySessions` and `shortSessionId` run
- **THEN** that session has key `c9abcdef12`, ses `null` and session `null`, and `shortSessionId` gives "c9abcdef" for it, "…1100" for `SES-20261018-1100` and "…1100-2" for a session keyed `SES-20261018-1100-2`

### S-016.1.4 · Commits, runs and questions belong to their session {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `attribute` runs at now
- **THEN** `SES-20261018-1100` owns commits `["a41f2b9", "6c0e3d8", "9f3c2e1"]`, runs `["R-0140", "R-0141", "R-0142"]` (they have no `ses`; their commits are its own) and questions `["Q-0002"]`, `SES-20261017-1430` owns runs `["R-0137", "R-0138"]`, and `owner` has no entry for `R-0139`, `c2d4e18` or `d5a8f31`

### S-016.1.5 · Ambiguous and sessionless items have no owner {negative}
- **GIVEN** `fixtureIndex()` plus an agent commit `abc1234` with session null at 12:03 (inside c1140, c1201 and c1202), a commit `def5678` by you with session null at 11:20, a run `R-0150` with `ses: null` at 11:20, and an agent commit `aaa1111` with session null at 11:20
- **WHEN** `attribute` runs at now
- **THEN** `owner` has no entry for `abc1234`, `def5678` or `R-0150`, and `owner.get("aaa1111")` is `SES-20261018-1100`

### S-016.1.6 · Raised ADRs and issues, with a time only when one is known {edge}
- **GIVEN** `fixtureIndex()`, then the same with ADR-0004's `decided_at` set to `2026-10-18T11:30:00Z`, then to `2026-10-18T13:00:00Z`
- **WHEN** `attribute` runs each time
- **THEN** `SES-20261018-1100`'s decisions are `[{ADR-0004, at: null}]`, then `[{ADR-0004, at: "2026-10-18T11:30:00Z"}]`, then `[{ADR-0004, at: null}]`, and `SES-20261017-1430`'s issues are `["DEBT-0001"]` each time

### S-016.1.7 · The session that picked up a handoff {happy}
- **GIVEN** `activitySessions(fixtureIndex())`
- **WHEN** `pickedUpBy` runs for `SES-20261018-1100` and for `SES-20261018-0930`
- **THEN** it returns `{id: "SES-20261018-1201", at: "2026-10-18T12:01:00Z"}` and `{id: "SES-20261018-1100", at: "2026-10-18T11:00:00Z"}`

### S-016.1.8 · No pick-up for an open session or the latest one {negative}
- **GIVEN** `activitySessions(fixtureIndex())` and `activitySessions(fixtureIndex([]))`
- **WHEN** `pickedUpBy` runs for `SES-20261018-1201` in the first and for `SES-20261018-1100` in the second
- **THEN** both return `null`

## ST-016.2 · The timeline's window, rows, spans and markers
**Intent:** As the developer, I want a timeline of every session and subagent in a time range, with their running, waiting and finished time and what they produced, so that I can see at a glance what my agents did and what waits on me.

### S-016.2.1 · Last 75 min ends at the next quarter hour {happy}
- **GIVEN** now
- **WHEN** `timelineWindow("75m", now)` runs, and `layoutTimeline(fixtureIndex(), {now, range: "75m", kinds: all kinds, feature: "all"})`
- **THEN** start is `2026-10-18T11:00:00.000Z`, end `2026-10-18T12:15:00.000Z`, ticks `[{left: 0, label: "11:00"}, {left: 20, label: "11:15"}, {left: 40, label: "11:30"}, {left: 60, label: "11:45"}, {left: 80, label: "12:00"}]`, label "Today, 11:00 – 12:15", and the layout's `now` is `86.67`
- **AND** at now `2026-10-18T12:00:00Z` the window is the same and `now` is `80`

### S-016.2.2 · Today and 3 days follow local midnights {edge}
- **GIVEN** the time zone America/Los_Angeles and now `2026-10-18T19:05:00Z` (12:05 local)
- **WHEN** `timelineWindow("today", now)` and `timelineWindow("3d", now)` run
- **THEN** Today has start `2026-10-18T07:00:00.000Z`, end `2026-10-19T07:00:00.000Z`, tick labels "00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00" at lefts 0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5 and label "Today · Sunday, Oct 18"; 3 days has start `2026-10-16T07:00:00.000Z`, end `2026-10-19T07:00:00.000Z`, ticks `[{left: 0, label: "Fri Oct 16"}, {left: 33.33, label: "Sat Oct 17"}, {left: 66.67, label: "Sun Oct 18"}]` and label "Oct 16 – Oct 18"

### S-016.2.3 · A row per session in the window, with its subagents beneath {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `layoutTimeline` runs with range `75m`, all kinds and all features
- **THEN** the row keys are `["SES-20261018-1100", "SES-20261018-1100/a5", "SES-20261018-1140", "SES-20261018-1140/a3", "SES-20261018-1201", "SES-20261018-1201/a1", "SES-20261018-1201/a2", "SES-20261018-1202", "SES-20261018-1202/a4"]`, their depths `[0, 1, 0, 1, 0, 1, 1, 0, 1]` and their status labels `["done", "done", "waiting on you", "done", "running", "done", "running", "running", "running"]`
- **AND** the `SES-20261018-1140` row has name "…1140", skill `pm-spec` and feature `F-010`, and the `SES-20261018-1140/a3` row has name "researcher" and detail "survey log fields"

### S-016.2.4 · Spans are coloured by status, and waits on you are striped {happy}
- **GIVEN** the layout of S-016.2.3
- **WHEN** its spans are read
- **THEN** `SES-20261018-1100` has `[{kind: "done", left: 0, width: 77.33, title: "Finished · 11:00–11:58"}, {kind: "waiting", left: 26.67, width: 4, title: "Waiting on you · 11:20–11:23 · Permission prompt: Bash pnpm build"}]`, `SES-20261018-1140` has `[{kind: "running", left: 53.33, width: 33.33, title: "Running · 11:40–now"}, {kind: "waiting", left: 80, width: 6.67, title: "Waiting on you · 12:00–now · Permission prompt: Bash pnpm vitest run"}]`, `SES-20261018-1100/a5` has `[{kind: "done", left: 2.67, width: 5.33, title: "Finished · 11:02–11:06"}]` and `SES-20261018-1201/a2` has `[{kind: "running", left: 85.89, width: 0.78, title: "Running · 12:04–now"}]`

### S-016.2.5 · Markers sit at their time on their session's row {happy}
- **GIVEN** the layout of S-016.2.3
- **WHEN** its markers are read
- **THEN** `SES-20261018-1100` has, in order, `{commit, a41f2b9, left 16, "Commit a41f2b9 · feat(F-005): exponential backoff with full jitter"}`, `{run-pass, R-0140, 17.33, "R-0140 passed · T-005.2"}`, `{commit, 6c0e3d8, 41.33, "Commit 6c0e3d8 · feat(F-005): classify responses as retryable or permanent"}`, `{run-pass, R-0141, 42.67, "R-0141 passed · T-005.3"}`, `{question, Q-0002, 60, "Q-0002 raised · Should 429 responses count toward maxAttempts?"}`, `{commit, 9f3c2e1, 73.33, "Commit 9f3c2e1 · test(F-005): add red tests for retry exhaustion"}` and `{run-fail, R-0142, 74.67, "R-0142 failed · T-005.4"}` (kind, id, left, title), and every other row has no markers

### S-016.2.6 · A persisted session without live data is a plain span {edge}
- **GIVEN** `fixtureIndex([])` plus a persisted session `SES-20261018-1150` started at 11:50 with `ended_at` null
- **WHEN** `layoutTimeline` runs with range `75m`
- **THEN** its row has status `open`, status label "open", href `#/activity/SES-20261018-1150` and spans `[{kind: "open", left: 66.67, width: 20, title: "Open · 11:50–now · no live data"}]`, no row has depth 1, and the `SES-20261018-1100` row's spans are `[{kind: "done", left: 0, width: 77.33, title: "Finished · 11:00–11:58"}]`

### S-016.2.7 · Sessions before the window are listed as earlier today {edge}
- **GIVEN** `fixtureIndex()`
- **WHEN** `layoutTimeline` runs with range `75m`, and again with range `today`
- **THEN** with `75m`, `earlier` is `[{id: "SES-20261018-0930", label: "09:30–10:25", href: "#/activity/SES-20261018-0930"}]` and no row key starts with `SES-20261018-0930` or `SES-20261017`; with `today`, `earlier` is `[]` and the `SES-20261018-0930` row's spans are `[{kind: "done", left: 39.58, width: 3.82, title: "Finished · 09:30–10:25"}]`

### S-016.2.8 · Running rows name their current action and link to the transcript {happy}
- **GIVEN** the layout of S-016.2.3
- **WHEN** its actions and links are read
- **THEN** the actions are "Edit src/retry/policy.ts" for `SES-20261018-1201`, "pnpm vitest run" for `SES-20261018-1201/a2` and "Read src/api/attempts.ts" for `SES-20261018-1202/a4`, and `null` for `SES-20261018-1140` and `SES-20261018-1100`
- **AND** the hrefs are `#/activity/SES-20261018-1100` for `SES-20261018-1100`, `#/agents/c1201` for `SES-20261018-1201` and `#/agents/c1201/a2` for `SES-20261018-1201/a2`

### S-016.2.9 · An ADR is marked only when its time is known {edge}
- **GIVEN** `fixtureIndex()` with ADR-0004's `decided_at` set to `2026-10-18T11:30:00Z`, and `fixtureIndex()` as it is
- **WHEN** `layoutTimeline` runs with range `75m` for each
- **THEN** the first `SES-20261018-1100` row's markers include `{kind: "adr", id: "ADR-0004", at: "2026-10-18T11:30:00Z", left: 40, title: "ADR-0004 proposed · 30-second lease for in-flight attempts"}`, and the second has no marker of kind `adr`

## ST-016.3 · The kind and feature filters apply to the timeline
**Intent:** As the developer, I want the Activity filters to narrow the timeline too, so that the timeline and the feed always show the same work.

### S-016.3.1 · Kind chips hide subagent rows and markers {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `layoutTimeline` runs with range `75m` and kinds session and action only
- **THEN** the row keys are `["SES-20261018-1100", "SES-20261018-1140", "SES-20261018-1201", "SES-20261018-1202"]` and the `SES-20261018-1100` row's marker kinds are `["question"]`

### S-016.3.2 · The feature filter keeps matching sessions with their subagents {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `layoutTimeline` runs with range `75m`, all kinds and feature `F-007`
- **THEN** the row keys are `["SES-20261018-1202", "SES-20261018-1202/a4"]` and `earlier` is `[]`

### S-016.3.3 · Without sessions or with "Untracked", the timeline is empty {negative}
- **GIVEN** `fixtureIndex()`
- **WHEN** `layoutTimeline` runs with range `75m` once with every kind but session, and once with all kinds and feature `untracked`
- **THEN** both layouts have rows `[]` and earlier `[]`

## ST-016.4 · The timeline on screen
**Intent:** As the developer, I want the timeline drawn as in the design, with every status readable without colour, so that I can scan it quickly and screen readers can read it.

### S-016.4.1 · The header, range toggle, ticks and now line {happy}
- **GIVEN** `layoutTimeline(fixtureIndex(), {now, range: "75m", kinds: all kinds, feature: "all"})`
- **WHEN** `AgentTimeline` renders it with range `75m`
- **THEN** the markup has a section with `aria-label="Agent timeline"`, the text "Agent timeline", "Today, 11:00 – 12:15 · each row is a session, indented rows are its subagents", a group with `aria-label="Range"` holding the buttons "Last 75 min" (`aria-pressed="true"`), "Today" and "3 days" (`aria-pressed="false"`), the tick labels "11:00", "11:15", "11:30", "11:45" and "12:00", and an element with class `tl-now` at `left:86.67%` containing "now"

### S-016.4.2 · Rows say their status in words {happy}
- **GIVEN** the rendering of S-016.4.1
- **WHEN** the row links (class `tl-row`) are read
- **THEN** there are 9, the row titled `SES-20261018-1140` contains "…1140", "pm-spec", "F-010" and "waiting on you", the one titled `SES-20261018-1100` contains "done", the one titled `SES-20261018-1201` contains "running" and "Edit src/retry/policy.ts", and the one titled `a3` contains "└", "researcher" and "survey log fields"

### S-016.4.3 · Every span and marker carries its meaning in text {happy}
- **GIVEN** the rendering of S-016.4.1
- **WHEN** the elements with class `tl-span` or `tl-mark` are read
- **THEN** each has a `title` equal to its `aria-label`, among them `title="Waiting on you · 12:00–now · Permission prompt: Bash pnpm vitest run"` on an element with class `k-waiting` and `title="R-0142 failed · T-005.4"` on an element with class `m-run-fail`, which is followed by the text "R-0142 ✕"

### S-016.4.4 · The legend and the earlier line {happy}
- **GIVEN** the rendering of S-016.4.1
- **WHEN** the legend is read
- **THEN** it contains "Running", "Waiting on you", "Finished", "Commit", "Run passed", "Run failed" and "Raised a question or ADR", and the line "Earlier today:" followed by a link to `#/activity/SES-20261018-0930` with the text "SES-20261018-0930" and then "09:30–10:25"

### S-016.4.5 · A range with no sessions {edge}
- **GIVEN** `layoutTimeline(fixtureIndex([]), {now: Date.parse("2026-10-18T20:00:00Z"), range: "75m", kinds: all kinds, feature: "all"})`
- **WHEN** `AgentTimeline` renders it
- **THEN** the markup contains "Today, 19:00 – 20:15", "No agent sessions in this range." and the legend, has no element with class `tl-row`, and its earlier line names `SES-20261018-0930` · "09:30–10:25" and then `SES-20261018-1100` · "11:00–11:58"

## ST-016.5 · Cards for the sessions running now or waiting on you
**Intent:** As the developer, I want a compact card for each session that is running or waiting on me, so that I see what each one is doing and which needs me.

### S-016.5.1 · A running card shows its goal, work and latest action {happy}
- **GIVEN** `liveCards(activityData(fixtureIndex(), now))`
- **WHEN** `LiveCards` renders it at now
- **THEN** the cards (class `live-card`) are, in order, those with ids `ses-SES-20261018-1201`, `ses-SES-20261018-1202` and `ses-SES-20261018-1140`, and the first links to `#/agents/c1201` and contains "Running", "…1201", "4m", "Implement retry exhaustion", "F-005 · T-005.4 · 2 subagents" and "▸ test-runner: pnpm vitest run"
- **AND** the second contains "3m", "F-007 · T-007.4 · 1 subagent" and "▸ Edit src/api/attempts.ts"

### S-016.5.2 · A waiting card says what it waits for {happy}
- **GIVEN** the rendering of S-016.5.1
- **WHEN** the third card is read
- **THEN** it has class `s-waiting` and contains "Waiting on you", "…1140", "5m", "Write the F-010 spec", "F-010 · 1 subagent" and "Permission prompt: Bash pnpm vitest run", and no "▸"

### S-016.5.3 · A card without a goal or a SES {edge}
- **GIVEN** a live session `c9abcdef12` with ses, goal and skill null, status `running`, started at 12:03, no current event, no agents, no features and no task
- **WHEN** `LiveCards` renders its activity session at now
- **THEN** the card contains "c9abcdef", "2m" and "No goal recorded", has no `id` attribute, no element with class `live-card-facts` and no "▸"

### S-016.5.4 · No cards for finished sessions or exports {negative}
- **GIVEN** `fixtureIndex()` with the status of c1201, c1202 and c1140 set to `done`, and `fixtureIndex([])`
- **WHEN** `liveCards` runs on each, and `LiveCards` renders the result
- **THEN** both lists are `[]` and the markup is ""

## ST-016.6 · Finished sessions as threads
**Intent:** As the developer, I want a finished session to read as one thread of what its subagents did, what it committed and verified and what it raised, with who picked up its handoff, so that I can follow a session's work without opening other screens.

### S-016.6.1 · A session's thread in time order {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `sessionThreads(index, activityData(index, now), {now, kinds: all kinds})` runs
- **THEN** the thread of `SES-20261018-1100` has status `done`, subagents `1`, runs `{total: 3, failed: 1}`, pickedUp `{id: "SES-20261018-1201", at: "2026-10-18T12:01:00Z"}`, transcript `null`, and entries of kinds `["subagent", "commit", "run", "commit", "run", "question", "commit", "run", "adr"]`
- **AND** the first entry is `{kind: "subagent", at: "2026-10-18T11:02:00Z", agent: "explorer", text: "map retry call sites", duration: "4m"}` (with its href), the runs' texts are "R-0140 passed · 1.3 s", "R-0141 passed · 1.3 s" and "R-0142 failed · 2.1 s", the question is `Q-0002` at `2026-10-18T11:45:00Z`, and the last entry is `{kind: "adr", at: null, id: "ADR-0004", title: "30-second lease for in-flight attempts"}`

### S-016.6.2 · A thread without live data {edge}
- **GIVEN** the threads of S-016.6.1
- **WHEN** the thread of `SES-20261018-0930` is read
- **THEN** its entries are `[{kind: "question", at: "2026-10-18T10:12:00Z", id: "Q-0003", title: "Re-sign replayed payloads with the current or the original secret?"}, {kind: "commit", at: "2026-10-18T10:20:00Z", sha: "2f9c7a0", subject: "docs(F-008): draft delivery replay spec", refs: ["F-008"]}]`, subagents `0`, runs `{total: 0, failed: 0}` and pickedUp `{id: "SES-20261018-1100", at: "2026-10-18T11:00:00Z"}`

### S-016.6.3 · Untimed entries come last {edge}
- **GIVEN** `fixtureIndex()` with `SES-20261018-0930`'s commits set to `["2f9c7a0", "0000000"]`
- **WHEN** `sessionThreads` runs
- **THEN** the thread of `SES-20261017-1430` has entry kinds `["commit", "commit", "run", "run", "issue"]`, run texts "R-0137 passed · 1.7 s" and "R-0138 failed · 8.4 s" and last entry `{kind: "issue", at: null, id: "DEBT-0001", title: "Delivery worker logs unstructured strings"}`, and the thread of `SES-20261018-0930` ends with `{kind: "commit", at: null, sha: "0000000", subject: "Not in the index", refs: []}`

### S-016.6.4 · Kind chips narrow the thread but not its counts {negative}
- **GIVEN** `fixtureIndex()`
- **WHEN** `sessionThreads` runs with kinds session and action only
- **THEN** the thread of `SES-20261018-1100` has entry kinds `["question", "adr"]`, subagents `1` and runs `{total: 3, failed: 1}`

### S-016.6.5 · The expanded card shows the thread and who picked up the handoff {happy}
- **GIVEN** `fixtureIndex()` and the thread of `SES-20261018-1100` from S-016.6.1
- **WHEN** `SessionCard` renders that session expanded
- **THEN** the markup contains "11:00–11:58 · 58m · 1 subagent", a handoff heading containing "picked up by", "SES-20261018-1201" and "at 12:01", a `<dt>` "Thread" followed by a list with class `ses-thread` of 9 items, "R-0142 failed · 2.1 s", "map retry call sites" and "4m", a `<dt>` "Touched", and no `<dt>` "Raised" or "Commits"

### S-016.6.6 · The collapsed card's tally {edge}
- **GIVEN** `fixtureIndex()` and the threads of S-016.6.1
- **WHEN** `SessionCard` renders `SES-20261018-1100` and `SES-20261017-1430` collapsed, and `SES-20261016-1320` collapsed with `dated`
- **THEN** they contain "11:00–11:58 · 3 commits · 3 runs (1 failed) · raised" with ID chips `Q-0002` and `ADR-0004` and a status glyph labelled "Done"; "14:30–16:45 · 2 commits · 2 runs (1 failed) · raised" with the chip `DEBT-0001`; and "Oct 16, 13:20–13:40 · 1 commit" with "Changed an approved spec"

### S-016.6.7 · A Transcript link while the transcript can be served {edge}
- **GIVEN** `fixtureIndex()` with c1100's `main.transcript` set to `true`, and `fixtureIndex()` as it is
- **WHEN** `SessionCard` renders `SES-20261018-1100` expanded with its thread from each
- **THEN** the first header contains a link "Transcript" to `#/agents/c1100`, and the second contains no "Transcript"

## ST-016.7 · The feed by Today, Yesterday and Earlier
**Intent:** As the developer, I want the running sessions first and then each finished session once, grouped by Today, Yesterday and Earlier, so that recent work is on top and nothing is listed twice.

### S-016.7.1 · Items grouped by period {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** `byPeriod(buildFeed(index, activityData(index, now)), now)` runs
- **THEN** the periods are `["today", "yesterday", "earlier"]` with headings "Today · Sunday, Oct 18", "Yesterday · Saturday, Oct 17" and "Earlier", Today's item keys are `["SES-20261018-1100", "SES-20261018-0930"]`, Yesterday's `["SES-20261017-1430", "SES-20261017-0915"]`, and Earlier's first two `["SES-20261016-1320", "d5a8f31"]`

### S-016.7.2 · Cards and thread items are not listed again {edge}
- **GIVEN** `fixtureIndex()` plus a persisted session `SES-20261018-1201` (skill `pm-build`, started at 12:01, `ended_at` null, goal "Implement retry exhaustion"), and the same index with `live: []`
- **WHEN** `buildFeed` runs for each
- **THEN** the first feed has no item keyed `SES-20261018-1201` and no item for runs `R-0137`, `R-0138`, `R-0140`, `R-0141` or `R-0142`, while it has items for `R-0139`, `d5a8f31` and `c2d4e18`; the second has a session item keyed `SES-20261018-1201`

### S-016.7.3 · The feed renders cards first and dated Earlier rows {happy}
- **GIVEN** `fixtureIndex()`, its feed, `liveCards` and `sessionThreads`, with `SES-20261018-1100` expanded
- **WHEN** `ActivityFeed` renders them at now
- **THEN** the first section's heading reads "Today" and "Sunday, Oct 18", its three elements with class `live-card` come before its first element with class `ses-card`, the markup has no element with class `feed-rail`, the `d5a8f31` row contains "Oct 15, 09:05", and the `SES-20261016-1320` card contains "Oct 16, 13:20–13:40"

### S-016.7.4 · Cards get a Today group of their own {edge}
- **GIVEN** the feed of `fixtureIndex()` without its Today items, and the card for `SES-20261018-1201`
- **WHEN** `ActivityFeed` renders them at now
- **THEN** the first section's heading reads "Today" and "Sunday, Oct 18" and holds one element with class `live-card` and none with class `ses-card`, and the second section's heading reads "Yesterday"

## ST-016.8 · The Activity screen
**Intent:** As the developer, I want Activity to open with the timeline, then the cards, then the threads, with the filters and links I already use, so that the screen answers what my agents are doing and did.

### S-016.8.1 · Sections, chips and the active count {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** the Activity screen renders at `#/activity`
- **THEN** it shows the chips "Sessions", "Subagents", "Commits", "Verify runs" and "Your actions" in that order, each with `aria-pressed="true"`, and "3 sessions active"; the `aria-label="Agent timeline"` section comes before the first `live-card`, which comes before the first `ses-card`; and the markup contains neither `aria-label="Live agent sessions"` nor "No agent is working right now."

### S-016.8.2 · A route to a finished session expands it {happy}
- **GIVEN** `fixtureIndex()`
- **WHEN** the Activity screen renders at `#/activity/SES-20261018-0930`
- **THEN** the markup contains `<article id="ses-SES-20261018-0930"` and an element with id `ses-SES-20261018-1100` and class `ses-card collapsed`

### S-016.8.3 · A route to a running session targets its card {edge}
- **GIVEN** `fixtureIndex()`
- **WHEN** the Activity screen renders at `#/activity/SES-20261018-1201`
- **THEN** the element with id `ses-SES-20261018-1201` has class `live-card`, and the markup has no `<article id="ses-SES-20261018-1201"`

### S-016.8.4 · Exports and empty projects {negative}
- **GIVEN** `fixtureIndex([])`, and the sample index with `sessions`, `commits`, `runs`, `live` and `features` emptied
- **WHEN** the Activity screen renders at `#/activity` for each
- **THEN** the first has no "sessions active" and no `live-card`, and its timeline has a row titled `SES-20261018-1100`; the second contains "No activity yet" and "No agent sessions in this range."

### S-016.8.5 · Nothing pulses under reduced motion {edge}
- **GIVEN** `viewer/src/screens/activity/timeline.css`, `viewer/src/screens/activity/live-cards.css` and `viewer/src/styles/azimuth.css`
- **WHEN** their text is read
- **THEN** neither `timeline.css` nor `live-cards.css` contains `animation` or `@keyframes`, and `azimuth.css` contains a `@media (prefers-reduced-motion: reduce)` block that sets `animation: none` on `.az-run`
