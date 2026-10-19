---
id: F-017
title: Give each issue a full page
summary: Each issue opens on its own page (`#/issues/<id>/page`) with triage controls, its description, related work and history derived from the index, linked features, files and source; the Issues list opens it from every row.
status: done
priority: P2
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:a29606ebeb23b0c71085411ec3da015c43f67effd3e452697e4a6bca922a3abc
approved_commit: 7b62199
review_ack_at: null
---
# F-017: Give each issue a full page

## Objective
Each issue opens on its own page at `#/issues/<id>/page`: a header with its type, ID, status,
severity and age; a Triage card with the same severity and status controls as the list; its
description as prose; the related work and history the index implies; and an aside with its
facts, linked features, files (with planned changes) and source file. The Issues list opens the
page from every row, from Enter and from the preview card's "Open full page" link, and on the
page `j`/`k` move to the previous/next issue and `Esc` goes back to the list.

## Out of scope
- Server, CLI and index contract changes: everything on the page comes from the current index.
- Storing related work or history anywhere: both are derived on every render.
- Editing an issue's title, body, links, files, likelihood or impact from the page: no viewer
  action exists for them.
- Changing where `routeForId` (ID chips, the command palette, the risk matrix) sends an issue ID:
  it keeps landing on the list at `#/issues/<id>`.
- Reworking the list's inline preview card beyond the "Open full page" link; it keeps its
  "Also changed by …" flag and commit list.
- Previous/next buttons on the page (the design has keys only).

## Integration points
- `viewer/src/App.tsx`: the `issues` case renders `IssuePageScreen` when `route.tab === "page"`,
  otherwise `IssuesScreen`; `Screen` is exported so tests can render a route.
- `viewer/src/screens/issues/model.ts`: `issuePageHref`, `issuePageTargets`, `issueAge`,
  `plannedChanges` and `plannedChangesLabel`, next to `sortIssues` and `featuresChanging`.
- `viewer/src/screens/issues/IssuePage.tsx` (new): the page; `j`/`k`/`Esc` through `useListKeys`.
- `viewer/src/screens/issues/IssueAside.tsx`, `RelatedWork.tsx`, `IssueHistory.tsx` (new): the
  page's aside and sections; `related.ts` and `history.ts` (new) derive their data.
- `viewer/src/screens/issues/IssueDetail.tsx`: `TriageControls` is exported for the page's Triage
  card; the preview card gets an "Open full page" link.
- `viewer/src/screens/issues/IssueTable.tsx`: a row click, its ID chip and its title link open the
  page.
- `viewer/src/screens/Issues.tsx`: `useListKeys`' `onOpen` (Enter) opens the selected issue's page;
  the top bar adds the "↵ open" hint.
- `viewer/src/components/IdChip.tsx`: an optional `to` link target (default `routeForId(id)`).
- `viewer/src/lib/keys.ts`: `useListKeys` gains `onBack`, called on `Esc`.
- `viewer/src/components/ProblemsPanel.tsx`: `editorLink` takes any `{file, line}`, so the page's
  Source block reuses it for "Open in editor".
- `viewer/src/lib/format.ts`: `longDate` ("Oct 14, 2026") for the aside's dates.
- `docs/viewer.md`: the Screens table, the Keyboard table and the Write actions table.

## Invariants
- Viewer only: `src/core/types.ts`, the server and the CLI don't change; related work and history
  are recomputed from the index on every render and never written.
- `routeForId` maps `BUG-`, `DEBT-` and `RISK-` IDs to `#/issues/<id>`, as before.
- Triage on the page runs the same actions as the list (`set` severity; `move` with the status
  you saw; won't fix only with a reason, through the same dialog) and is disabled, with
  `useCanAct`'s reason as the title, in an export or while disconnected.
- Page keys pause while typing in a field or select and while a dialog, the palette or the
  problems panel is open (`useListKeys`), so `Esc` in the won't-fix dialog closes the dialog and
  stays on the page.
- Issue bodies render through `Prose` (no HTML from file content), with glossary terms.

## Assumptions
- The route is `#/issues/<id>/page`. `parseRoute` already reads it as `{section: "issues", id,
  tab: "page"}`, so `lib/router.ts` doesn't change; `issuePageHref` builds the link.
- Clicking anywhere on a row opens the page, as the brief asks; moving the list's selection and
  preview stays on `j`/`k`.
- `j`/`k` on the page follow `sortIssues` over every issue in the index, closed ones included:
  the list's type and status filters are component state and aren't in the URL.
- `Esc` and the breadcrumb's "Issues" go to `#/issues/<id>`, the list with this issue selected.
- Related work, in this order and without duplicates (the first reason wins):
  1. open tasks (todo, in-progress, blocked) of active features (approved, in-progress,
     verifying) whose `files` include one of the issue's files: "Changes <paths>", plus
     " · covers <scenario IDs>" when the task covers any;
  2. features that plan to change one of the issue's files (`featuresChanging`: an active
     feature's impact creates or modifies it, or a file conflict names it) and have no task row:
     "Plans to change <paths>";
  3. IDs in `links` other than features: "Linked from <issue ID>";
  4. other risks that list one of the issue's files: "Shares <paths>".
  Issue rows link to the issue's page; other rows to `routeForId`. Linked features appear in the
  aside instead.
- History lists "filed" (the `created` date, by `found_by`), every Status notes bullet written as
  `<stamp> · <actor> · <from> → <to>: <reason>` and every index commit whose `refs` name the
  issue, oldest first. A bullet in another shape is shown as written after the dated entries.
  Moves made without a reason leave no Status note and so no history entry, and only commits
  within `git.log_depth` are in the index.
- A linked feature card's note is the feature's progress fact from `describe()` ("Tasks 3/6 · 4/8
  scenarios passing"). The design's notes are sample text.
- "open N days" counts calendar days from `created` to today in the viewer's time zone ("opened
  today" for 0, "open 1 day" for 1); a resolved or won't-fix issue shows "closed <resolved_at>".
- A risk shows its likelihood and impact where bugs and debt show severity (header, Triage card
  and aside), as the preview card does.
- Keyboard handlers can't run under `renderToStaticMarkup` in Vitest's node environment, and
  adding a DOM library would be a new dependency. Key scenarios therefore test the targets the
  handlers navigate to (`issuePageHref`, `issuePageTargets`) and the hints on screen; the
  handlers themselves are checked in the running viewer.
