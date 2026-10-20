# F-021: Stories

In ST-021.1 and ST-021.3, commits are listed oldest first, each as the lines
`git log --name-status` prints for it (`A src/a.ts` is status `A`, path `src/a.ts`), and impact
rows are written `<path> (<change>)`.

In ST-021.2, ST-021.4 and ST-021.5, unless a scenario says otherwise, the project is the example
project in contract.md ("as-built.md example"): a git repository whose HEAD holds F-001
`verifying` in `.azimuth/features/F-001-thing/` with the impact rows `src/a.ts (create)`,
`src/b.ts (modify)`, `src/c.ts (modify)`, `test/a.test.ts (test)` and `src/types.ts (read)`,
and two commits: `chore: start`, which adds `src/b.ts`, `src/c.ts`, `src/types.ts` and the
`.azimuth/` records, then `feat(F-001): add a` with `Refs: T-001.1`, which adds `src/a.ts`,
`src/extra.ts` and `test/a.test.ts` and changes `src/b.ts` and
`.azimuth/features/F-001-thing/plan.md`. `writeAsBuilt` runs with
`now: new Date("2026-10-20T09:00:00Z")`; `<today>` is the UTC date a CLI test runs on. A YAML
list item is quoted as it appears on its line in as-built.md.

## ST-021.1 · Each changed path gets one change
**Intent:** As an orchestrator closing out a feature, I want each path the feature's commits changed listed once with the change that sums it up, so that files_changed says what the feature did to the tree.

### S-021.1.1 · The first change decides create {happy}
- **GIVEN** the commits `A src/a.ts` and `M src/b.ts`, then `M src/a.ts` and `T src/link.ts`
- **WHEN** `filesChanged(commits)` runs
- **THEN** it returns `[{ path: "src/a.ts", change: "create" }, { path: "src/b.ts", change: "modify" }, { path: "src/link.ts", change: "modify" }]`

### S-021.1.2 · A path created then deleted is a delete {edge}
- **GIVEN** the commits `A src/tmp.ts`, `D src/old.ts` and `M src/b.ts`, then `D src/tmp.ts`, `A src/old.ts` and `D src/b.ts`, and the impact row `src/b.ts (modify)`
- **WHEN** `filesChanged(commits)` runs, then `deviationsFor(files, impact, [])` on its result
- **THEN** `filesChanged` returns `[{ path: "src/b.ts", change: "delete" }, { path: "src/old.ts", change: "modify" }, { path: "src/tmp.ts", change: "delete" }]`
- **AND** `deviationsFor` returns `[{ path: "src/old.ts", kind: "unplanned-modify", reason: "" }, { path: "src/tmp.ts", kind: "unplanned-delete", reason: "" }]`

### S-021.1.3 · Paths under .azimuth/ are left out {edge}
- **GIVEN** the commits `A .azimuth/features/F-001-thing/as-built.md` and `M src/a.ts`, then `M .azimuth/features/F-001-thing/plan.md`, and the impact rows `src/a.ts (modify)` and `.azimuth/templates/feature/as-built.md (modify)`
- **WHEN** `filesChanged(commits)` runs, then `deviationsFor(files, impact, [])` on its result
- **THEN** `filesChanged` returns `[{ path: "src/a.ts", change: "modify" }]` and `deviationsFor` returns `[]`

## ST-021.2 · Every commit of the feature, however old
**Intent:** As an orchestrator, I want as-built to read every commit that names the feature or one of its stories, scenarios or tasks, past the history the index reads, so that an early task's files aren't missing from the record.

### S-021.2.1 · Refs and scopes decide which commits count {happy}
- **GIVEN** a repository whose first commit `chore: start` adds `src/b.ts`, followed by (1) `feat(F-001): add a` with `Refs: T-001.1` adding `src/a.ts`, (2) `test: cover the empty case` with `Refs: S-001.1.2` adding `test/a.test.ts`, (3) `fix(F-001): tidy` without a Refs trailer changing `src/b.ts`, (4) `feat(F-001): borrow` with `Refs: T-002.1` adding `src/c.ts`, (5) `chore: other` with `Refs: F-002` adding `src/d.ts` and (6) `docs: say why F-001 is slow` without a Refs trailer adding `docs/slow.md`
- **WHEN** `readFeatureCommits(root, "F-001")` runs
- **THEN** it returns commits (1), (2) and (3) in that order, each with its 7-character SHA and its subject, with `refs` `["T-001.1"]`, `["S-001.1.2"]` and `["F-001"]` and `changes` `[{ status: "A", path: "src/a.ts" }]`, `[{ status: "A", path: "test/a.test.ts" }]` and `[{ status: "M", path: "src/b.ts" }]`

