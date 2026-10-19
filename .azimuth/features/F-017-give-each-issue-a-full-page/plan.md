---
tasks:
  - id: T-017.1
    title: Types & scaffolding
    status: in-progress
    after: []
    covers: []
    files: [viewer/src/App.tsx, viewer/src/screens/issues/IssuePage.tsx, viewer/src/screens/issues/model.ts, viewer/src/screens/issues/history.ts, viewer/src/screens/issues/related.ts, viewer/src/screens/issues/IssueHistory.tsx, viewer/src/screens/issues/RelatedWork.tsx, viewer/src/screens/issues/IssueAside.tsx, viewer/src/screens/issues/IssueDetail.tsx]
    verify: pnpm typecheck
    note: null
  - id: T-017.2
    title: History derived from Status notes and commits (red → green)
    status: in-progress
    after: [T-017.1]
    covers: [S-017.6.1, S-017.6.2, S-017.6.3, S-017.6.4]
    files: [viewer/src/screens/issues/history.ts, viewer/src/screens/issues/IssueHistory.tsx, viewer/src/screens/issues/history.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/issues/history.test.tsx --reporter=verbose
    note: null
  - id: T-017.3
    title: Related work derived from files and links (red → green)
    status: in-progress
    after: [T-017.1]
    covers: [S-017.4.1, S-017.4.2, S-017.4.3, S-017.4.4]
    files: [viewer/src/screens/issues/related.ts, viewer/src/screens/issues/RelatedWork.tsx, viewer/src/screens/issues/related.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/issues/related.test.tsx --reporter=verbose
    note: null
  - id: T-017.4
    title: The Issues list opens the page (red → green)
    status: in-progress
    after: [T-017.1]
    covers: [S-017.1.1, S-017.1.2, S-017.1.3, S-017.1.4]
    files: [viewer/src/screens/Issues.tsx, viewer/src/screens/issues/IssueTable.tsx, viewer/src/screens/issues/IssueDetail.tsx, viewer/src/components/IdChip.tsx, viewer/src/screens/issues/issues.css, viewer/src/screens/Issues.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/Issues.test.tsx --reporter=verbose
    note: null
  - id: T-017.5
    title: The page's route, keys, header, triage and description (red → green)
    status: in-progress
    after: [T-017.2]
    covers: [S-017.2.1, S-017.2.2, S-017.2.3, S-017.2.4, S-017.2.5, S-017.3.1, S-017.3.2, S-017.3.3, S-017.3.4, S-017.3.5, S-017.3.6]
    files: [viewer/src/screens/issues/IssuePage.tsx, viewer/src/screens/issues/model.ts, viewer/src/lib/keys.ts, viewer/src/screens/issues/issue-page.css, viewer/src/screens/issues/IssuePage.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/issues/IssuePage.test.tsx --reporter=verbose
    note: null
  - id: T-017.6
    title: The aside, and styles for every section (red → green)
    status: in-progress
    after: [T-017.3, T-017.5]
    covers: [S-017.5.1, S-017.5.2, S-017.5.3, S-017.5.4, S-017.5.5, S-017.5.6]
    files: [viewer/src/screens/issues/IssueAside.tsx, viewer/src/screens/issues/model.ts, viewer/src/lib/format.ts, viewer/src/components/ProblemsPanel.tsx, viewer/src/screens/issues/issue-page.css, viewer/src/screens/issues/IssueAside.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/issues/IssueAside.test.tsx --reporter=verbose
    note: null
  - id: T-017.7
    title: Docs and full verification
    status: in-progress
    after: [T-017.4, T-017.6]
    covers: []
    files: [docs/viewer.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-017: Plan

Test-first. T-017.1 exports `TriageControls`, adds `issuePageHref`, wires the route in `App.tsx`
(and exports `Screen`), and creates the new modules as typed stubs: `history.ts`, `related.ts`,
and `IssueHistory`, `RelatedWork` and `IssueAside` rendering only their labelled
`<section>`/`<aside>` and heading, so the page can compose them before they are built.

After it, history (T-017.2), related work (T-017.3) and the list (T-017.4) touch separate files and
can be built in parallel. The page (T-017.5) waits for T-017.2 because its description uses
`bodyWithoutStatusNotes`. The aside (T-017.6) comes after the page, whose `model.ts` and
`issue-page.css` it extends, and after related work, so it can style every section from the
design (`azimuth-viewer-handoff/canvas-source/IssueDetail.dc.html`) at once.

Tests render with `renderToStaticMarkup` inside `UiProvider` and `IndexContext.Provider` (the
Triage controls call `useUi`), from the Hookline fixture with `now` at 2026-10-18T12:00:00Z, as in
`viewer/src/screens/activity/LiveStrip.test.tsx`. Effects don't run there, so key handlers are
tested through the targets they navigate to; T-017.7 also checks `j`, `k`, `Esc` (including Esc
inside the won't-fix dialog), Enter and row clicks in the running viewer before closing.
