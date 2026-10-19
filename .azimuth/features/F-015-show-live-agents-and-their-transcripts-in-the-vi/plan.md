---
tasks:
  - id: T-015.1
    title: Scaffolding (routes, shared signatures, CSS port and the live fixture)
    status: done
    after: []
    covers: []
    files: [viewer/src/lib/router.ts, viewer/src/App.tsx, viewer/src/components/CommandPalette.tsx, viewer/src/components/Icon.tsx, viewer/src/styles/azimuth.css, viewer/src/lib/status.ts, viewer/src/lib/format.ts, viewer/src/components/Status.tsx, viewer/src/data/IndexProvider.tsx, viewer/src/data/agents.ts, viewer/src/data/transcript.ts, viewer/src/screens/Agents.tsx, viewer/src/screens/agents/model.ts, viewer/src/screens/agents/transcript.ts, viewer/src/screens/agents/AgentTranscript.tsx, test/fixtures/live/agents.ts]
    verify: pnpm typecheck && pnpm exec vitest run viewer/src --reporter=verbose
    note: null
  - id: T-015.2
    title: Shared formats, status marks and agent rows (red → green)
    status: done
    after: [T-015.1]
    covers: [S-015.6.1, S-015.6.2, S-015.6.3, S-015.6.4, S-015.6.5, S-015.6.6, S-015.6.7, S-015.6.8]
    files: [viewer/src/lib/format.ts, viewer/src/lib/format.test.ts, viewer/src/components/Status.tsx, viewer/src/components/Status.test.tsx, viewer/src/data/agents.ts, viewer/src/data/agents.test.ts, viewer/src/styles/base.css]
    verify: pnpm exec vitest run viewer/src/lib/format.test.ts viewer/src/components/Status.test.tsx viewer/src/data/agents.test.ts --reporter=verbose
    note: null
  - id: T-015.3
    title: Agents in the sidebar, go-to keys and the palette (red → green)
    status: done
    after: [T-015.2]
    covers: [S-015.1.1, S-015.1.2, S-015.1.3, S-015.1.4, S-015.1.5, S-015.1.6, S-015.1.7]
    files: [viewer/src/components/AppShell.tsx, viewer/src/components/AppShell.test.tsx, viewer/src/lib/keys.ts, viewer/src/lib/keys.test.ts, viewer/src/components/CommandPalette.test.tsx, viewer/src/styles/base.css]
    verify: pnpm exec vitest run viewer/src/components/AppShell.test.tsx viewer/src/lib/keys.test.ts viewer/src/components/CommandPalette.test.tsx --reporter=verbose
    note: null
  - id: T-015.4
    title: Agents model (filters, edited files, overlaps, permission waits) (red → green)
    status: done
    after: [T-015.2]
    covers: [S-015.2.9, S-015.3.3, S-015.3.4, S-015.3.9]
    files: [viewer/src/screens/agents/model.ts, viewer/src/screens/agents/model.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/agents/model.test.ts --reporter=verbose
    note: null
  - id: T-015.5
    title: The Agents screen with its cards, groups and side panel (red → green)
    status: in-progress
    after: [T-015.4]
    covers: [S-015.2.1, S-015.2.2, S-015.2.3, S-015.2.4, S-015.2.5, S-015.2.6, S-015.2.7, S-015.2.8, S-015.2.10, S-015.3.1, S-015.3.2, S-015.3.5, S-015.3.6, S-015.3.7, S-015.3.8]
    files: [viewer/src/screens/Agents.tsx, viewer/src/screens/agents/AgentCard.tsx, viewer/src/screens/agents/AgentsAside.tsx, viewer/src/screens/agents/agents.css, viewer/src/screens/Agents.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/Agents.test.tsx --reporter=verbose
    note: null
  - id: T-015.6
    title: Loading transcript pages with the token (red → green)
    status: done
    after: [T-015.1]
    covers: [S-015.5.1, S-015.5.2, S-015.5.3, S-015.5.4, S-015.5.5, S-015.5.6, S-015.5.7]
    files: [viewer/src/data/transcript.ts, viewer/src/data/transcript.test.ts]
    verify: pnpm exec vitest run viewer/src/data/transcript.test.ts --reporter=verbose
    note: null
  - id: T-015.7
    title: Transcript tabs, keys and the now line (red → green)
    status: in-progress
    after: [T-015.2]
    covers: [S-015.4.3, S-015.4.7, S-015.4.8]
    files: [viewer/src/screens/agents/transcript.ts, viewer/src/screens/agents/transcript.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/agents/transcript.test.ts --reporter=verbose
    note: null
  - id: T-015.8
    title: The live transcript page (red → green)
    status: in-progress
    after: [T-015.3, T-015.6, T-015.7]
    covers: [S-015.4.1, S-015.4.2, S-015.4.4, S-015.4.5, S-015.4.6, S-015.4.9, S-015.4.10, S-015.4.11, S-015.4.12, S-015.4.13, S-015.4.14, S-015.4.15]
    files: [viewer/src/screens/agents/AgentTranscript.tsx, viewer/src/screens/agents/TranscriptEntries.tsx, viewer/src/screens/agents/TranscriptAside.tsx, viewer/src/screens/agents/transcript.css, viewer/src/screens/agents/AgentTranscript.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/agents/AgentTranscript.test.tsx --reporter=verbose
    note: null
  - id: T-015.9
    title: The Inbox's agent line follows the status (red → green)
    status: done
    after: [T-015.2]
    covers: [S-015.7.1, S-015.7.2, S-015.7.3]
    files: [viewer/src/screens/Inbox.tsx, viewer/src/screens/Inbox.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/Inbox.test.tsx --reporter=verbose
    note: null
  - id: T-015.10
    title: Docs, screenshots, live check and full verification
    status: in-progress
    after: [T-015.5, T-015.8, T-015.9]
    covers: []
    files: [docs/viewer.md, docs/getting-started.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-015: Plan

## Order and parallel lanes

Build after F-014 (this feature's dependency: the live fields, the transcript types and
`GET /api/transcript`), F-011 and F-009, which are built first. Test-first throughout.

- **T-015.1** adds the `agents` section and its routes in `App.tsx`, `SECTION_LABEL.agents`, the
  `agents` icon, the CSS rules ported verbatim, `AGENT_LOOK` (data, complete), `pageToken()` (tiny,
  complete, and used by `readBoot`), the signatures of every new module with placeholder bodies
  (`AgentsScreen` and `AgentTranscriptScreen` render a `Page` with their title; helpers return
  `""`, `[]`, `null` or zero counts), and the fixture `test/fixtures/live/agents.ts` exactly as
  contract.md's Test fixture describes. Existing viewer tests stay green.
- After it, **T-015.2** (shared formats, `AgentStatusMark`, `data/agents.ts`) and **T-015.6**
  (`data/transcript.ts`) run in parallel.
- After T-015.2: **T-015.3** (sidebar, keys, palette), **T-015.4** (Agents model), **T-015.7**
  (transcript model) and **T-015.9** (Inbox) run in parallel; their files are disjoint (T-015.3
  shares `base.css` with T-015.2, which it follows).
- **T-015.5** (Agents screen) follows T-015.4. **T-015.8** (transcript page) follows T-015.3
  (`useScreenKeys`), T-015.6 (`useTranscript`) and T-015.7. T-015.5 and T-015.8 have their own CSS
  files and can run together.
- **T-015.10** documents and verifies everything, including the screenshots and the live check
  below.

## Files shared with other features

- **F-016** (the Activity timeline, specified next): `viewer/src/components/AppShell.tsx` (this
  feature changes the nav and the footer strip) and `viewer/src/screens/activity/*`, which this
  feature leaves alone: `LiveStrip.tsx` and `feed.ts`'s `activeLive` keep the 120-second rule for
  F-016 to move to `status`. F-016 can depend on these pieces once T-015.2 is done: `AGENT_LOOK`
  and `AgentLook` (`lib/status.ts`), `AgentStatusMark` (`components/Status.tsx`), `elapsed`,
  `liveAgo` and `clockSeconds` (`lib/format.ts`), and `AgentRow`, `agentRows`, `activeSessions`,
  `sessionLabel`, `shortLabel`, `sessionEnd`, `agentDuration`, `IDLE_REASON`,
  `isPermissionWait` and `actionLabel` (`data/agents.ts`).
- **F-017** (in progress): `router.ts`, `App.tsx`, `keys.ts`, `AppShell.tsx`, `format.ts`,
  `status.ts`, `Status.tsx`. **F-012** (in progress): `Inbox.tsx`, `Inbox.test.tsx`.
  **F-008, F-011, F-012, F-014, F-017**: `docs/viewer.md`. Rebase on whatever of these lands
  first; each change here is an insertion or a small edit.

## Notes for builders

- Tests render with `renderToStaticMarkup` and an `IndexContext` value like
  `screens/activity/LiveStrip.test.tsx`'s (wrap in `UiProvider` for the sidebar, the palette and
  the transcript page), against `indexWithLive(…)` from the fixture, `now` = `AGENTS_NOW`, and
  `TZ=UTC` set in `beforeAll` the way `lib/format.test.ts` sets its zone. Each scenario ID is the
  start of exactly one test name.
- Effects don't run under `renderToStaticMarkup` and `pageToken()` is null outside a browser, so
  the transcript page is tested through `AgentTranscript` with a `TranscriptState` built with
  `applyTranscript`, and the empty states through `Screen` from `App.tsx` (export and missing
  transcript are checked before the token).
- S-015.3.8 imports `IDLE_REASON` from `src/core/live-agents.ts` in the test only; viewer code
  never imports that module.
- Markup follows the design's structure with class rules in `agents.css` and `transcript.css`
  (tokens only, no inline colours): the card grid (112 px status column), the tree with `.az-tree`
  and `.az-twig`, the transcript's 64 px time column and 860 px entry column, 300 px side panels
  that move under the main column below 1280 px (as `inbox.css` does), usable at 1024.
- Nothing in IdChip-bearing markup is nested inside another link: card heads aren't links (the
  "Transcript" link is), and a spawn card's only link is "Open its transcript →".
- `useTranscript` keeps the in-flight request in a ref, queues at most one more, and ignores a
  response for a session or agent that is no longer shown. "Following live" scrolls the list's
  end into view after entries change; it never stops fetching.

## T-015.10: docs, screenshots and the live check

1. Docs: `docs/viewer.md` gains Agents (`#/agents`) and Agent transcript
   (`#/agents/<claude-session>/<agent-id>`) rows in Screens; the go-to row becomes `` `g` then `i`
   `a` `o` `r` `f` `d` `q` `s` `t` `v` `k` `` (Inbox, Agents, Overview, Roadmap, Features,
   Decisions, Questions, Issues (`s`), Activity (`t`), Verification, Knowledge), plus rows for `[` /
   `]` (switch agents in a transcript), `f` (follow live) and `Esc` (from a transcript, back to
   Agents). `docs/getting-started.md` §4 says Agents shows what each session and subagent is doing,
   with a live transcript.
2. Screenshots: drive headless Chrome over CDP (remote debugging port,
   `Emulation.setDeviceMetricsOverride` 1440×900, `Page.captureScreenshot`; plain `--screenshot`
   hangs on the SSE stream). Capture `azimuth-viewer-handoff/screens/Agents.html` and
   `AgentTranscript.html` from disk and the live server's `#/agents` and `#/agents/c1201`, and
   compare them side by side. Keep scripts and images in the scratchpad, not the repo.
3. Live check, on port 4400 only (never touch the viewers on 4319 and 4321):
   - Build (`pnpm build`) and copy `plugin/dist/` to a scratch `…/plugin/dist/` so other agents'
     viewers aren't affected.
   - Make a demo repo: bundle a scratch entry that calls `createDemoRepo()` from
     `test/helpers/demo-repo.ts` with esbuild (`--platform=node --bundle`, defining
     `import.meta.url` as that file's URL so `FIXTURE_DIR` resolves) and print its root.
   - Put a transcript under `<tmp>/claude/projects/-demo/c1201.jsonl` (F-014's
     `test/fixtures/transcripts/c1.jsonl`, `/work/demo` replaced by the root, with its
     `c1/subagents/agent-a1.jsonl` renamed to match), write the sidecar
     `<root>/.azimuth/cache/live/c1201.meta.json` (`started_at`, `ses` SES-20261018-1100,
     `transcript_path`) and live records in `c1201.jsonl` (start, prompt, tool records with
     `added`/`removed`, launch, subagent).
   - Start `CLAUDE_CONFIG_DIR=<tmp>/claude node <scratch>/plugin/dist/cli.mjs view --serve --root
     <root> --port 4400` in the background.
   - With the CDP browser on `http://127.0.0.1:4400/#/agents`: append transcript lines (a message,
     a tool call and its result) and a live record every few seconds, and check that new entries
     appear at the bottom of `#/agents/c1201` without a reload, "Following live" keeps them in
     view and Pause stops it, `]`/`[` switch tabs and `Esc` returns to Agents; that a `wait` record
     moves the session to "Waiting on you" with a Needs you item, and an `end` record moves it to
     Finished today. Then stop the 4400 server and delete the temp folders.
   - Log the commands and what each step showed with `azimuth log T-015.10 "…"`.