### S-021.2.2 · A commit older than git.log_depth is found {edge}
- **GIVEN** the example project with `git.log_depth` set to 1 in config.yaml, and three commits after `feat(F-001): add a`, `chore: 1`, `chore: 2` and `chore: 3`, each writing new text to `src/other.ts`
- **WHEN** `writeAsBuilt(root, "F-001", { now })` runs
- **THEN** `commits` is `[<SHA of feat(F-001): add a>]` and `files_changed` is `[{ path: "src/a.ts", change: "create" }, { path: "src/b.ts", change: "modify" }, { path: "src/extra.ts", change: "create" }, { path: "test/a.test.ts", change: "create" }]`

### S-021.2.3 · A rename is a delete and a create {edge}
- **GIVEN** a repository whose first commit `chore: start` adds `src/old.ts` and F-001 `verifying` with the single impact row `src/new.ts (create)`, then `refactor(F-001): rename the parser` with `Refs: T-001.2`, made after `git mv src/old.ts src/new.ts`
- **WHEN** `writeAsBuilt(root, "F-001", { now })` runs
- **THEN** `files_changed` is `[{ path: "src/new.ts", change: "create" }, { path: "src/old.ts", change: "delete" }]` and `deviations` is `[{ path: "src/old.ts", kind: "unplanned-delete", reason: "" }]`

## ST-021.3 · Deviations from impact.md
**Intent:** As an orchestrator, I want the paths the commits changed outside the plan and the planned paths they never changed listed with empty reasons, so that I write only why each one differs, not what.

### S-021.3.1 · Unplanned paths and planned-unchanged rows {happy}
- **GIVEN** the files changed `src/a.ts (create)`, `src/b.ts (modify)`, `src/extra.ts (create)`, `src/gone.ts (delete)` and `src/patch.ts (modify)`, and the impact rows `src/a.ts (create)`, `src/b.ts (modify)`, `src/c.ts (modify)`, `test/a.test.ts (test)` and `src/types.ts (read)`
- **WHEN** `deviationsFor(files, impact, [])` runs
- **THEN** it returns `[{ path: "src/c.ts", kind: "planned-unchanged", reason: "" }, { path: "src/extra.ts", kind: "unplanned-create", reason: "" }, { path: "src/gone.ts", kind: "unplanned-delete", reason: "" }, { path: "src/patch.ts", kind: "unplanned-modify", reason: "" }, { path: "test/a.test.ts", kind: "planned-unchanged", reason: "" }]`

### S-021.3.2 · A read row is never a deviation and plans no change {edge}
- **GIVEN** the file changed `src/util.ts (modify)`, and the impact rows `src/types.ts (read)` and `src/util.ts (read)`
- **WHEN** `deviationsFor(files, impact, [])` runs
- **THEN** it returns `[{ path: "src/util.ts", kind: "unplanned-modify", reason: "" }]`

### S-021.3.3 · A row naming a directory covers the files under it {edge}
- **GIVEN** the files changed `src/parser.ts (modify)`, `src/parser/inline.ts (create)` and `src/parserx/a.ts (create)`, and the impact rows `./src/parser/ (modify)` and `docs/guide/ (modify)`
- **WHEN** `deviationsFor(files, impact, [])` runs
- **THEN** it returns `[{ path: "docs/guide", kind: "planned-unchanged", reason: "" }, { path: "src/parser.ts", kind: "unplanned-modify", reason: "" }, { path: "src/parserx/a.ts", kind: "unplanned-create", reason: "" }]`

## ST-021.4 · as-built.md is written, and a rerun keeps what was written
**Intent:** As an orchestrator, I want the draft written in the as-built format and every reason, hand-written deviation, follow-up and line of prose kept when I run it again, so that I can rerun it after a late commit without losing work.

