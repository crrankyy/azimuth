# F-028: Stories

Unless a scenario says otherwise, a project is `MINIMAL_CONFIG` (`test/helpers/tree.ts`) with
`src/app.ts`, and "the milestone file" is `.azimuth/milestones/M-01-mvp.md` holding
`---\nid: M-01\ntitle: MVP\nstatus: active\ntarget: null\nreleased_at: null\ngoal: Ship it.\n---\n## Scope notes\n`,
with the status a scenario names. F-001 and F-002 are written with `featureFiles`
(`test/helpers/project.ts`) with `extra: { milestone: "M-01" }` and status `done`, unless a
scenario says otherwise. A git project is `initRepo` then `commitAll(root, "chore: start")`
(`test/helpers/git.ts`), whose SHA is H. Core calls run with `now` 2026-10-31T12:00:00Z. The
CLI runs through `runCli` (`test/helpers/cli.ts`), as the agent unless a scenario sets
`AZIMUTH_ACTOR=you`. "The fixture index" is a clone of `expectedIndex`
(`test/fixtures/hookline/expected-index.ts`), where M-01 is released on 2026-09-28 with 3 of 3
features done, M-02 is active with 0 of 3 done and M-03 is planned with 0 of 3 done.

## ST-028.1 · Refs may name a milestone or an issue
**Intent:** As an agent committing a release or a records-only change, I want a `Refs:` trailer naming a milestone or an issue to link the commit to that item, so that the release and the issue keep their commits.

### S-028.1.1 · A release commit's Refs link it to the milestone {happy}
- **GIVEN** a git project with the milestone file and no feature
- **WHEN** `commitAll(root, "chore(azimuth): release M-01\n\nRefs: M-01")` runs and then `buildIndex(root)`
- **THEN** `index.commits[0].refs` is `["M-01"]`
- **AND** `azimuth check M-01` exits 0 with stdout `No problems.\n`

### S-028.1.2 · A records-only commit's Refs link it to the issue {edge}
- **GIVEN** a git project with `.azimuth/issues/BUG-0001-x.md` holding `---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n`
- **WHEN** `commitAll(root, "chore(azimuth): file BUG-0001\n\nRefs: BUG-0001")` runs and then `buildIndex(root)`
- **THEN** `index.commits[0].refs` is `["BUG-0001"]`
- **AND** `azimuth check BUG-0001` exits 0 with stdout `No problems.\n`

### S-028.1.3 · Without a trailer, a milestone in the scope still links {edge}
- **GIVEN** a git project with the milestone file and no feature
- **WHEN** `commitAll(root, "chore(M-01): release")` runs and then `buildIndex(root)`
- **THEN** `index.commits[0].refs` is `["M-01"]`

### S-028.1.4 · The protocol says a commit may name a milestone or an issue {happy}
- **GIVEN** the `PROTOCOL` string of `src/core/protocol.ts`
- **WHEN** it is read
- **THEN** it contains ``- Commit with Conventional Commits and a `Refs:` trailer naming the task or feature\n  (`Refs: T-005.2`). A commit about another item names that item instead: a release commit its\n  milestone (`Refs: M-04`), a records-only commit its issue (`Refs: BUG-0010`). Commit pending\n  `.azimuth/` changes as well (`chore(azimuth): record decisions`).\n``
- **AND** it contains ``- Only the user answers questions, releases milestones (in the viewer or with\n  `azimuth release`) and overrides gates.``

### S-028.1.5 · init --refresh rewrites the protocol and keeps the conventions {edge}
- **GIVEN** a project made with `initProject(root)`, then `.azimuth/PROTOCOL.md` overwritten with `# Old protocol\n` and `.azimuth/project/conventions.md` with `# Conventions\n\n## Commits\nOur own rule.\n`
- **WHEN** `initProject(root, { refresh: true })` runs
- **THEN** `.azimuth/PROTOCOL.md` equals `PROTOCOL` and `.azimuth/project/conventions.md` is still `# Conventions\n\n## Commits\nOur own rule.\n`
- **AND** the result's `updated` contains `.azimuth/PROTOCOL.md` and not `.azimuth/project/conventions.md`

### S-028.1.6 · A new project's conventions name milestones and issues {happy}
- **GIVEN** an empty folder
- **WHEN** `initProject(root)` runs
- **THEN** `.azimuth/project/conventions.md` ends with ``## Commits\nConventional Commits with a `Refs:` trailer naming the task or feature, or the milestone or issue the commit is about.\n``

