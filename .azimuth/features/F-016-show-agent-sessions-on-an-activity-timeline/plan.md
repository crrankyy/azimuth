---
tasks:
  - id: T-016.1
    title: Scaffolding (types, signatures, live fixture)
    status: done
    after: []
    covers: []
    files: [viewer/src/screens/activity/sessions.ts, viewer/src/screens/activity/timeline.ts, viewer/src/screens/activity/thread.ts, viewer/src/screens/activity/feed.ts, viewer/src/screens/activity/AgentTimeline.tsx, viewer/src/screens/activity/LiveCards.tsx, test/fixtures/live/timeline.ts, viewer/src/screens/activity/ActivityFeed.tsx, viewer/src/components/SessionCard.tsx, viewer/src/screens/Activity.tsx]
    verify: pnpm typecheck && pnpm exec vitest run viewer/src --reporter=verbose
    note: null
  - id: T-016.2
    title: Sessions joined and work attributed (red → green)
    status: done
    after: [T-016.1]
    covers: [S-016.1.1, S-016.1.2, S-016.1.3, S-016.1.4, S-016.1.5, S-016.1.6, S-016.1.7, S-016.1.8]
    files: [viewer/src/screens/activity/sessions.ts, viewer/src/screens/activity/sessions.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/activity/sessions.test.ts --reporter=verbose
    note: null
  - id: T-016.3
    title: Timeline window, rows, spans, markers and filters (red → green)
    status: in-progress
    after: [T-016.2]
    covers: [S-016.2.1, S-016.2.2, S-016.2.3, S-016.2.4, S-016.2.5, S-016.2.6, S-016.2.7, S-016.2.8, S-016.2.9, S-016.3.1, S-016.3.2, S-016.3.3]
    files: [viewer/src/screens/activity/timeline.ts, viewer/src/screens/activity/timeline.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/activity/timeline.test.ts --reporter=verbose
    note: null
  - id: T-016.4
    title: The Agent timeline component (red → green)
    status: in-progress
    after: [T-016.3]
    covers: [S-016.4.1, S-016.4.2, S-016.4.3, S-016.4.4, S-016.4.5]
    files: [viewer/src/screens/activity/AgentTimeline.tsx, viewer/src/screens/activity/timeline.css, viewer/src/screens/activity/AgentTimeline.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/activity/AgentTimeline.test.tsx --reporter=verbose
    note: null
  - id: T-016.5
    title: Cards for running and waiting sessions (red → green)
    status: in-progress
    after: [T-016.2]
    covers: [S-016.5.1, S-016.5.2, S-016.5.3, S-016.5.4]
    files: [viewer/src/screens/activity/LiveCards.tsx, viewer/src/screens/activity/live-cards.css, viewer/src/screens/activity/LiveCards.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/activity/LiveCards.test.tsx --reporter=verbose
    note: null
  - id: T-016.6
    title: Session threads (red → green)
    status: in-progress
    after: [T-016.2]
    covers: [S-016.6.1, S-016.6.2, S-016.6.3, S-016.6.4]
    files: [viewer/src/screens/activity/thread.ts, viewer/src/screens/activity/thread.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/activity/thread.test.ts --reporter=verbose
    note: null
  - id: T-016.7
    title: SessionCard shows the thread, tally and pick-up (red → green)
    status: in-progress
    after: [T-016.6]
    covers: [S-016.6.5, S-016.6.6, S-016.6.7]
    files: [viewer/src/components/SessionCard.tsx, viewer/src/components/session-card.css, viewer/src/components/SessionCard.test.tsx]
    verify: pnpm exec vitest run viewer/src/components/SessionCard.test.tsx --reporter=verbose
    note: null
  - id: T-016.8
    title: Feed periods and what threads and cards take over (red → green)
    status: done
    after: [T-016.2]
    covers: [S-016.7.1, S-016.7.2]
    files: [viewer/src/screens/activity/feed.ts, viewer/src/screens/activity/feed.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/activity/feed.test.ts --reporter=verbose
    note: null
  - id: T-016.9
    title: ActivityFeed by period with the cards first (red → green)
    status: in-progress
    after: [T-016.5, T-016.7, T-016.8]
    covers: [S-016.7.3, S-016.7.4]
    files: [viewer/src/screens/activity/ActivityFeed.tsx, viewer/src/screens/activity/activity.css, viewer/src/screens/activity/feed.ts, viewer/src/screens/activity/ActivityFeed.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/activity/ActivityFeed.test.tsx viewer/src/screens/activity/feed.test.ts --reporter=verbose
    note: null
  - id: T-016.10
    title: The Activity screen wires timeline, cards, threads and filters (red → green)
    status: in-progress
    after: [T-016.4, T-016.9]
    covers: [S-016.8.1, S-016.8.2, S-016.8.3, S-016.8.4, S-016.8.5]
    files: [viewer/src/screens/Activity.tsx, viewer/src/screens/activity/activity.css, viewer/src/screens/Activity.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/Activity.test.tsx --reporter=verbose
    note: null
  - id: T-016.11
    title: Docs, full verification and a screenshot against the design
    status: in-progress
    after: [T-016.10]
    covers: []
    files: [docs/viewer.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-016: Plan

## Sequencing

Build after F-014 (the live fields this feature reads) and F-015, which is built first and
provides, per its contract: `AGENT_LOOK` (`viewer/src/lib/status.ts`), `AgentStatusMark`
(`viewer/src/components/Status.tsx`), `elapsed` (`viewer/src/lib/format.ts`), `agentRows`,
`sessionEnd` and `actionLabel` (`viewer/src/data/agents.ts`), the `agents` route
(`#/agents/<claude-session>[/<agent>]`), `.az-run`, `.az-wait`, `.az-stripe` and the
reduced-motion rule in `viewer/src/styles/azimuth.css`, and the builders in
`test/fixtures/live/agents.ts`. If F-015's as-built renames any of them, use its names.

Files F-016 shares with features in flight:

- F-015 changes `viewer/src/components/AppShell.tsx`, `viewer/src/lib/keys.ts` (Activity on
  `g t`), `format.ts`, `Status.tsx`, `status.ts`, `router.ts` and `azimuth.css`; F-016 only reads
  them. F-015 leaves `viewer/src/screens/activity/*` (with `LiveStrip.tsx` and `activeLive`) to
  F-016. Both change `docs/viewer.md`.
- F-011: `viewer/src/components/SessionCard.tsx` and `session-card.css` (Goals and Notes), and
  `docs/viewer.md`.
- F-014: `viewer/src/screens/activity/LiveStrip.test.tsx` (its builders), `docs/viewer.md`.

Open decision, not part of this plan: deleting `LiveStrip.tsx`, `LiveStrip.test.tsx`,
`activeLive`, `isLive` and the `.live-*` styles once Activity no longer renders the strip (it
would delete F-005's S-005.3 tests).

## Order

Test-first. T-016.1 makes every change of signature in contract.md with placeholder bodies, so
the tree typechecks and today's tests stay green: the types and stubs of `sessions.ts`,
`timeline.ts` and `thread.ts` (`sessionThreads` returns, for each persisted session, a thread with
its status, no entries, zero counts and no pick-up); `AgentTimeline` and `LiveCards` rendering
only their labelled section or nothing; the complete `test/fixtures/live/timeline.ts`; `ActivityKind`, `Period`,
`PeriodGroup`, `byPeriod` (stub) and `buildFeed(index, data)` (data not used yet) in `feed.ts`;
`FeedState.threads` in place of `liveSessions` and `cards` on `ActivityFeed` (rendered later);
`SessionCard`'s `thread` and `dated` props in place of `live`; and `Activity.tsx` computing
`activityData`, the feed and the threads. Activity still renders `LiveStrip` until T-016.10.

After T-016.2 (`sessions.ts`, which everything else uses), four lanes touch separate files and
can run in parallel: the layout (T-016.3, then the component T-016.4), the cards (T-016.5), the
threads (T-016.6, then `SessionCard` in T-016.7) and the feed's data (T-016.8). T-016.9 brings the
feed component together (and removes `byDay`); T-016.10 wires the screen: the Subagents chip,
"N sessions active", the range state (default `75m`), `AgentTimeline` in place of `LiveStrip`,
filtered cards, and the kind and feature filters passed to the timeline, threads and feed.

## Notes for builders

- Tests set `process.env.TZ` in `beforeAll` and restore it in `afterAll`, as
  `viewer/src/lib/format.test.ts` does: `UTC` everywhere except S-016.2.2 (America/Los_Angeles).
- Component tests render with `renderToStaticMarkup` inside `UiProvider` and
  `IndexContext.Provider`, with `now` = `FIXTURE_NOW` and `fixtureIndex()`, as
  `viewer/src/screens/Inbox.test.tsx` does; the screen tests render `ActivityScreen` with
  `parseRoute("#/activity…")`. Effects don't run there, so S-016.8.2 and S-016.8.3 assert the
  expanded card and the scroll target's id; T-016.11 checks the scroll in the browser.
- Links to transcripts are F-015's `AgentRow.href` or `href("agents", claudeSession)`, never built
  by hand; the tests assert the resulting `#/agents/…` strings.
- Inside a timeline row (an `<a>`), IDs are `<span class="az-id">`, not `IdChip` links: anchors
  can't nest.
- Percentages are rounded once, at the end: `Math.round(x * 100) / 100` of the clipped start and
  of the clipped duration.
- S-016.8.5 reads the CSS files with `readFileSync` (paths from `import.meta.url`); the
  reduced-motion rule it checks in `azimuth.css` is F-015's.
- Styles follow `azimuth-viewer-handoff/canvas-source/Activity.dc.html` (label column 280 px,
  40 px session rows and 28 px subagent rows, `.az-stripe` on waiting spans, diamonds for raised
  items, rings for commits, squares for runs). No `animation` in `timeline.css` or
  `live-cards.css`.
- `test/fixtures/live/timeline.ts` is outside Prettier and ESLint like the rest of
  `test/fixtures/` (and F-015's `agents.ts`), and typechecked through the tests that import it.

## T-016.11: screenshot against the design

After the docs (the Activity row of the Screens table in `docs/viewer.md`) and the full check,
compare the live screen with `azimuth-viewer-handoff/screens/Activity.html` at 1440×900. Never use
or stop the viewers on ports 4319 and 4321; scripts and screenshots go in the scratchpad.

1. `pnpm build`. Bundle `test/helpers/demo-repo.ts` with esbuild (an entry that calls
   `createDemoRepo()` and prints its `root`), defining `import.meta.url` as that file's URL so
   `FIXTURE_DIR` resolves, and run it with node: it prints a temporary Hookline repo.
2. In that repo, start `node <repo>/plugin/dist/cli.mjs view --serve --port 4400` in the
   background.
3. Create live sessions there like the design's: for each, run
   `AZIMUTH_CLAUDE_SESSION=<id> … session start --skill pm-build --goal "…"` and append F-014
   records (`start`, `prompt`, `launch`, `subagent`, `tool`, `wait`, `subagent-stop`, `stop`,
   `end`) to `.azimuth/cache/live/<id>.jsonl`, timed relative to now: one session finished an
   hour ago with a subagent, one waiting on a permission prompt for 5 minutes, two running with a
   subagent each.
4. Drive headless Chrome over CDP (a plain `--screenshot` hangs on the live SSE stream):
   `Emulation.setDeviceMetricsOverride` 1440×900, open `http://127.0.0.1:4400/#/activity`, wait
   for the timeline, `Page.captureScreenshot`; capture the design file the same way and compare.
   Then `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce` and check that
   `getComputedStyle(document.querySelector(".az-run")).animationName` is `none`. Open
   `#/activity/SES-…` of the finished session and check that its card is expanded and scrolled
   into view.
5. Stop the port-4400 server and delete the demo repo. Record what differs from the design in
   as-built.md.
