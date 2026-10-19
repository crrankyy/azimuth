---
id: F-016
title: Show agent sessions on an Activity timeline
summary: Activity opens with an agent timeline (a row per session and its subagents, spans by status with striped waits on you, markers for commits, verify runs and raised questions and ADRs), then cards for the sessions running or waiting on you, then finished sessions as threads grouped by Today, Yesterday and Earlier.
status: draft
priority: P2
size: L
mode: brownfield
milestone: M-01
depends_on: [F-014, F-015]
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
---
# F-016: Show agent sessions on an Activity timeline

## Objective
Activity shows what agents did and are doing, in time, in the layout of
`azimuth-viewer-handoff/screens/Activity.html`.

- **Agent timeline** at the top: one row per session in the chosen range (Last 75 min, Today or
  3 days) with an indented row per subagent. Spans are coloured by status, and time an agent
  spent waiting on you is striped. Markers sit at their time for commits, passing and failing
  verify runs, and the questions and ADRs agents raised. It also has a "now" line, a legend and
  an "Earlier today" line for today's sessions that ended before the range. A pure layout function
  (`layoutTimeline`) computes all of it from the index, `now` and the range, so it is tested
  without a DOM.
- **Cards** for the sessions running now and those waiting on you: status, how long, goal,
  features, task, subagents, and the current action or what it waits for.
- **Finished sessions as threads**: the session card's expanded view lists its subagents (while
  live data exists), commits, verify runs and the questions, ADRs and issues it raised, in time
  order, and its handoff says which session picked it up. The feed groups them by Today,
  Yesterday and Earlier.
- The kind chips (now with Subagents) and the feature filter apply to the timeline, the cards
  and the feed. `#/activity/SES-…` still expands and scrolls to that session.

The viewer reads only what the index already carries: F-014's live sessions (statuses, waits,
current actions, subagents with start and end, goal and skill), persisted sessions, commits,
verify runs (F-007's `ses`), questions, decisions and issues.

## Out of scope
- Changes to the index, the server, the hooks or the CLI. ADRs record only a `date`, so no raise
  time is added for them (see Assumptions).
- Keys: Activity moves to `g t` in F-015; F-016 doesn't touch `viewer/src/lib/keys.ts`.
- The Agents tab, the Live transcript page and the sidebar's live strip in `AppShell.tsx`
  (F-015). F-016 links to F-015's `#/agents/<claude-session>[/<agent>]` pages.
- Deleting `LiveStrip.tsx`, `LiveStrip.test.tsx`, `activeLive`, `isLive` and the `.live-*`
  styles. F-015 left the strip to F-016; Activity stops rendering it (the timeline and the cards
  replace it), but deleting it also deletes F-005's S-005.3 tests, so that is left as an open
  decision.
- The feature page's Activity tab (`viewer/src/screens/feature/ActivityTab.tsx`, its own
  SessionCard).
- Naming the subagent that made a verify run: a run records only its Azimuth session.
- Zooming or panning the timeline beyond the three ranges, and remembering the range across
  reloads.
- The design's feature select in the header (the existing feature aside stays), and its sample
  notes such as "ready for approval" and "red as planned".

## Integration points
- `viewer/src/screens/activity/sessions.ts` (new, pure): `activitySessions` joins persisted
  sessions and live sessions by `ses`; `attribute` assigns commits, runs, questions, ADRs and
  issues to sessions; `pickedUpBy`, `shortSessionId`, `sessionMatchesFeature` and
  `activityData`.
- `viewer/src/screens/activity/timeline.ts` (new, pure): `timelineWindow` and `layoutTimeline`.
- `viewer/src/screens/activity/thread.ts` (new, pure): `sessionThreads`, the entries of each
  persisted session's thread.
- `viewer/src/screens/activity/AgentTimeline.tsx` and `timeline.css` (new): the timeline
  section, range toggle, legend and earlier line.
- `viewer/src/screens/activity/LiveCards.tsx` and `live-cards.css` (new): `liveCards` and the
  running and waiting cards.
- `test/fixtures/live/timeline.ts` (new, tests only): four F-014-shaped live sessions that
  reproduce the design's timeline, built with F-015's fixture builders, since the Hookline index
  has `live: []`.
- `viewer/src/screens/activity/feed.ts`: `ActivityKind` (adds `subagent`), `buildFeed(index,
  data)` leaves out sessions shown as cards and the commits and runs inside a listed session's
  thread, and `byPeriod` replaces `byDay`.
- `viewer/src/screens/activity/ActivityFeed.tsx` and `activity.css`: Today, Yesterday and
  Earlier groups without the time rail, the cards first under Today, and threads passed to each
  SessionCard.