## ST-028.2 · A milestone file records its tag and commit
**Intent:** As the user, I want a released milestone to keep the tag and the commit it was released at, so that I can find the release in git from Azimuth.

### S-028.2.1 · Both keys are read {happy}
- **GIVEN** the text `---\nid: M-01\ntitle: MVP\nstatus: released\nreleased_at: 2026-10-31\ntag: v0.3.1\nreleased_commit: abc1234\n---\n`
- **WHEN** `parseMilestone(text, ".azimuth/milestones/M-01-mvp.md")` runs
- **THEN** it returns the entity `{ id: "M-01", title: "MVP", status: "released", target: null, released_at: "2026-10-31", goal: "", tag: "v0.3.1", released_commit: "abc1234", file: ".azimuth/milestones/M-01-mvp.md" }` and no problems

### S-028.2.2 · A file without the keys reads both as null {edge}
- **GIVEN** the milestone file's text
- **WHEN** `parseMilestone(text, ".azimuth/milestones/M-01-mvp.md")` runs
- **THEN** the entity's `tag` and `released_commit` are `null` and there are no problems

### S-028.2.3 · A SHA of digits only is read as text {edge}
- **GIVEN** the text `---\nid: M-01\ntitle: MVP\nstatus: released\nreleased_at: 2026-10-31\nreleased_commit: 1234567\n---\n`
- **WHEN** `parseMilestone(text, ".azimuth/milestones/M-01-mvp.md")` runs
- **THEN** the entity's `released_commit` is the string `"1234567"` and there are no problems

### S-028.2.4 · A tag that isn't text leaves the milestone out {negative}
- **GIVEN** the text `---\nid: M-01\ntitle: MVP\nstatus: released\nreleased_at: 2026-10-31\ntag: [v1]\n---\n`
- **WHEN** `parseMilestone(text, ".azimuth/milestones/M-01-mvp.md")` runs
- **THEN** the entity is `null` and the only problem is `{ code: "E-SCHEMA", severity: "error", file: ".azimuth/milestones/M-01-mvp.md", line: 6, ref: null, message: "tag must be text (got [\"v1\"]). M-01 was left out of the index." }`

## ST-028.3 · Releasing a milestone records the date, tag and commit
**Intent:** As the user, I want one release step that marks the milestone released and records where in git it was released, whether the milestone was planned or active.

### S-028.3.1 · An active milestone is released at an existing tag {happy}
- **GIVEN** a git project with the milestone file whose first commit (H, called S1 here) carries the tag `v0.3.1` (`git tag v0.3.1`), followed by `commitAll(root, "chore: more")` so that HEAD isn't S1
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", tag: "v0.3.1", now })` runs
- **THEN** the milestone file holds `---\nid: M-01\ntitle: MVP\nstatus: released\ntarget: null\nreleased_at: 2026-10-31\ngoal: Ship it.\ntag: v0.3.1\nreleased_commit: <S1>\n---\n## Scope notes\n`
- **AND** it returns `{ ref: "M-01", from: "active", to: "released", changed: [".azimuth/milestones/M-01-mvp.md"], auto: false, message: "M-01: active → released (v0.3.1 at <S1>)", tag: "v0.3.1", released_commit: "<S1>", tag_found: true }`

### S-028.3.2 · A planned milestone passes through active in one step {happy}
- **GIVEN** a git project with the milestone file at `status: planned`
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", now })` runs
- **THEN** the milestone file holds `---\nid: M-01\ntitle: MVP\nstatus: released\ntarget: null\nreleased_at: 2026-10-31\ngoal: Ship it.\ntag: null\nreleased_commit: <H>\n---\n## Scope notes\n`
- **AND** it returns `from: "planned"`, `to: "released"`, `message: "M-01: planned → active → released (at <H>)"`, `tag: null`, `released_commit: "<H>"` and `tag_found: null`

### S-028.3.3 · A tag git doesn't have yet is recorded with HEAD {edge}
- **GIVEN** a git project with the milestone file and no tag
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", tag: "v0.4.0", now })` runs
- **THEN** the milestone file holds `tag: v0.4.0` and `released_commit: <H>`
- **AND** it returns `message: "M-01: active → released (v0.4.0 at <H>)"` and `tag_found: false`, and `git tag --list` prints nothing

