---
completed_at: 2026-10-20
files_changed:
  - { path: viewer/src/screens/activity/sessions.ts, change: create }
  - { path: viewer/src/screens/activity/timeline.ts, change: create }
  - { path: viewer/src/screens/activity/thread.ts, change: create }
  - { path: viewer/src/screens/activity/AgentTimeline.tsx, change: create }
  - { path: viewer/src/screens/activity/timeline.css, change: create }
  - { path: viewer/src/screens/activity/LiveCards.tsx, change: create }
  - { path: viewer/src/screens/activity/live-cards.css, change: create }
  - { path: test/fixtures/live/timeline.ts, change: create }
  - { path: viewer/src/screens/activity/feed.ts, change: modify }
  - { path: viewer/src/screens/activity/ActivityFeed.tsx, change: modify }
  - { path: viewer/src/screens/activity/activity.css, change: modify }
  - { path: viewer/src/components/SessionCard.tsx, change: modify }
  - { path: viewer/src/components/session-card.css, change: modify }
  - { path: viewer/src/screens/Activity.tsx, change: modify }
  - { path: viewer/src/screens/activity/sessions.test.ts, change: create }
  - { path: viewer/src/screens/activity/timeline.test.ts, change: create }
  - { path: viewer/src/screens/activity/thread.test.ts, change: create }
  - { path: viewer/src/screens/activity/feed.test.ts, change: create }
  - { path: viewer/src/screens/activity/AgentTimeline.test.tsx, change: create }
  - { path: viewer/src/screens/activity/LiveCards.test.tsx, change: create }
  - { path: viewer/src/components/SessionCard.test.tsx, change: modify }
  - { path: viewer/src/screens/activity/ActivityFeed.test.tsx, change: create }
  - { path: viewer/src/screens/Activity.test.tsx, change: create }
  - { path: docs/viewer.md, change: modify }