### S-021.4.1 · The first draft {happy}
- **GIVEN** the example project, without an as-built.md
- **WHEN** `writeAsBuilt(root, "F-001", { now: new Date("2026-10-20T09:00:00Z") })` runs
- **THEN** `.azimuth/features/F-001-thing/as-built.md` is exactly the example file in contract.md, whose deviations are `- { path: src/c.ts, kind: planned-unchanged, reason: "" }` and `- { path: src/extra.ts, kind: unplanned-create, reason: "" }`
- **AND** the result has `created` true, `commits` `[<SHA of feat(F-001): add a>]`, `unexplained` `[{ path: "src/c.ts", kind: "planned-unchanged" }, { path: "src/extra.ts", kind: "unplanned-create" }]` and the example's `message`
- **AND** running it again leaves as-built.md byte for byte the same and returns `created` false

### S-021.4.2 · A rerun keeps reasons, hand-written deviations, follow-ups and the body {happy}
- **GIVEN** the example project with an as-built.md whose frontmatter is `completed_at: 2026-10-19`, `files_changed: []`, `deviations:` with the items `- { path: src/extra.ts, kind: unplanned-create, reason: Split out for testability }`, `- { path: src/gone.ts, kind: unplanned-create, reason: Removed later }` and `- { path: src/a.ts, kind: clarification, reason: Parses lazily }`, and `follow_ups: [DEBT-0002]`, and whose body is `# F-001: As built\n\n## Summary\nBuilt it.\n`
- **WHEN** `writeAsBuilt(root, "F-001", { now: new Date("2026-10-20T09:00:00Z") })` runs
- **THEN** the deviations are, in this order, `- { path: src/c.ts, kind: planned-unchanged, reason: "" }`, `- { path: src/extra.ts, kind: unplanned-create, reason: Split out for testability }` and `- { path: src/a.ts, kind: clarification, reason: Parses lazily }`
- **AND** `completed_at` is `2026-10-20`, `files_changed` is the example file's, `follow_ups` is `[DEBT-0002]`, the text after the closing `---` line is exactly `# F-001: As built\n\n## Summary\nBuilt it.\n`, `created` is false and `unexplained` is `[{ path: "src/c.ts", kind: "planned-unchanged" }]`

### S-021.4.3 · A reason belongs to its path and kind {edge}
- **GIVEN** the example project with an as-built.md whose deviations are `- { path: src/extra.ts, kind: unplanned-modify, reason: Was there before }` and `- { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }`
- **WHEN** `writeAsBuilt(root, "F-001", { now })` runs
- **THEN** the deviations are exactly `- { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }` and `- { path: src/extra.ts, kind: unplanned-create, reason: "" }`

### S-021.4.4 · A done feature keeps its completed_at {edge}
- **GIVEN** the example project with F-001 `done` and an as-built.md whose frontmatter is `completed_at: 2026-10-02`, `files_changed: []`, `deviations: []` and `follow_ups: []`
- **WHEN** `writeAsBuilt(root, "F-001", { now: new Date("2026-10-20T09:00:00Z") })` runs
- **THEN** the file's `completed_at` line is `completed_at: 2026-10-02`, and its `files_changed` and `deviations` are the example file's

### S-021.4.5 · Invalid frontmatter is refused {negative}
- **GIVEN** the example project with an as-built.md whose text is `---\ndeviations: [\n---\nKeep me.\n`
- **WHEN** `writeAsBuilt(root, "F-001", { now })` runs
- **THEN** it throws `AzimuthError` with code `invalid` and the message `.azimuth/features/F-001-thing/as-built.md has invalid frontmatter. Fix it (azimuth check F-001 shows where), then run azimuth as-built F-001 again.`
- **AND** as-built.md still reads `---\ndeviations: [\n---\nKeep me.\n`

## ST-021.5 · azimuth as-built on the command line
**Intent:** As an orchestrator, I want one command that drafts the record and tells me which deviations still need a reason, and that refuses clearly when the feature isn't ready, so that close-out starts from the facts.

### S-021.5.1 · The draft is written and its gaps are listed {happy}
- **GIVEN** the example project and an open session `SES-20261020-0900` whose `touched` is `[]`, selected with `AZIMUTH_SESSION`
- **WHEN** `azimuth as-built F-001` runs
- **THEN** it exits 0 and stdout is exactly `Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 2 without a reason.\nNeeds a reason: src/c.ts (planned-unchanged), src/extra.ts (unplanned-create)\n`
- **AND** as-built.md is the example file with `completed_at: <today>`, and the session's `touched` is `["F-001"]`

