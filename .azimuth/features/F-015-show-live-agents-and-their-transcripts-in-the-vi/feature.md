---
id: F-015
title: Show live agents and their transcripts in the viewer
summary: An Agents screen lists every live session and its subagents by status (running, waiting on you, finished today) with their current action, the files they edit and the permission prompts waiting on you, and a live transcript page follows one agent's messages, edits and commands as they happen.
status: approved
priority: P1
size: L
mode: brownfield
milestone: M-01
depends_on: [F-014]
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:f5eff0bdd7062d41d8e85d460ac54a2cbaad3f0a2f5a28cea8f210bf423451ee
approved_commit: 29737cc
review_ack_at: null
---
# F-015: Show live agents and their transcripts in the viewer

## Objective
Show what every agent is doing right now, using the data F-014 adds to the index's live sessions
and its transcript route, as the handoff's Agents and AgentTranscript screens draw it.

- **Agents (`#/agents`, `g a`)**: a sidebar item right under Inbox with the number of sessions
  that aren't done. The screen counts sessions and subagents, filters by Active, Running, Waiting
  on you and Finished today, and shows a card per running or waiting session (status mark and
  label, SES ID or short Claude Code session ID, skill, start, duration, goal, the feature and task
  it works on, its current action with edit sizes and age, a Transcript link, and a tree of its
  subagents), then compact rows for sessions finished today. A side panel shows the counts right
  now, the files agents are editing (with conflicts when two agents edit the same file outside
  `project.shared_files`), planned overlaps between features in flight
  (`derived.file_conflicts`), and the permission prompts waiting on you, which are answered in the
  Claude Code terminal: the viewer never answers them.
- **Live transcript (`#/agents/<claude-session>[/<agent-id>]`)**: the session's header, a tab per
  agent (`[` and `]` switch), timestamped messages, tool rows (Read, Edit with its diff and
  +/−, Bash with its output tail, running calls), subagent cards linking to their transcripts, a
  "now" line, "Show all tool output", and "Following live" (`f`) that keeps the newest entry in
  view. It fetches F-014's `GET /api/transcript` with the page's token, then the next page with
  `after` whenever a `live` event arrives. A side panel lists the session's agents, the scenarios
  its task covers with their coverage, the files the agent edited or read, and the session's
  commits. Exports and agents without a transcript get an empty state instead.
- **Existing live UI**: the sidebar's footer strip and the Inbox's "An agent is working" line
  follow `status` instead of `ended_at` and the 120-second window; `g t` now opens Activity.
- **Shared pieces for F-016's timeline**: the agent status mark and its looks, `elapsed`,
  `liveAgo` and `clockSeconds`, and `agentRows`, which turns a live session into one row per
  agent.