deviations:
  - { path: viewer/src/screens/activity/sessions.ts, kind: sequencing, reason: "T-016.2's implementation went into T-016.1's scaffold commit d0497ac, where plan.md has T-016.1 write placeholder bodies; T-016.2's own commit 9af5ea2 holds only sessions.test.ts, so its tests came after the code they cover. sessions.ts hasn't changed since d0497ac" }
  - { path: viewer/src/components/SessionCard.tsx, kind: sequencing, reason: "The thread prop was optional from T-016.1 to T-016.7 (d0497ac to bac240d), so the existing cards in SessionCard.test.tsx rendered without one; it is required, as contract.md has it, since bac240d" }
  - { path: viewer/src/components/SessionCard.tsx, kind: clarification, reason: "The header's Live now dot went with the live prop that contract.md removes: a running or waiting session is a live card now, and a session card starts with its status mark" }
  - { path: viewer/src/screens/activity/sessions.test.ts, kind: test-change, reason: "S-016.1.5's test gives run R-0150 commit 9f3c2e1, which SES-20261018-1100 owns, so it proves that ses: null wins over the commit's owner; the scenario's GIVEN names no commit for R-0150" }
  - { path: viewer/src/screens/activity/sessions.ts, kind: clarification, reason: "A commit whose session names no activity session gets no owner. It isn't placed by time: attribute places by time only agent commits recorded without a session" }
  - { path: viewer/src/screens/activity/timeline.ts, kind: clarification, reason: "T-016.3 built a running row's action from F-015's actionLabel of its agent's current event, as feature.md's Assumptions and S-016.2.8 said, where contract.md's TimelineRow.action read current.summary" }
  - { path: viewer/src/screens/activity/timeline.ts, kind: follow-up-fix, reason: "After the build (0caee18), a running row's action reads <tool> <file name> (Edit policy.ts, as in the design) with the whole actionLabel as its title (actionTitle), because full paths were cut off past the now line. a31b882 changed S-016.2.8, S-016.4.2 and TimelineRow to match and the spec was re-approved; feature.md's Assumptions still name actionLabel for the row's action" }
  - { path: viewer/src/components/session-card.css, kind: follow-up-fix, reason: "After the build (0caee18), a collapsed card's tally (.ses-tally) gives way with an ellipsis once its goal has no room left, instead of widening the card past a 1024 px window. Its test is filed under S-016.6.6, whose THEN doesn't name it" }
  - { path: viewer/src/screens/activity/AgentTimeline.tsx, kind: follow-up-fix, reason: "After the build (0caee18), tickRoom, which contract.md doesn't list, limits each tick label's width so that a label the now label would cover is hidden (it wraps out of sight in timeline.css) instead of cut. Its test is filed under S-016.4.1, whose THEN doesn't name it" }
  - { path: viewer/src/components/SessionCard.tsx, kind: clarification, reason: "Thread entries draw IDs as ID chips (a raised item's ID, a commit's refs, a run's target), as impact.md plans, where the design draws plain IDs" }
  - { path: viewer/src/components/SessionCard.tsx, kind: clarification, reason: "A run's thread entry is its text alone (R-0142 failed · 2.1 s), without the design's agent name before it or its red failed: a run records only its session, and the Passed or Failed glyph before it carries the status" }
  - { path: viewer/src/screens/activity/thread.ts, kind: clarification, reason: "A thread lists every subagent of the joined live session; the timeline's rule that a subagent belongs to the session only when it started before the session's end isn't applied to threads" }
  - { path: viewer/src/components/SessionCard.tsx, kind: design-change, reason: "The handoff's title follows the design (Handoff · picked up by <SES> at 12:01) instead of Handoff to the next session, and its section keeps the aria-label Handoff to the next session" }
  - { path: viewer/src/components/SessionCard.tsx, kind: design-change, reason: "Collapsed cards keep the Session label before the SES ID, which the design's collapsed rows drop" }
  - { path: viewer/src/components/SessionCard.tsx, kind: clarification, reason: "The expanded header leaves out the subagent count at 0 (11:00–11:58 · 58m); feature.md shows the header only for a session with subagents" }
  - { path: viewer/src/screens/activity/live-cards.css, kind: design-change, reason: "The cards sit in an auto-fill grid of columns at least 240 px wide: three across in the feed column as in the design, fewer as it narrows, where the design fixes three columns" }
  - { path: viewer/src/screens/activity/live-cards.css, kind: clarification, reason: "S-016.8.5 reads the file's text, comments included, so its comment says nothing there moves rather than naming animation" }
  - { path: viewer/src/screens/activity/feed.ts, kind: scope-addition, reason: "A feed session takes its features from its activity session (the live features and feature as well as the touched IDs' features), so the feature filter keeps the same sessions in the feed as on the timeline and the cards (ST-016.3's intent), and the feature aside counts them the same way" }
  - { path: viewer/src/screens/activity/ActivityFeed.test.tsx, kind: test-change, reason: "An extra test, S-016.3.2 files a feed session under the features its live data names, as the timeline does, covers the feed's features; S-016.3.2 itself is a timeline scenario" }
  - { path: viewer/src/screens/activity/activity.css, kind: scope-addition, reason: "The header and the timeline sit above the feed and its feature aside, so the timeline runs the page's full width. .act-main widens from 900 to 980 px, the design's feed column, and at 1100 px and narrower the aside moves above the feed, under the timeline, instead of between the header and the feed" }
  - { path: docs/viewer.md, kind: scope-addition, reason: "Besides the Activity row of the Screens table, which impact.md plans, the doc gains a paragraph on the Activity screen under the table, as it has for Agents" }
follow_ups: [BUG-0078, DEBT-0011]
---
# F-016: As built