### S-028.3.4 · Outside git the commit is null {edge}
- **GIVEN** a project with the milestone file and no git repository
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", tag: "v0.3.1", now })` runs
- **THEN** the milestone file holds `tag: v0.3.1` and `released_commit: null`
- **AND** it returns `message: "M-01: active → released (v0.3.1)"`, `released_commit: null` and `tag_found: null`

### S-028.3.5 · Cancelled features don't block a release {edge}
- **GIVEN** a git project with the milestone file, F-001 done and F-002 cancelled
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", now })` runs
- **THEN** it returns `to: "released"` and the milestone file holds `status: released`

## ST-028.4 · A release that can't happen writes nothing
**Intent:** As the user, I want a release refused with the reason when it isn't mine to make or the milestone isn't finished, so that nothing is half-released.

### S-028.4.1 · An agent can't release {negative}
- **GIVEN** a git project with the milestone file
- **WHEN** `releaseMilestone(root, "M-01", { actor: "agent", now })` runs
- **THEN** it throws an AzimuthError with code `policy` and the message `Only the user releases a milestone.`
- **AND** the milestone file is unchanged

### S-028.4.2 · Unfinished features block the release {negative}
- **GIVEN** a git project with the milestone file, F-001 done, F-002 in-progress and F-003 deferred, all three in M-01
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `M-01 has features that aren't done: F-002 (in-progress), F-003 (deferred). Finish them or move them to another milestone (azimuth set <F-ID> milestone <M-ID|none>).`
- **AND** the milestone file is unchanged

### S-028.4.3 · A released milestone can't be released again {negative}
- **GIVEN** a git project with the milestone file at `status: released` and `released_at: 2026-10-20`
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `M-01 is already released (2026-10-20).`

### S-028.4.4 · An invalid tag name is refused {negative}
- **GIVEN** a git project with the milestone file
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", tag: "v 1", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `"v 1" is not a valid tag name.`
- **AND** the milestone file is unchanged

### S-028.4.5 · A stale viewer request is a conflict {edge}
- **GIVEN** a git project with the milestone file at `status: planned`
- **WHEN** `releaseMilestone(root, "M-01", { actor: "you", expectStatus: "active", now })` runs
- **THEN** it throws an AzimuthError with code `conflict` and the message `M-01 is now planned, not active. Reload to see the latest state.`

### S-028.4.6 · An unknown milestone or another kind of ID is refused {edge}
- **GIVEN** a git project with the milestone file and F-001
- **WHEN** `releaseMilestone(root, "M-09", { actor: "you", now })` and `releaseMilestone(root, "F-001", { actor: "you", now })` run
- **THEN** the first throws code `not-found` with `M-09 does not exist.` and the second code `invalid` with `F-001 is not a milestone.`

### S-028.4.7 · Moving the unfinished features out lets the release through {happy}
- **GIVEN** the project of S-028.4.2 after the refused release
- **WHEN** `setField(root, "F-002", "milestone", null, you)` and `setField(root, "F-003", "milestone", null, you)` run, then `releaseMilestone(root, "M-01", { actor: "you", now })`
- **THEN** it returns `to: "released"` and the milestone file holds `status: released`

## ST-028.5 · azimuth release on the command line
**Intent:** As the user, I want `azimuth release M-NN --tag vX.Y.Z` in my terminal, so that I release and record the tag in one command after tagging.

### S-028.5.1 · The user releases at an existing tag {happy}
- **GIVEN** the git project of S-028.3.1
- **WHEN** `azimuth release M-01 --tag v0.3.1` runs with `AZIMUTH_ACTOR=you`
- **THEN** it exits 0, its stdout is `M-01: active → released (v0.3.1 at <S1>)\n` and its stderr is empty
- **AND** `azimuth check M-01` then exits 0 with stdout `No problems.\n`

### S-028.5.2 · A missing tag gets a hint, and the release still happens {edge}
- **GIVEN** a git project with the milestone file and no tag
- **WHEN** `azimuth release M-01 --tag v0.4.0` runs with `AZIMUTH_ACTOR=you`
- **THEN** it exits 0, its stdout is `M-01: active → released (v0.4.0 at <H>)\n` and its stderr is `Tag v0.4.0 doesn't exist yet. Create it with: git tag v0.4.0 <H>\n`

