# F-017: Stories

Scenarios use the Hookline fixture index (`test/fixtures/hookline/expected-index.ts`), where the
Issues list order (`sortIssues`) is BUG-0001, DEBT-0001, RISK-0001, BUG-0002, and "now" is
2026-10-18T12:00:00Z.

## ST-017.1 · Open an issue's page from Issues
**Intent:** As the developer, I want every issue in the Issues list to open its own page so that I can read and triage it with its context in view.

### S-017.1.1 · A row's ID and title link to the issue's page {happy}
- **GIVEN** the Hookline index and the route `#/issues`
- **WHEN** the Issues screen renders
- **THEN** BUG-0001's row has an ID chip and a title link, both with href `#/issues/BUG-0001/page`

### S-017.1.2 · The preview card links to the full page {happy}
- **GIVEN** the route `#/issues/BUG-0001`
- **WHEN** the Issues screen renders
- **THEN** the preview card has a link "Open full page" with href `#/issues/BUG-0001/page`

### S-017.1.3 · The list offers Enter to open the selected issue {happy}
- **GIVEN** the route `#/issues/DEBT-0001`
- **WHEN** the Issues screen renders
- **THEN** the top bar shows the hints `j` `k` "move" and `↵` "open", DEBT-0001's row has `aria-selected="true"`, and `issuePageHref("DEBT-0001")`, where Enter leads, is `#/issues/DEBT-0001/page`

### S-017.1.4 · ID chips elsewhere still land on the list {edge}
- **GIVEN** the issue ID `BUG-0001`
- **WHEN** `routeForId` resolves it, as every ID chip outside the Issues table does
- **THEN** it returns `#/issues/BUG-0001`

## ST-017.2 · Reach and leave an issue's page
**Intent:** As the developer, I want an issue's page to have its own address and keys so that I can step through issues and get back to the list without the mouse.

### S-017.2.1 · The page route renders the issue's page {happy}
- **GIVEN** the Hookline index
- **WHEN** the viewer renders the route `#/issues/BUG-0001/page`
- **THEN** the breadcrumb reads "Issues / BUG-0001" with "Issues" linking to `#/issues/BUG-0001`, the top bar shows the hints `j` `k` "previous / next issue" and `esc` "back to list", the h1 is "Worker can double-send when SQLite returns SQLITE_BUSY after the request", and there is no issues table

### S-017.2.2 · An unknown ID shows an empty state {negative}
- **GIVEN** no issue `BUG-9999` in the index
- **WHEN** the viewer renders the route `#/issues/BUG-9999/page`
- **THEN** it shows an empty state titled "BUG-9999 isn't in this index" with a link "Back to all issues" to `#/issues`

### S-017.2.3 · j, k and Esc lead to the neighbours and the list {happy}
- **GIVEN** DEBT-0001's page
- **WHEN** you press `j`, `k` or `Esc` (`issuePageTargets(issues, "DEBT-0001")`)
- **THEN** `j` leads to `#/issues/RISK-0001/page`, `k` to `#/issues/BUG-0001/page` and `Esc` to `#/issues/DEBT-0001`

### S-017.2.4 · j and k stop at either end of the list {edge}
- **GIVEN** BUG-0001's page, the first in list order, and BUG-0002's page, the last
- **WHEN** you press `k` on BUG-0001's page and `j` on BUG-0002's page
- **THEN** `issuePageTargets` gives `previous: null` for BUG-0001 and `next: null` for BUG-0002, so the page stays where it is

### S-017.2.5 · The page lays out its sections {happy}
- **GIVEN** BUG-0001's page
- **WHEN** it renders
- **THEN** the main column holds, in order, the header, the section labelled "Triage", the description, "Related work" and "History", and the aside is labelled "Issue details"

## ST-017.3 · Header, triage and description
**Intent:** As the developer, I want the page to say what the issue is, how old it is and let me triage it so that I can act on it without going back to the list.

### S-017.3.1 · The header names the issue {happy}
- **GIVEN** BUG-0001: a bug, open, severity high, found by you, created 2026-10-14
- **WHEN** its page renders
- **THEN** the header shows "Bug", "BUG-0001", the status pill "Open", the pill "High severity" and "Found by you · Oct 14 · open 4 days"