- `viewer/src/components/SessionCard.tsx` and `session-card.css`: a status glyph, the collapsed
  tally with runs, the subagent count and a Transcript link in the header, "picked up by" in the
  handoff, and a Thread list in place of the Raised and Commits facts.
- `viewer/src/screens/Activity.tsx`: the Subagents chip, the "N sessions active" count, the
  range state, the timeline in place of `LiveStrip`, the cards, and the threads.
- From F-015 (its contract; built first): `AGENT_LOOK` (`viewer/src/lib/status.ts`),
  `AgentStatusMark` (`viewer/src/components/Status.tsx`), `elapsed` (`viewer/src/lib/format.ts`),
  `agentRows`, `sessionEnd` and `actionLabel` (`viewer/src/data/agents.ts`), the routes
  `#/agents/<claude-session>[/<agent>]`, the `.az-run`, `.az-wait` and `.az-stripe` styles with the
  reduced-motion rule in `viewer/src/styles/azimuth.css`, and the builders `liveEvent`,
  `liveAgent`, `liveSession` and `indexWithLive` in `test/fixtures/live/agents.ts`.
- Docs: the Activity row of the Screens table in `docs/viewer.md`.
- Files shared with features in flight, so the build runs after them: F-015 (it changes
  `AppShell.tsx`, `keys.ts`, `format.ts`, `Status.tsx`, `status.ts`, `azimuth.css` and
  `docs/viewer.md`; F-016 changes only `docs/viewer.md` of these and reads the rest, and F-015
  leaves `screens/activity/*` to F-016), F-011 (`SessionCard.tsx` and `session-card.css` gain
  Goals and Notes; `docs/viewer.md`) and F-014 (`LiveStrip.test.tsx` builders, `docs/viewer.md`).

## Invariants
- The index, server, hooks and CLI don't change; the Hookline golden index doesn't change.
- `activitySessions`, `attribute`, `timelineWindow`, `layoutTimeline`, `sessionThreads`,
  `buildFeed` and `byPeriod` are pure: no DOM, no clock (`now` is passed in) and no I/O.
- Status is never shown by colour alone: every row states its status in words, every span and
  marker has a `title` and an `aria-label` with the same text, waiting spans are striped, a failed
  run's marker also shows "✕", and the legend names every colour and shape.
- Nothing F-016 adds animates. The only moving part, the running status mark (`.az-run`), stops
  under `prefers-reduced-motion: reduce`.
- A commit or a run appears once in the feed: inside its session's thread, or as its own row.
- `#/activity/SES-…` still expands that session's card and scrolls to it; key bindings don't
  change.
- In an export (`live: []`) the timeline shows persisted sessions only and no cards are shown.
- The feature aside and its counts work as before.

## Assumptions
- Times are local (as everywhere in the viewer). Windows: **Last 75 min** ends at the first
  local quarter hour strictly after `now` and starts 75 minutes earlier, with a tick every 15
  minutes from the start (5 ticks) and the label "<Today|Yesterday>, HH:MM – HH:MM" (the day of
  the start). **Today** runs from local midnight to the next local midnight, with ticks every 3
  hours labelled "00:00" to "21:00" and the label `dayHeading(now)` ("Today · Sunday, Oct 18").
  **3 days** runs from local midnight two days before today to the next local midnight, with a
  tick per day labelled "Fri Oct 16" and the label "Oct 16 – Oct 18". The default is Last 75
  min, as in the design.
- Positions are percentages of the window rounded to two decimals: `left` from the clipped
  start, `width` from the clipped duration. Spans and rows outside the window are dropped.
- An activity session is a persisted session joined to the first live session (in `index.live`
  order, most recently active first) whose `ses` names it, or a live session whose `ses` is null
  or names no persisted session (keyed by its `ses`, else its Claude Code session ID). Its start
  is the persisted `started_at`, else the live one; its end is `ended_at`, else F-015's
  `sessionEnd` of the live session (set only once it is done), else open. Its status is `done` when
  `ended_at` is set, else the live session's F-014 status, else `open` (a persisted session with
  no end and no live data). Other live sessions naming the same SES are ignored: F-011 keeps one
  Claude Code session per SES.
- A row's base span runs from its start to its end (or `now`): `done` spans are "Finished",
  `open` ones "Open … no live data", and `running` or `waiting` ones "Running". The agent's F-014
  wait spans (permission waits and, for the main agent, idle time) are drawn striped on top,
  clipped to the base. Session rows use the live main agent's waits; subagent rows their own.