## Out of scope
- The Activity screen (its live strip, `feed.ts`'s 120-second window, the feed and session cards):
  F-016 redesigns it. Only its key moves from `g a` to `g t`.
- Answering, allowing or denying permission prompts, sending prompts, or any other write action
  from these screens.
- Changes to F-014's index fields, server, transcript route or caps, and pushing transcript lines
  over SSE.
- Sessions that finished before today on the Agents screen (live sessions are kept 72 hours; the
  timeline is F-016's), and the handoff's `failed` and `queued` statuses.
- From the design, what the data doesn't carry: the "claude-code" agent label, "paused 5m", a
  subagent's returned text in the Agents tree, a running subagent's command output inside its
  spawn card (the card shows its current action instead), and the synthetic "Started with … picked
  up the handoff" entry. F-011's session notes aren't shown.
- Searching or filtering a transcript, loading entries older than the first page's 512 KiB
  window, and pausing "Following live" automatically when you scroll up.
- A light theme.

## Integration points
- F-014 (approved, built first): `LiveSession.main`, `status`, `waiting`, `goal`, `skill`; each
  `LiveAgent`'s `LiveActivity` (`status`, `waiting`, `current`, `started_at`, `ended_at`, `edits`,
  `waits`, `transcript`); `LiveEvent.added`/`removed`/`error`; the `TranscriptEntry` and
  `TranscriptPage` types in `src/core/types.ts`; `GET /api/transcript/<claude-session>[?agent=]
  [&after=]` with the `x-azimuth-token` header. Goal and skill come from F-011's `## Goals` through
  F-014's `latestGoal`.
- F-010: `project.shared_files` (globs, compiled with `globToRegExp` from `src/core/glob.ts`, which
  imports no Node modules) and `derived.file_conflicts`, which already leaves shared files out.
- `viewer/src/lib/router.ts`: section `agents` after `inbox` in `SECTIONS`; `#/agents`,
  `#/agents/<claude-session>` and `#/agents/<claude-session>/<agent-id>` parse as `{section, id,
  tab}`. `viewer/src/App.tsx`'s `Screen` routes them to `AgentsScreen` and
  `AgentTranscriptScreen`.
- `viewer/src/components/AppShell.tsx`: `NAV` gains Agents (icon `agents`, new in
  `components/Icon.tsx`, drawn from the handoff's `Sidebar.dc.html`) with the count; the footer
  strip (`liveAgent`, today `!s.ended_at` and 120 s) uses `activeSessions` and links to Agents.
- `viewer/src/lib/keys.ts`: `GOTO.a = "agents"`, `GOTO.t = "activity"`, and `useScreenKeys` for the
  transcript's `[`, `]`, `f` and `Esc`. `components/CommandPalette.tsx`: `SECTION_LABEL.agents`;
  its key hints already come from `GOTO`.
- `viewer/src/data/IndexProvider.tsx`: `pageToken()` reads the `azimuth-token` meta tag (`readBoot`
  uses it). The `live` SSE event keeps replacing `index.live`; the transcript view fetches the next
  page whenever `index.live` changes.
- New: `viewer/src/data/agents.ts` (rows and helpers shared with F-016), `viewer/src/data/
  transcript.ts` (requests and merging), `viewer/src/screens/Agents.tsx` and
  `viewer/src/screens/agents/` (model, cards, side panels, transcript, CSS).
- `viewer/src/screens/Inbox.tsx`: `agentLine` (today `!s.ended_at`) uses `activeSessions` and the
  session's status.
- Shared pieces: `AGENT_LOOK` in `lib/status.ts`, `AgentStatusMark` in `components/Status.tsx`,
  `elapsed`, `liveAgo` and `clockSeconds` in `lib/format.ts`. Reused: `IdChip`, `EmptyState`,
  `Segmented`, `FlagBadge`, `StatusGlyph`, `OutputTail`, `Markdown`, `COVERAGE_LOOK`,
  `taskById`, `featureById`, `scenarioById`, `sessionById`, `useListKeys`, `useCanAct`'s export
  rule (`connection === "export"`), `Page`/`Hint`.
- `viewer/src/styles/azimuth.css`: the handoff's new rules (`az-pulse`, `.az-run`, `.az-wait`,
  `.az-stripe`, `.az-tree`, `.az-twig`, reduced motion) appended verbatim.
- Docs: `docs/viewer.md` (screens, keys), `docs/getting-started.md` (watching agents).
- Files shared with other features (see plan.md): F-016 (`screens/activity/*`, `AppShell.tsx`),
  F-017 (`router.ts`, `App.tsx`, `keys.ts`, `AppShell.tsx`, `format.ts`, `status.ts`,
  `Status.tsx`), F-012 (`Inbox.tsx`, `Inbox.test.tsx`), and `docs/viewer.md` (F-008, F-011,
  F-012, F-014, F-017).

## Invariants
- The viewer stays read-only for agents: these screens make no write request, never answer a
  permission prompt, and send only `GET /api/transcript/…` requests, each with the page's token.
  Exports never request transcripts.
- Transcript text is rendered as React text and `Markdown` elements, never as HTML strings, and is
  kept only in the page's memory (no browser storage).
- Every agent status is shown as a mark of its own shape (`.az-run` dot, `.az-wait` diamond, done
  glyph) with its text label, visible or for screen readers, never by colour alone.
- At most one transcript request is in flight per view; entries already shown are never dropped
  when a request fails.
- The viewer imports from `src/core` only modules that import no Node modules (`types.ts`,
  `ids.ts`, `glob.ts`).
- `viewer/src/styles/azimuth.css` stays a verbatim port of the handoff's `azimuth.css`.
- Other routes, keys and screens keep their behaviour; the Activity screen changes only in its
  go-to key. The index, the server and exports don't change.

## Assumptions
- Statuses are F-014's: a session is not done while it runs or waits on you, which includes an
  idle main agent waiting for your next prompt. The sidebar count, the header counts ("N sessions
  · M subagents": those sessions and all their subagents), the footer strip and the Inbox line use
  sessions that aren't done, in `index.live` order (most recently active first).
- Filters: Active (the default) shows the Running and Waiting on you cards and the Finished today
  rows; Running, Waiting on you and Finished today show only their group. Only Finished today has a
  visible heading; the cards carry their own status. Counts: Active = running + waiting sessions.
- "Today" is the viewer's local day. A session finished today is done and its end
  (`main.ended_at`, else `ended_at`, else `last_seen_at`) falls on today; earlier ones aren't on
  the screen. "Right now" counts running and waiting sessions and subagents, and done sessions and
  subagents that ended today; a line reads "2 sessions · 2 subagents", drops a zero part, and is
  "None" when both are zero.
- Durations: `elapsed` gives "45s" under a minute, "4m 01s" under ten minutes ("5m" when the
  seconds are 0), "25m" under an hour, "1h 05m" after ("2h" when the minutes are 0), and "0s" for
  negative input. An agent's duration runs from `started_at` to `ended_at`, or to now.
  `liveAgo` gives "just now" under 5 s, "48s ago" under a minute, then `ago`.
- A session card's action is its main agent's `current`: "<tool> <file>" when the event has a file,
  else its summary, then "+N −M" when both sizes are known, "failed" when it has an error, and its
  `liveAgo`. A waiting card shows the session's `waiting.reason` and "since HH:MM" instead. A
  subagent row shows its own action, or its wait reason while it waits.
- "Working on": a chip per feature in `features` (else `feature`), the task chip, and the task's
  title, else the title of the only feature. A session without a goal shows "No goal recorded".
- Finished rows read "<goal> · N subagents · left a handoff" (parts that apply) and "HH:MM–HH:MM";
  they link to the session in Activity when it has an SES, else to its transcript.
- Files being edited: the `edits` of every agent that isn't done. A conflict is a path edited by two
  or more different agents (main agents or subagents, in any sessions) that matches no
  `project.shared_files` glob. Editors are labelled "…1201" (the SES ID after its date, else the
  Claude Code session ID's first 8 characters), with the subagent's type after it.
- Planned overlaps are `derived.file_conflicts` pairs whose two features are both in flight in a
  session that isn't done ("F-005 and F-007 both plan changes to src/worker/deliver.ts").
- Needs you lists open permission waits of main agents and subagents, oldest first: a wait whose
  reason isn't F-014's `IDLE_REASON` ("Waiting for your next prompt"). Each item links to the
  waiting agent's transcript and reads "<session label> · <time waiting>", the reason (after the
  subagent's type for a subagent) and "Answer it in the Claude Code terminal running this
  session". The viewer keeps the idle reason as its own constant, because
  `src/core/live-agents.ts` isn't one of the modules the viewer may import; a test builds the idle
  wait with F-014's constant so a change shows up.
- Transcript page: the header is the session's (status, SES and short Claude Code ID, skill,
  start with seconds, duration, the shown agent's tool calls among the loaded entries, goal,
  working on). "Copy session ID" copies the Claude Code session ID (what `claude --resume` takes).
  Tabs are the main agent, then the subagents in `agents` order; `[` and `]` stop at the ends;
  `Esc` goes to `#/agents`.
- Tool rows start expanded when they have a diff or didn't succeed (failed or running); "Show all
  tool output" expands every row; clicking a row toggles it. A spawn card's status and duration
  come from the matching live subagent when there is one, else from the entry. The "now" line
  shows while the shown agent isn't done: "Waiting for <type>…" when the last entry is a running
  spawn, else "Working…", or the wait reason while it waits.
- "Following live" (on when the page opens) only scrolls the newest entry into view; Pause or `f`
  stops the scrolling, never the fetching. It keeps its setting while you switch tabs.
- Fetching: the first page (no `after`) when the page or tab opens, then a page from `next` each
  time `index.live` changes, after the previous request finished. A `result` entry completes the
  earlier call with its `tool_use_id`, and is dropped when that call isn't loaded. Only the first
  page's `skipped` is shown ("Earlier entries aren't shown: this view starts in the transcript's
  last 512 KiB."); a later skipped page (a single line over 512 KiB) is passed over. A failed
  request shows "Couldn't load the transcript: <message>" until a request succeeds.
- Empty states, checked in order: an export ("Transcripts are only available in the live viewer"
  with "This is a read-only snapshot. Run azimuth view to follow agents live."), an unknown
  session ("No live session <id>") or subagent ("No subagent <id> in this session"), an agent
  whose `transcript` is false (the same title with "No transcript was recorded for this agent."),
  then a page without a token (the Vite dev server: the export text). On Agents, an export shows
  "Agents are only shown in the live viewer" and an empty filter "No agent is working right now".
- The transcript's side panel: Covers lists the shown agent's task (else the session's) covered
  scenarios with their coverage labels, or "No task named"; Files lists the loaded entries'
  targets, Edit, MultiEdit, Write and NotebookEdit as "edited", then Read as "read" (edited wins),
  each first seen first; Commits lists `index.commits` whose `session` is the session's SES, newest
  first, else "None yet in this session".
- Sidebar footer strip: "<task, else feature, else Agent> · <the session's current summary, else
  working>" while running, "… · <wait reason>" while waiting, with the status mark (its label for
  screen readers).
- Inbox line: running, "An agent is working[ on <task or feature>]: <current summary>" (as today);
  waiting, "An agent[ on <task or feature>] is waiting for you: <reason>."; without a session that
  isn't done, the existing "The last agent session …" line.
- Viewer tests render with `renderToStaticMarkup` and `TZ=UTC` (set as `format.test.ts` does), from
  the fixture in contract.md.