### S-017.3.2 · Risks, sessions and closed issues read differently {edge}
- **GIVEN** RISK-0001 (likelihood medium, impact high), DEBT-0001 (found by `SES-20261017-1430`, created 2026-10-17) and BUG-0002 (resolved, created 2026-09-12, resolved 2026-09-15)
- **WHEN** their pages render
- **THEN** RISK-0001's header shows "Likelihood medium · Impact high" and no severity pill, DEBT-0001's reads "Found by SES-20261017-1430 · Oct 17 · open 1 day", and BUG-0002's reads "Found by you · Sep 12 · closed Sep 15"

### S-017.3.3 · The Triage card triages in place {happy}
- **GIVEN** BUG-0001's page in a live viewer
- **WHEN** it renders
- **THEN** the Triage card has an enabled Severity select with "High" selected, an enabled Status select with "Open" selected, and the line "Changes write .azimuth/issues/BUG-0001-double-send-on-busy.md"

### S-017.3.4 · Triage is disabled when the viewer can't act {negative}
- **GIVEN** a disconnected viewer
- **WHEN** BUG-0001's page renders
- **THEN** the Severity and Status selects are both `disabled` and titled "Disconnected from azimuth view."

### S-017.3.5 · The description renders as prose without its Status notes {happy}
- **GIVEN** BUG-0001 whose body is the fixture's Repro, Expected and Actual followed by "## Status notes" and the bullet "- 2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers"
- **WHEN** its page renders
- **THEN** the description has the h2 headings "Repro", "Expected" and "Actual" and no "Status notes" heading or "Reproduced with two workers" text

### S-017.3.6 · An issue without a description says so {edge}
- **GIVEN** BUG-0001 whose body is only a "## Status notes" section
- **WHEN** its page renders
- **THEN** the description reads "No description yet."

## ST-017.4 · Related work, derived from the index
**Intent:** As the developer, I want to see the planned work and the items an issue touches so that I know what will change its files and what it connects to, without anyone recording it.

### S-017.4.1 · Open tasks and feature plans that change the issue's files {happy}
- **GIVEN** BUG-0001, which lists `src/worker/deliver.ts`; F-005 (in-progress) with T-005.5 (blocked, covers S-005.3.1 and S-005.3.2) and T-005.6 (todo) listing that file; and F-007 (verifying) with a file conflict on it
- **WHEN** related work is derived for BUG-0001
- **THEN** it is T-005.5 "Changes src/worker/deliver.ts · covers S-005.3.1, S-005.3.2" (Blocked, `#/features/F-005/plan/T-005.5`), T-005.6 "Changes src/worker/deliver.ts" (Todo, `#/features/F-005/plan/T-005.6`) and F-007 "Plans to change src/worker/deliver.ts" (Verifying, `#/features/F-007`), in that order

### S-017.4.2 · Linked decisions and risks that share a file {happy}
- **GIVEN** RISK-0001, which links ADR-0001 and lists `src/store/db.ts`, and an added open risk RISK-0003 that also lists `src/store/db.ts`
- **WHEN** related work is derived for RISK-0001
- **THEN** it is ADR-0001 "Linked from RISK-0001" (Accepted, `#/decisions/ADR-0001`) then RISK-0003 "Shares src/store/db.ts" (Open, `#/issues/RISK-0003/page`)

### S-017.4.3 · Done tasks drop out and their feature's plan stands in {negative}
- **GIVEN** the Hookline index with T-005.5 and T-005.6 both marked done
- **WHEN** related work is derived for BUG-0001
- **THEN** it has no task rows and is F-005 "Plans to change src/worker/deliver.ts" (In progress) then F-007 "Plans to change src/worker/deliver.ts" (Verifying)

### S-017.4.4 · Nothing related {edge}
- **GIVEN** BUG-0002, which lists `src/api/endpoints.ts` (no active feature plans it) and links only F-001
- **WHEN** its Related work section renders
- **THEN** `relatedWork` returns `[]` and the section shows the line `RELATED_RULE` and "Nothing related yet."

## ST-017.5 · The aside: facts, linked features, files and source
**Intent:** As the developer, I want an issue's facts, features, files and source file at hand so that I can jump to the code and the features involved.

### S-017.5.1 · The facts card {happy}
- **GIVEN** BUG-0001, and RISK-0001 (likelihood medium, impact high)
- **WHEN** their pages render
- **THEN** BUG-0001's facts are Type "Bug", Severity "High", Status "Open", Found by "You", Created "Oct 14, 2026" and Resolved "—", and RISK-0001's show Likelihood "Medium" and Impact "High" in place of Severity