### S-028.5.3 · The agent is refused {negative}
- **GIVEN** a git project with the milestone file
- **WHEN** `azimuth release M-01` runs as the agent
- **THEN** it exits 1, its stderr is `✗ Only the user releases a milestone.\n` and its stdout is empty
- **AND** the milestone file is unchanged

### S-028.5.4 · A release without an ID is a usage error {negative}
- **GIVEN** a git project with the milestone file
- **WHEN** `azimuth release` runs with `AZIMUTH_ACTOR=you`
- **THEN** it exits 2 and its stderr is `Missing <M-ID>.\nUsage: azimuth release <M-ID> [--tag <name>] [--json]\n`

### S-028.5.5 · --json prints the release result {edge}
- **GIVEN** a git project with the milestone file at `status: planned`
- **WHEN** `azimuth release M-01 --json` runs with `AZIMUTH_ACTOR=you`
- **THEN** it exits 0 and its stdout parses to `{ ref: "M-01", from: "planned", to: "released", changed: [".azimuth/milestones/M-01-mvp.md"], auto: false, message: "M-01: planned → active → released (at <H>)", tag: null, released_commit: "<H>", tag_found: null }`

## ST-028.6 · The viewer releases a finished planned milestone
**Intent:** As the user, I want the Roadmap to offer Release… on a planned milestone whose features are all done, so that I don't need a terminal to release it (BUG-0084).

### S-028.6.1 · A finished planned milestone is offered Release {happy}
- **GIVEN** a planned milestone with `progress: { done: 2, total: 2, by_status: { done: 2 } }`
- **WHEN** `releaseOffer(m)` runs
- **THEN** it returns `{ enabled: true, why: null }`

### S-028.6.2 · An unfinished or empty planned milestone is offered nothing {negative}
- **GIVEN** a planned milestone with `progress: { done: 1, total: 2, by_status: { done: 1, draft: 1 } }`, and another with `progress: { done: 0, total: 0, by_status: {} }`
- **WHEN** `releaseOffer(m)` runs on each
- **THEN** both return `null`

### S-028.6.3 · An active milestone keeps today's control {edge}
- **GIVEN** an active milestone with `progress: { done: 1, total: 3, by_status: { done: 1, draft: 2 } }`, another active one with `progress: { done: 0, total: 0, by_status: {} }`, and a released one with `progress: { done: 2, total: 2, by_status: { done: 2 } }`
- **WHEN** `releaseOffer(m)` runs on each
- **THEN** they return `{ enabled: false, why: "2 features not done" }`, `{ enabled: true, why: null }` and `null`

### S-028.6.4 · The Roadmap shows Release… on a finished planned milestone {happy}
- **GIVEN** the fixture index with M-03's `progress` set to `{ done: 3, total: 3, by_status: { done: 3 } }`, rendered at `#/roadmap` on a live connection
- **WHEN** the Roadmap renders
- **THEN** M-03's lane holds one `Release…` button without the `disabled` attribute
- **AND** with the fixture index unchanged, M-03's lane holds no `Release…` button and M-02's lane holds one with the `disabled` attribute and the text `3 features not done`

### S-028.6.5 · The control sends the release action with the status shown {happy}
- **GIVEN** the fixture index's M-03 (planned)
- **WHEN** `releaseRequest(m)` runs
- **THEN** it returns `{ action: "release", ref: "M-03", payload: {}, expect: "planned" }`

### S-028.6.6 · The dialog says a planned milestone passes through active {edge}
- **GIVEN** the fixture index's M-03 (planned) and M-02 (active)
- **WHEN** `releaseLead(m)` runs on each
- **THEN** it returns `M-03 is still planned: releasing it makes it active and released in one step.` for M-03 and `null` for M-02

### S-028.6.7 · The server's release action releases a planned milestone {happy}
- **GIVEN** a git project with the milestone file at `status: planned`
- **WHEN** `runAction(root, { action: "release", ref: "M-01", expect: "planned" })` runs
- **THEN** it returns `{ result }` whose `from` is `"planned"`, `to` `"released"`, `tag` `null` and `released_commit` `"<H>"`
- **AND** the milestone file holds `status: released`, `released_at: <D>` where D is `new Date().toISOString().slice(0, 10)` at the test's run (the server passes no `now`), `tag: null` and `released_commit: <H>`

### S-028.6.8 · The server answers a stale release with 409 {negative}
- **GIVEN** a git project with the milestone file at `status: planned`
- **WHEN** `runAction(root, { action: "release", ref: "M-01", expect: "active" })` runs
- **THEN** it returns `{ status: 409, body: { ok: false, error: "conflict", message: "M-01 is now planned, not active. Reload to see the latest state." } }`
- **AND** the milestone file is unchanged