- Agent rows come from F-015's `agentRows`: the main agent's row gives the session row its waits
  and current action, and each subagent row (named after `agent_type`, else "subagent", with its
  `description` beside it, as in the design) belongs to the session when it started before the
  session's end. Rows are ordered by start; subagents follow their session, oldest first.
- Attribution: a commit belongs to the session its `session` names; an agent commit without one
  belongs to the only session whose span contains its time (none when zero or several do; parallel
  sessions overlap, and a session records its commits only when it closes). A run belongs to the
  session its `ses` names; a run without `ses` (written before F-007) belongs to the session that
  owns its `commit`, the HEAD it ran on; `ses: null` (outside any session) belongs to none. A
  question belongs to the session in its `raised_by`. ADRs and issues belong to the session whose
  `raised` lists them.
- ADRs and issues record only a date, so they have no raise time. An ADR is placed at its
  `decided_at` when that lies within its session's span (under `accept_adrs: auto` the agent
  accepts it in the same session); otherwise it has no timeline marker and is listed in the
  thread after the timed entries, without a time, like issues and commits missing from the index.
- "Earlier today" lists the sessions that started on today's local day and ended before the
  window, oldest first, as "SES-… · HH:MM–HH:MM". It only applies to Last 75 min, since the other
  windows start at or before midnight.
- A running row shows its agent's own current action (F-015's `actionLabel` of its `current`)
  after its span; waiting and finished rows show none.
- Session rows link to `#/activity/<SES>` when the session is done or open and has a SES (the
  card expands); otherwise to F-015's transcript page `#/agents/<claude-session>`, and subagent
  rows to `#/agents/<claude-session>/<agent>` (`AgentRow.href`).
- Cards show the activity sessions whose status is `running` or `waiting`, running first, each
  group oldest first, with F-015's `AgentStatusMark`. Their time is F-015's `elapsed` since the
  start while running and since `waiting.since` while waiting. The facts line joins the live
  features (else `feature`), the task and "N subagents" (omitted at 0) with " · ". The last line
  is "▸ " plus `actionLabel` of the session's latest action (`LiveSession.current`), prefixed with
  "<agent_type>: " when a subagent made it; a waiting card shows `waiting.reason` instead. The goal falls back to the persisted goal, then "No goal
  recorded". The header's "N sessions active" counts these sessions before filters.
- F-014's statuses replace the 120-second rule on Activity; `activeLive` and `isLive` stay for
  `LiveStrip`.
- Threads list, oldest first: subagents (by start, with their duration via `elapsed`, or
  "running"), commits, runs ("R-0140 passed · 1.3 s" via `shortDuration`), questions raised
  ("Raised Q-…"), ADRs ("Proposed ADR-…") and issues ("Filed DEBT-…"); equal times keep that
  order. Untimed entries follow in the order of `commits` and `raised`. A session's handoff was
  "picked up by" the earliest other session that started at or after it ended (SessionStart
  hands every new Claude Code session the latest handoff); open sessions show none.
- The session card keeps its goal, handoff, summary, F-011's Goals and Notes, and Touched; the
  Thread replaces the Raised and Commits facts. The expanded header follows the design
  ("11:00–11:58 · 58m · 2 subagents"; the agent name `claude-code` is dropped), and the
  collapsed tally reads "11:00–11:58 · 3 commits · 3 runs (1 failed) · raised" with the raised
  IDs, prefixed by the date in the Earlier group. Counts don't follow the kind chips.
- Feed groups: Today and Yesterday by local day with `dayHeading`, everything older under
  "Earlier". Rows show `clock(at)` in Today and Yesterday and `dateTime(at)` in Earlier.
- Kind chips: Sessions hides session rows (so the whole timeline), the cards and session items;
  Subagents hides subagent rows and thread entries; Commits and Verify runs hide their markers,
  thread entries and rows; Your actions hides action rows. Raised items and handoffs follow
  their session. The feature filter keeps sessions whose features (live `features` and
  `feature`, and the touched IDs' features) include it, with all their subagents; "Untracked"
  keeps no session. The brief called the Subagents chip existing; the code has four chips, so
  F-016 adds it as the design shows.
- F-015's shared pieces are used as its contract defines them (checked on 2026-10-20 against
  its draft). A timeline row draws its mark with `AGENT_LOOK[status].mark` next to its own
  lower-case status words (the design's "waiting on you"), so the label isn't read twice; cards
  use `AgentStatusMark`; waiting spans use `.az-stripe`. F-016 formats times with `elapsed` and the
  existing `format.ts` helpers (`shortDuration`, `clock`, `dateTime`, `dayHeading`, `shortDate`)
  and doesn't change `format.ts`. `shortSessionId` follows F-015's `shortLabel` rule, which takes
  a live session, for sessions that may have no live data.