### S-021.5.2 · --json prints the result {edge}
- **GIVEN** the example project with an as-built.md whose deviations are `- { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }` and `- { path: src/extra.ts, kind: unplanned-create, reason: Split out }`
- **WHEN** `azimuth as-built F-001 --json` runs
- **THEN** it exits 0 and stdout is one JSON document with `feature` `"F-001"`, `file` `".azimuth/features/F-001-thing/as-built.md"`, `created` false, `unexplained` `[]` and `message` `"Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 0 without a reason."`

### S-021.5.3 · An unknown feature is refused {negative}
- **GIVEN** the example project
- **WHEN** `azimuth as-built F-009` runs
- **THEN** it exits 1 with stdout empty and stderr exactly `✗ F-009 does not exist.\n`

### S-021.5.4 · A feature that isn't verifying or done is refused {negative}
- **GIVEN** the example project with F-001 `in-progress`
- **WHEN** `azimuth as-built F-001` runs
- **THEN** it exits 1 with stdout empty and stderr exactly `✗ F-001 is in-progress: azimuth as-built takes a feature in verifying or done.\n`
- **AND** `.azimuth/features/F-001-thing/as-built.md` doesn't exist

### S-021.5.5 · Outside a git repository it is refused {negative}
- **GIVEN** the example project's files in a temp folder that isn't a git repository
- **WHEN** `azimuth as-built F-001` runs
- **THEN** it exits 1 with stdout empty and stderr exactly `✗ Not a git repository: azimuth as-built reads the feature's commits.\n`
- **AND** `.azimuth/features/F-001-thing/as-built.md` doesn't exist

### S-021.5.6 · Usage errors {negative}
- **GIVEN** the example project
- **WHEN** `azimuth as-built T-001.1` runs, then `azimuth as-built` without an ID
- **THEN** each exits 2 with stdout empty; stderr is exactly `T-001.1 is not a feature ID.\nUsage: azimuth as-built <F-ID> [--json]\n`, then `Missing <F-ID>.\nUsage: azimuth as-built <F-ID> [--json]\n`

## ST-021.6 · The done gate needs a reason for every deviation
**Intent:** As the user, I want the done gate to refuse an as-built whose deviations have no reason, so that a generated draft can't pass close-out unread.

Each scenario evaluates `evaluateGate(ctx, f, "done")` with `analyzeProject` for F-001
`verifying`, and reads its `done.as-built` check.

### S-021.6.1 · Deviations without a reason fail the check {negative}
- **GIVEN** an as-built.md with `completed_at: 2026-10-20` and the deviations `- { path: src/c.ts, kind: planned-unchanged, reason: "" }`, `- { path: src/a.ts, kind: clarification, reason: "  " }` and `- { path: src/extra.ts, kind: unplanned-create, reason: Split out }`
- **WHEN** the done gate is evaluated
- **THEN** the check is `{ id: "done.as-built", rule: "as-built.md written", ok: false, detail: "No reason for src/c.ts (planned-unchanged), src/a.ts (clarification)" }`

### S-021.6.2 · Every deviation with a reason passes {happy}
- **GIVEN** an as-built.md with `completed_at: 2026-10-20` and the deviations `- { path: src/c.ts, kind: planned-unchanged, reason: Moved to F-002 }`, `- { path: src/a.ts, kind: clarification, reason: Parses lazily }` and `- { path: src/extra.ts, kind: unplanned-create, reason: Split out }`
- **WHEN** the done gate is evaluated
- **THEN** the check is `{ id: "done.as-built", rule: "as-built.md written", ok: true }`

### S-021.6.3 · No as-built.md {edge}
- **GIVEN** no as-built.md in F-001's folder
- **WHEN** the done gate is evaluated
- **THEN** the check is `{ id: "done.as-built", rule: "as-built.md written", ok: false }`, without a `detail` key

### S-021.6.4 · An as-built.md that doesn't parse {edge}
- **GIVEN** an as-built.md whose text is `---\ndeviations: []\n---\n` (no `completed_at`)
- **WHEN** the done gate is evaluated
- **THEN** the check is `{ id: "done.as-built", rule: "as-built.md written", ok: false, detail: "as-built.md has errors (see azimuth check F-001)" }`
