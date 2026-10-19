---
files:
  - path: viewer/src/App.tsx
    change: modify
    note: The issues section renders IssuePageScreen for `#/issues/<id>/page`; Screen is exported for tests
  - path: viewer/src/screens/issues/IssuePage.tsx
    change: create
    note: IssuePageScreen; breadcrumb and key hints, header, Triage card, description, sections, aside; j/k/Esc; unknown ID
  - path: viewer/src/screens/issues/IssueAside.tsx
    change: create
    note: Facts card, linked feature cards, files with Copy path and planned changes, source with Open in editor and Copy ID
  - path: viewer/src/screens/issues/RelatedWork.tsx
    change: create
    note: The Related work section, its rule line and its empty state
  - path: viewer/src/screens/issues/related.ts
    change: create
    note: relatedWork() and RELATED_RULE, derived from the index
  - path: viewer/src/screens/issues/IssueHistory.tsx
    change: create
    note: The History section, with the no-commit line
  - path: viewer/src/screens/issues/history.ts
    change: create
    note: issueHistory() and bodyWithoutStatusNotes()
  - path: viewer/src/screens/issues/issue-page.css
    change: create
    note: Page layout, header, Triage card, related work and history rows, aside
  - path: viewer/src/screens/issues/model.ts
    change: modify
    note: issuePageHref, issuePageTargets, issueAge, plannedChanges, plannedChangesLabel
    symbols: [issuePageHref, issuePageTargets, issueAge, plannedChanges, plannedChangesLabel]
  - path: viewer/src/screens/issues/IssueDetail.tsx
    change: modify
    note: Export TriageControls; "Open full page" link in the preview card
    symbols: [TriageControls]
  - path: viewer/src/screens/issues/IssueTable.tsx
    change: modify
    note: Row click, ID chip and title link open the issue's page
  - path: viewer/src/screens/issues/issues.css
    change: modify
    note: The title link and its chevron in the table
  - path: viewer/src/screens/Issues.tsx
    change: modify
    note: Enter opens the selected issue's page; the "↵ open" hint
  - path: viewer/src/components/IdChip.tsx
    change: modify
    note: Optional `to` link target, defaulting to routeForId(id)
    symbols: [IdChip]
  - path: viewer/src/lib/keys.ts
    change: modify
    note: useListKeys calls onBack on Esc
    symbols: [useListKeys]
  - path: viewer/src/components/ProblemsPanel.tsx
    change: modify
    note: editorLink takes Pick<Problem, "file" | "line"> so the issue page can reuse it
    symbols: [editorLink]
  - path: viewer/src/lib/format.ts
    change: modify
    note: longDate ("Oct 14, 2026")
    symbols: [longDate]
  - path: viewer/src/lib/router.ts
    change: read
    note: parseRoute already reads `#/issues/<id>/page`; href and routeForId stay as they are
  - path: viewer/src/components/AppShell.tsx
    change: read
    note: Page, Hint and useCanAct
  - path: viewer/src/components/CodeBlock.tsx
    change: read
    note: CopyButton for Copy path and Copy ID
  - path: viewer/src/components/Status.tsx
    change: read
    note: StatusGlyph, StatusPill and FeatureStatusPill
  - path: viewer/src/data/selectors.ts
    change: read
    note: describe() gives titles, looks and the feature progress fact
  - path: viewer/src/lib/markdown.tsx
    change: read
    note: Prose for the description
  - path: viewer/src/lib/status.ts
    change: read
    note: ISSUE_LOOK, TASK_LOOK and FEATURE_LOOK
  - path: src/core/types.ts
    change: read
    note: Issue, Commit, Index and ImpactChange (unchanged)
  - path: src/core/flows.ts
    change: read
    note: ACTIVE_STATUSES
  - path: src/core/transitions.ts
    change: read
    note: The Status notes bullet format written by addStatusNote
  - path: viewer/src/screens/Issues.test.tsx
    change: test
    note: Rows, preview card and hints link to the page; routeForId still lands on the list
  - path: viewer/src/screens/issues/IssuePage.test.tsx
    change: test
    note: Route, unknown ID, key targets, header, Triage card, description, section order
  - path: viewer/src/screens/issues/IssueAside.test.tsx
    change: test
    note: Facts, linked feature cards, files and planned changes, source links
  - path: viewer/src/screens/issues/related.test.tsx
    change: test
    note: relatedWork() for tasks, plans, links and shared risk files; the empty section
  - path: viewer/src/screens/issues/history.test.tsx
    change: test
    note: issueHistory() order and shapes; the rendered History section
  - path: docs/viewer.md
    change: modify
    note: The issue page in Screens, its keys in Keyboard, triage on it in Write actions
---
# F-017: Impact map

Viewer only. The page reads the same index the list does. `related.ts` and `history.ts` derive
its two computed sections, `model.ts` holds the link and key targets, and the list changes are
limited to where a row, its ID, its title, Enter and the preview card lead.
