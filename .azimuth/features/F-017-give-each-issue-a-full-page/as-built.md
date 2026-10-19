---
completed_at: 2026-10-20
files_changed:
  - { path: viewer/src/App.tsx, change: modify }
  - { path: viewer/src/screens/issues/IssuePage.tsx, change: create }
  - { path: viewer/src/screens/issues/IssueAside.tsx, change: create }
  - { path: viewer/src/screens/issues/RelatedWork.tsx, change: create }
  - { path: viewer/src/screens/issues/related.ts, change: create }
  - { path: viewer/src/screens/issues/IssueHistory.tsx, change: create }
  - { path: viewer/src/screens/issues/history.ts, change: create }
  - { path: viewer/src/screens/issues/issue-page.css, change: create }
  - { path: viewer/src/screens/issues/model.ts, change: modify }
  - { path: viewer/src/screens/issues/IssueDetail.tsx, change: modify }
  - { path: viewer/src/screens/issues/IssueTable.tsx, change: modify }
  - { path: viewer/src/screens/issues/issues.css, change: modify }
  - { path: viewer/src/screens/Issues.tsx, change: modify }
  - { path: viewer/src/components/IdChip.tsx, change: modify }
  - { path: viewer/src/lib/keys.ts, change: modify }
  - { path: viewer/src/components/ProblemsPanel.tsx, change: modify }
  - { path: viewer/src/lib/format.ts, change: modify }
  - { path: viewer/src/screens/Issues.test.tsx, change: create }
  - { path: viewer/src/screens/issues/IssuePage.test.tsx, change: create }
  - { path: viewer/src/screens/issues/IssueAside.test.tsx, change: create }
  - { path: viewer/src/screens/issues/related.test.tsx, change: create }
  - { path: viewer/src/screens/issues/history.test.tsx, change: create }
  - { path: docs/viewer.md, change: modify }
deviations:
  - { path: viewer/src/lib/keys.ts, kind: follow-up-fix, reason: "On the long page the arrow keys stepped to another issue instead of scrolling, so useListKeys gained arrows (default true) and the page passes arrows: false; only j and k move (5931bd5). contract.md's useListKeys has no arrows option" }
  - { path: viewer/src/screens/issues/IssueAside.tsx, kind: follow-up-fix, reason: "Open in editor and Copy ID now use the design's secondary and tertiary buttons at 32 px. Copy ID is a local CopyIdButton instead of CopyButton's small inline style, and issue-page.css pins the height because a base .lc-btn renders about 35 px (5931bd5)" }
  - { path: viewer/src/components/ProblemsPanel.tsx, kind: shared-change, reason: "editorLink's parameter widened from Problem to Pick<Problem, 'file' | 'line'> so the Source block can reuse it. Planned in impact.md and contract.md; recorded because it changes a shared component" }
follow_ups: [BUG-0070, DEBT-0006]
---
# F-017: As built

## Summary
Each issue has its own page at `#/issues/<id>/page` (`IssuePageScreen`, routed from `App.tsx`;
`parseRoute` already read the route). The header shows the issue's type, ID, status, severity (or
a risk's likelihood and impact) and age. Below it come a Triage card with the list's
`TriageControls`, the description through `Prose` without its Status notes, Related work and
History. `related.ts` derives related work from the index: open tasks and planning features that
touch the issue's files, linked IDs and risks that share a file. `history.ts` builds history from
the filing, the Status notes bullets and the commits whose `Refs` name the issue, oldest first.
Neither is stored. The aside holds the facts, linked feature cards with their progress, the files
with "Copy path" and planned changes, and the source with "Open in editor" and "Copy ID".

A row click, the row's ID chip and title link, Enter and the preview card's "Open full page" open
the page. On it, `j`/`k` step through every issue in `sortIssues` order, and `Esc` and the
breadcrumb return to the list with the issue selected. `routeForId` still sends issue IDs to the
list. Shared pieces gained small options: `IdChip` takes `to`, `useListKeys` takes `onBack` and
`arrows`, and `format.ts` has `longDate`.

## Deviations
- After the first build, the arrow keys stepped to another issue instead of scrolling the long
  page. `useListKeys` gained `arrows` (default `true`) and the page passes `arrows: false`, so
  only `j` and `k` move (5931bd5).
- The same commit set "Open in editor" and "Copy ID" to the design's secondary and tertiary
  buttons at 32 px. "Copy ID" is a local `CopyIdButton`, and `issue-page.css` pins the height
  because a base `.lc-btn` renders about 35 px.
- `editorLink` in `ProblemsPanel.tsx` takes any `{file, line}` instead of a `Problem`, so the
  Source block reuses it. This was planned; it is listed because it changes a shared component.

Otherwise the files match `impact.md`.

## Follow-ups
- BUG-0070: every `.lc-btn` renders about 34.8 px instead of the design's 32 px; only the issue
  page's Source buttons are pinned.
- DEBT-0006: `CopyIdButton` in IssueAside.tsx duplicates `CopyButton`'s copy logic.
- Not filed: `useListKeys` still treats the arrow keys like `j`/`k` on the other screens, including
  long pages such as the Plan tab and the inbox; it only matters if those pages need arrow
  scrolling.