## Summary
Activity (`#/activity`) opens with the agent timeline, then a card per session running or waiting
on you, then the finished sessions as threads under Today, Yesterday and Earlier, all rendered from
the index; the index, the server, the hooks and the CLI are unchanged. Three new pure modules do
the work, each given `now`. `activityData` (`screens/activity/sessions.ts`) joins each persisted
session with the live session naming its SES and adds the live-only ones (keyed by SES, else by
Claude Code session ID), each with a start, an end (F-015's `sessionEnd` once the live session is
done), a status (`open`: a persisted session with no end and no live data) and features.
`attribute` gives each session its commits (by their `session`, or an agent commit without one by
the only session whose span holds it), runs (by `ses`, else by the owner of their commit;
`ses: null`, none), questions (`raised_by`) and the ADRs and issues its `raised` lists, an ADR
timed at `decided_at` only when that falls within the session; `pickedUpBy` names the first
session that started after one ended. `layoutTimeline` (`timeline.ts`) builds the window
(`timelineWindow`: Last 75 min ending at the next quarter hour, Today or 3 days, in local time), a
row per session with its subagents from F-015's `agentRows`, spans by status with the agents' wait
spans striped on top, markers for commits, runs, questions and timed ADRs, the now line and
Earlier today, as percentages rounded to two decimals. `sessionThreads` (`thread.ts`) gives each
persisted session its thread (subagents, commits, runs and raised items oldest first, then the
untimed ones), its subagent and run counts, who picked up its handoff and its transcript link.
`buildFeed(index, data)` leaves out the sessions shown as cards and the commits and runs in a
listed session's thread, so each appears once, and `byPeriod` replaces `byDay`.

`AgentTimeline` (`timeline.css`) draws the header with the range toggle (Last 75 min by default,
not remembered), the ticks, the now line, rows that state their status in words, a `title` and
`aria-label` on every span and marker, "✕" after a failed run, the legend and the Earlier today
line. A done or open session's row opens its card, a live session's row its transcript, and a
subagent's row its own transcript. `LiveCards` (`live-cards.css`) shows the running sessions, then
the waiting ones, each with F-015's `AgentStatusMark`, its time (`elapsed`), goal, features, task
and subagents, and its latest action or the wait's reason, linking to its transcript.
`SessionCard` loses its `live` prop and gains a status mark, the collapsed tally with runs
("11:00–11:58 · 3 commits · 3 runs (1 failed) · raised", dated in Earlier), the subagent count and
a Transcript link in the header, "picked up by" in the handoff, and a Thread in place of the Raised
and Commits facts. `ActivityFeed` groups by period without the time rail and puts the cards first
under Today. `Activity.tsx` adds the Subagents chip, "N sessions active" and the range state,
renders the timeline where `LiveStrip` was, and applies the kind chips to the timeline, the cards,
the threads and the feed, and the feature filter to the timeline, the cards and the feed.
`#/activity/SES-…` still expands and scrolls to a finished session, and lands on a running
session's card. `LiveStrip.tsx`, `activeLive` and `isLive` stay, no longer rendered on Activity,
as plan.md's open decision leaves them. Nothing F-016 adds animates.

Where the spec or the data differs from the handoff's design, the build follows them: the feature
filter stays the aside rather than the header's select (feature.md's Out of scope); card times use
`elapsed`, so under ten minutes they show seconds ("4m 01s") where the design shows "4m"; runs sit
on their session's row rather than a test-runner row, since a run records only its session; and an
ADR without a time (ADRs record only a date) is listed only in the thread, with no timeline marker.

Screenshots of the live viewer on the Hookline demo repo are kept in the session scratchpad
(`shots/F-016/`), not the repo: Activity at 1440, 1280 and 1024 px beside the design at 1440 px,
the Today and 3 days ranges, the routes to a finished and a running session, and the polish shots
after 0caee18 (the live screen, the Today and 3 days ranges and an Earlier card, at 1440 and
1024 px). Under `prefers-reduced-motion: reduce` the running mark's animation is `none`, and the
timeline has no animations. After 0caee18 nothing overflows at 1024 px and a tick label the now
label would cover is hidden, but at 1024 px the running rows' action labels are still clipped.

## Deviations
- T-016.2's implementation went into T-016.1's scaffold commit d0497ac, where plan.md has T-016.1
  write placeholder bodies. T-016.2's own commit 9af5ea2 holds only `sessions.test.ts`, so its
  tests came after the code they cover; `sessions.ts` hasn't changed since d0497ac.
