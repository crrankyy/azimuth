---
files:
  - path: viewer/src/screens/activity/sessions.ts
    change: create
    note: activitySessions (persisted and live sessions joined by ses, with start, end, status, features), attribute (commits, runs, questions, ADRs, issues), pickedUpBy, shortSessionId, sessionMatchesFeature, activityData; pure
    symbols: [activitySessions, attribute, pickedUpBy, shortSessionId, sessionMatchesFeature, activityData]
  - path: viewer/src/screens/activity/timeline.ts
    change: create
    note: timelineWindow (Last 75 min, Today, 3 days in local time) and layoutTimeline (rows, spans, markers, now line, earlier today); pure
    symbols: [timelineWindow, layoutTimeline, RANGES]
  - path: viewer/src/screens/activity/thread.ts
    change: create
    note: sessionThreads, each persisted session's thread entries, run tally, subagent count, picked-up-by and transcript link; pure
    symbols: [sessionThreads]
  - path: viewer/src/screens/activity/AgentTimeline.tsx
    change: create
    note: The Agent timeline section (range toggle, ticks, now line, rows with spans and markers, legend, earlier line)
  - path: viewer/src/screens/activity/timeline.css
    change: create
    note: Timeline layout, span kinds (striped waiting), marker shapes and the legend; no animation
  - path: viewer/src/screens/activity/LiveCards.tsx
    change: create
    note: liveCards and the compact cards for sessions running or waiting on you
  - path: viewer/src/screens/activity/live-cards.css
    change: create
    note: Card grid and card styles from the design; no animation
  - path: test/fixtures/live/timeline.ts
    change: test
    note: The four F-014-shaped live sessions c1201, c1202, c1140 and c1100 at 2026-10-18T12:05:00Z, built with F-015's builders in test/fixtures/live/agents.ts
  - path: viewer/src/screens/activity/feed.ts
    change: modify
    note: ActivityKind with subagent; buildFeed(index, data) leaves out card sessions and thread items; byPeriod (Today, Yesterday, Earlier) replaces byDay
  - path: viewer/src/screens/activity/ActivityFeed.tsx
    change: modify
    note: Period groups without the time rail, cards first under Today, threads passed to SessionCard, dated rows in Earlier
  - path: viewer/src/screens/activity/activity.css
    change: modify
    note: Feed rows without the rail, period headings, the header's active count
  - path: viewer/src/components/SessionCard.tsx
    change: modify
    note: Status glyph, collapsed tally with runs, subagent count and Transcript link in the header, picked up by in the handoff, Thread list in place of Raised and Commits
  - path: viewer/src/components/session-card.css
    change: modify
    note: Thread list styles (time, mark, text, trailing chip)
  - path: viewer/src/screens/Activity.tsx
    change: modify
    note: Subagents chip, sessions-active count, range state, AgentTimeline in place of LiveStrip, cards and threads; route expand and scroll kept
  - path: viewer/src/screens/activity/sessions.test.ts
    change: test
    note: Joining, statuses, attribution, picked up by
  - path: viewer/src/screens/activity/timeline.test.ts
    change: test
    note: Windows, rows, spans, markers, earlier today, actions, filters
  - path: viewer/src/screens/activity/thread.test.ts
    change: test
    note: Thread entries, untimed entries, kind filters
  - path: viewer/src/screens/activity/feed.test.ts
    change: test
    note: Period groups and what the feed leaves to threads and cards
  - path: viewer/src/screens/activity/AgentTimeline.test.tsx
    change: test
    note: Rendered timeline, text and titles on every span and marker, legend, empty range
  - path: viewer/src/screens/activity/LiveCards.test.tsx
    change: test
    note: Rendered running and waiting cards
  - path: viewer/src/components/SessionCard.test.tsx
    change: test
    note: Threaded expanded card, collapsed tally, transcript link
  - path: viewer/src/screens/activity/ActivityFeed.test.tsx
    change: test
    note: Period sections, cards under Today, dated Earlier rows
  - path: viewer/src/screens/Activity.test.tsx
    change: test
    note: Chips, order of sections, route to a finished or running session, export and empty project, reduced motion
  - path: docs/viewer.md
    change: modify
    note: The Activity row of the Screens table
  - path: src/core/types.ts
    change: read
    note: Index, Session, Commit, VerifyRun (ses), Question, Decision, Issue and F-014's LiveSession, LiveAgent, LiveActivity, LiveWaitSpan, AgentStatus
  - path: src/core/ids.ts
    change: read
    note: featureOf for session features
  - path: viewer/src/lib/format.ts
    change: read
    note: age, duration, shortDuration, clock, dateTime, shortDate, dayHeading, localDay, plural
  - path: viewer/src/lib/router.ts
    change: read
    note: href, routeForId, parseRoute; F-015 adds the agents section (#/agents/<claude-session>[/<agent>])
  - path: viewer/src/styles/azimuth.css
    change: read
    note: F-015's .az-run, .az-wait, .az-stripe and the reduced-motion rule
  - path: viewer/src/components/primitives.tsx
    change: read
    note: Segmented (range toggle), FilterChip, Tag, Eyebrow, EmptyState, FlagBadge
  - path: viewer/src/components/Status.tsx
    change: read
    note: StatusGlyph for done, open, passed and failed marks
  - path: viewer/src/components/IdChip.tsx
    change: read
    note: ID chips in cards and threads (not inside timeline rows, which are links)
  - path: viewer/src/data/IndexProvider.tsx
    change: read
    note: IndexContext for component tests; now and changed
  - path: viewer/src/screens/activity/LiveStrip.tsx
    change: read
    note: No longer rendered on Activity; left to F-015
  - path: viewer/src/components/AppShell.tsx
    change: read
    note: Page; its live strip and nav are F-015's
  - path: test/fixtures/hookline/expected-index.ts
    change: read
    note: The sample index the tests start from (live is empty)
---
# F-016: Impact map

Viewer only. Three pure modules do the work: `sessions.ts` joins persisted and live sessions and
decides which session owns each commit, run, question, ADR and issue; `timeline.ts` lays out the
window, rows, spans and markers; `thread.ts` lists each finished session's thread. `feed.ts`
uses the same ownership so an item shows once. The components render their results:
`AgentTimeline`, `LiveCards`, the extended `SessionCard` and `ActivityFeed`, wired together in
`Activity.tsx`. Tests build F-014-shaped live sessions with `test/fixtures/live/timeline.ts`,
because the Hookline index has none.

From F-015, which is built first and whose files don't exist yet: `AGENT_LOOK`
(`viewer/src/lib/status.ts`), `AgentStatusMark` (`viewer/src/components/Status.tsx`), `elapsed`
(`viewer/src/lib/format.ts`), `agentRows`, `sessionEnd` and `actionLabel`
(`viewer/src/data/agents.ts`, new in F-015, so not listed above) and the builders in
`test/fixtures/live/agents.ts` (also new in F-015).