### S-017.5.2 · Linked features as cards {happy}
- **GIVEN** BUG-0001, which links F-003 (done, tasks 7/7, 9/9 scenarios passing) and F-005 (in progress, tasks 3/6, 4/8 passing)
- **WHEN** its page renders
- **THEN** "Linked features" has a card for F-003 "Delivery worker" with the pill "Done" and the note "Tasks 7/7 · 9/9 scenarios passing" linking to `#/features/F-003`, and one for F-005 "Retry with exponential backoff" with "In progress" and "Tasks 3/6 · 4/8 scenarios passing" linking to `#/features/F-005`

### S-017.5.3 · Files show what is planned to change them {happy}
- **GIVEN** BUG-0001, which lists `src/worker/deliver.ts`, modified by F-005's impact and named in F-007's file conflict
- **WHEN** its page renders
- **THEN** "Files" shows `src/worker/deliver.ts` with a "Copy path" button and the flag "Planned changes: F-005 (modify) and F-007"

### S-017.5.4 · A file nobody plans to change has no flag {edge}
- **GIVEN** BUG-0002, which lists `src/api/endpoints.ts`
- **WHEN** its page renders
- **THEN** "Files" shows `src/api/endpoints.ts` with a "Copy path" button and no "Planned changes" flag

### S-017.5.5 · The source file opens in your editor {happy}
- **GIVEN** `editor_url` `vscode://file/{abs}:{line}` and `root` `/work/hookline`
- **WHEN** BUG-0001's page renders
- **THEN** "Source" shows `.azimuth/issues/BUG-0001-double-send-on-busy.md`, a link "Open in editor" to `vscode://file//work/hookline/.azimuth/issues/BUG-0001-double-send-on-busy.md:1` and a "Copy ID" button

### S-017.5.6 · No editor link without a root {negative}
- **GIVEN** `editor_url` `vscode://file/{abs}:{line}` and `root` `null`, as in an export
- **WHEN** BUG-0001's page renders
- **THEN** "Source" has no "Open in editor" link and still has the "Copy ID" button

## ST-017.6 · History, derived from the issue and its commits
**Intent:** As the developer, I want an issue's page to show what happened to it, when and why, so that I don't have to dig through git log and the file.

### S-017.6.1 · Filed, moved and committed, oldest first {happy}
- **GIVEN** BUG-0001 with the Status notes bullet "2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers" and a commit `abc1234` at 2026-10-16T12:00:00Z, subject "fix(F-005): keep the lease while recording the outcome", refs `[F-005, BUG-0001]`, besides the fixture's commits
- **WHEN** its history is derived
- **THEN** it is `{kind: "created", at: "2026-10-14", by: "you"}`, `{kind: "status", at: "2026-10-15T12:00:00Z", actor: "agent", from: "open", to: "in-progress", reason: "Reproduced with two workers"}` and `{kind: "commit", at: "2026-10-16T12:00:00Z", sha: "abc1234", subject: "fix(F-005): keep the lease while recording the outcome"}`, in that order

### S-017.6.2 · The History section reads as a timeline {happy}
- **GIVEN** the BUG-0001 of S-017.6.1
- **WHEN** its History section renders
- **THEN** its rows read "Oct 14 You filed it", "Oct 15 An agent moved it from Open to In progress: Reproduced with two workers" and "Oct 16 abc1234 fix(F-005): keep the lease while recording the outcome"

### S-017.6.3 · An issue no commit names says so {edge}
- **GIVEN** the fixture's BUG-0001: no Status notes, and no commit whose refs include BUG-0001
- **WHEN** its History section renders
- **THEN** its rows read "Oct 14 You filed it" and "— No commit references BUG-0001 yet"

### S-017.6.4 · A hand-written status note is kept as written {edge}
- **GIVEN** BUG-0001 whose Status notes are the bullet "Checked again after the F-005 merge" followed by the bullet "2026-10-15T12:00:00Z · you · open → resolved: Fixed by F-005"
- **WHEN** its history is derived
- **THEN** the entries are created, then the status entry at 2026-10-15T12:00:00Z, then `{kind: "note", at: null, text: "Checked again after the F-005 merge"}` last