- `SessionCard`'s `thread` prop was optional from T-016.1 to T-016.7 (d0497ac to bac240d), so the
  existing cards in `SessionCard.test.tsx` rendered without one. It is required, as contract.md has
  it, since bac240d.
- The session card's "Live now" dot went with the `live` prop that contract.md removes: a running
  or waiting session is a live card now, and a session card starts with its status mark.
- S-016.1.5's test gives run R-0150 commit 9f3c2e1, which SES-20261018-1100 owns, so it proves that
  `ses: null` wins over the commit's owner; the scenario's GIVEN names no commit for R-0150.
- A commit whose `session` names no activity session gets no owner. It isn't placed by time:
  `attribute` places by time only agent commits recorded without a session.
- T-016.3 built a running row's action from F-015's `actionLabel` of its agent's current event, as
  feature.md's Assumptions and S-016.2.8 said, where contract.md's `TimelineRow.action` read
  `current.summary`.
- After the build (0caee18, which stops clipping at 1024 px), a running row's action reads
  "<tool> <file name>" ("Edit policy.ts", as in the design) with the whole `actionLabel` as its
  title (`actionTitle`), because full paths were cut off past the now line; a31b882 changed
  S-016.2.8, S-016.4.2 and `TimelineRow` to match and the spec was re-approved, though feature.md's
  Assumptions still name `actionLabel` for the row's action. A collapsed card's tally
  (`.ses-tally`) gives way with an ellipsis once its goal has no room left, instead of widening the
  card. `tickRoom` in `AgentTimeline.tsx`, which contract.md doesn't list, hides a tick label the
  now label would cover instead of letting it be cut. The tally and tick tests are filed under
  S-016.6.6 and S-016.4.1, whose THENs don't name them.
- In the thread: IDs are ID chips (a raised item's ID, a commit's refs, a run's target), as
  impact.md plans, where the design draws plain IDs; a run's entry is its text alone ("R-0142
  failed · 2.1 s"), without the design's agent name or red "failed", since a run records only its
  session and the Passed or Failed glyph before it carries the status; and every subagent of the
  joined live session is listed, without the timeline's rule that a subagent belongs to the session
  only when it started before the session's end.
- On the session card: the handoff's title follows the design ("Handoff · picked up by
  SES-20261018-1201 at 12:01") and its section keeps the aria-label "Handoff to the next session";
  collapsed cards keep the "Session" label, which the design's collapsed rows drop; and the
  expanded header leaves out the subagent count at 0 ("11:00–11:58 · 58m").
- The live cards sit in an `auto-fill` grid of columns at least 240 px wide: three across in the
  feed column as in the design, fewer as it narrows, where the design fixes three columns.
  S-016.8.5 reads `live-cards.css`'s text, comments included, so its comment says nothing there
  moves rather than naming animation.
- A feed session takes its features from its activity session (the live `features` and `feature`
  as well as the touched IDs' features), so the feature filter keeps the same sessions in the feed
  as on the timeline and the cards (ST-016.3's intent), and the feature aside counts them the same
  way. An extra test in `ActivityFeed.test.tsx`, "S-016.3.2 files a feed session under the features
  its live data names, as the timeline does", covers it; S-016.3.2 itself is a timeline scenario.
- The header and the timeline sit above the feed and its feature aside, so the timeline runs the
  page's full width. `.act-main` widens from 900 to 980 px, the design's feed column, and at
  1100 px and narrower the aside moves above the feed, under the timeline, instead of between the
  header and the feed.
- Besides the Activity row of the Screens table, which impact.md plans, `docs/viewer.md` gains a
  paragraph on the Activity screen under the table, as it has for Agents.

Otherwise the files match `impact.md`.

## Follow-ups
- BUG-0078: timeline action labels clip at 1024 px and late in each quarter hour.
- DEBT-0011: the feature aside misses features seen only on live cards; a dead spacer in collapsed cards.