## ST-028.7 · A milestone's commits and release show on its page and Roadmap row
**Intent:** As the user, I want a milestone's page and Roadmap row to show the commits naming it and the tag and commit it was released at, so that a release is traceable from Azimuth.

### S-028.7.1 · The page ends with the release and the commits {happy}
- **GIVEN** the fixture index with M-01's `tag` set to `"v1.0.0"` and `released_commit` to `"c0ffee1"`, and the commit `{ sha: "c0ffee1", at: "2026-09-28T10:00:00Z", actor: "you", session: null, subject: "chore(azimuth): release M-01", refs: ["M-01"], files_changed: 1 }` first in `index.commits`
- **WHEN** `formatMilestonePage(milestonePage(index, "M-01"))` runs
- **THEN** its last two sections (split on `"\n\n"`) are `Tag: v1.0.0\nReleased commit: c0ffee1` and `Commits naming M-01:\n  c0ffee1 2026-09-28 chore(azimuth): release M-01`
- **AND** `milestonePage(index, "M-01").commits` is an array holding only that commit

### S-028.7.2 · An unreleased milestone without commits gets neither section {edge}
- **GIVEN** the fixture index
- **WHEN** `formatMilestonePage(milestonePage(index, "M-02"))` runs
- **THEN** no line of it starts with `Tag:`, `Released commit:` or `Commits naming`
- **AND** `milestonePage(index, "M-02").commits` is `[]`

### S-028.7.3 · An older release keeps F-026's page {edge}
- **GIVEN** the fixture index, whose M-01 has `tag: null`, `released_commit: null` and no commit naming it
- **WHEN** `formatMilestonePage(milestonePage(index, "M-01"))` runs
- **THEN** its last section starts with `done (3)` and no line starts with `Tag:`, `Released commit:` or `Commits naming`
- **AND** with only `tag` set to `"v1.0.0"`, its last section is `Tag: v1.0.0`

### S-028.7.4 · The page lists at most ten commits {edge}
- **GIVEN** the fixture index with twelve commits naming M-02 first in `index.commits`, with SHAs `a000001` to `a000012` in that order, each at `2026-10-17T10:00:00Z` with the subject `chore: step`
- **WHEN** `formatMilestonePage(milestonePage(index, "M-02"))` runs
- **THEN** its last section has twelve lines: `Commits naming M-02:`, `  a000001 2026-10-17 chore: step` to `  a000010 2026-10-17 chore: step` in order, and `  … and 2 more`

### S-028.7.5 · The Roadmap's helpers {happy}
- **GIVEN** the fixture index with M-01's `tag` `"v1.0.0"` and `released_commit` `"c0ffee1"`, and the commits of S-028.7.1 and `{ sha: "def5678", at: "2026-10-17T10:00:00Z", actor: "agent", session: null, subject: "chore(azimuth): plan M-02", refs: ["M-02", "F-005"], files_changed: 1 }` first in `index.commits`
- **WHEN** `milestoneCommits(index.commits, "M-02")`, `releasedLabel(M-01)` and `releasedLabel(M-02)` run
- **THEN** they return an array holding only the `def5678` commit, `Released Sep 28 · v1.0.0 · c0ffee1` and `null`
- **AND** `releasedLabel` of M-01 with `tag: null` and `released_commit: null` returns `Released Sep 28`

### S-028.7.6 · The Roadmap rows show the commits and the release {happy}
- **GIVEN** the fixture index of S-028.7.5, rendered at `#/roadmap`
- **WHEN** the Roadmap renders
- **THEN** M-02's lane (expanded) holds one `rm-commit` row whose text is `def5678 chore(azimuth): plan M-02`
- **AND** M-01's lane (collapsed) holds the text `Released Sep 28 · v1.0.0 · c0ffee1 · 3 of 3 done` and no `rm-commit` row

### S-028.7.7 · An expanded row lists at most five commits {edge}
- **GIVEN** the fixture index with seven commits naming M-02 first in `index.commits`, SHAs `b000001` to `b000007` in that order
- **WHEN** the Roadmap renders at `#/roadmap`
- **THEN** M-02's lane holds five `rm-commit` rows, `b000001` to `b000005` in order, followed by the text `and 2 more`
