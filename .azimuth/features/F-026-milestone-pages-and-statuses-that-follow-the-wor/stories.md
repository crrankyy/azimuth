# F-026: Stories

Unless a scenario says otherwise, a project is `MINIMAL_CONFIG` (`test/helpers/tree.ts`) with
`src/app.ts`. A milestone M-01 is `.azimuth/milestones/M-01-first.md` holding
`---\nid: M-01\ntitle: First\nstatus: <status>\n---\n`, M-02 is `M-02-second.md` with title
`Second` and M-03 is `M-03-third.md` with title `Third`; extra fields a scenario names go before
the closing `---`. Features are written with `featureFiles` (`test/helpers/project.ts`): folder
`.azimuth/features/<F-ID>-thing/`, title `Feature <F-ID>`, priority P2, the default task, and
`extra: { milestone: "M-01" }` when "in M-01". Idea, deferred and cancelled features are
written with `ideaOnly: true`. Core calls run with `now` 2026-10-31T09:00:00Z. CLI calls run
with `runCli`, as the agent.

"The page project" is M-01 with `status: active`, `target: 2026-11-15` and
`goal: Ship the login flow.`, and, in M-01: F-001 in progress (title `Login`, priority P1),
F-002 approved (`Logout`), F-003 done (`Signup`), F-004 deferred (`Export`, P3), F-005
cancelled (`Import`) and F-006 in progress (`Reset password`, P0); plus F-007 in progress with no
milestone.

## ST-026.1 · Starting a feature makes its planned milestone active
**Intent:** As the user, I want a planned milestone to become active as soon as one of its features starts, so that its status follows the work without anyone remembering to move it.

### S-026.1.1 · A feature starting moves its planned milestone to active {happy}
- **GIVEN** M-01 planned and F-001 approved in M-01
- **WHEN** `moveFeature(root, "F-001", "in-progress", { actor: "agent", now })` runs
- **THEN** it returns `{ ref: "F-001", from: "approved", to: "in-progress", changed: [".azimuth/features/F-001-thing/feature.md", ".azimuth/features/F-001-thing/log.md", ".azimuth/milestones/M-01-first.md"], auto: false, message: "F-001: approved → in-progress (M-01: planned → active)" }`
- **AND** M-01's file holds exactly `---\nid: M-01\ntitle: First\nstatus: active\n---\n`, F-001's status is `in-progress`, and the body of F-001's last log entry is `approved → in-progress`

### S-026.1.2 · An active or released milestone is left alone {edge}
- **GIVEN** M-01 active, M-02 with `status: released` and `released_at: 2026-10-01`, F-001 approved in M-01 and F-002 approved in M-02
- **WHEN** `moveFeature` moves F-001, then F-002, to in-progress as the agent
- **THEN** the messages are `F-001: approved → in-progress` and `F-002: approved → in-progress`, and each `changed` is exactly that feature's `feature.md` and `log.md`
- **AND** both milestone files are byte for byte as before

### S-026.1.3 · No milestone, or one without a file, changes nothing more {edge}
- **GIVEN** M-01 planned, F-001 approved with no milestone, and F-002 approved with `milestone: M-09`, which has no file
- **WHEN** `moveFeature` moves F-001, then F-002, to in-progress as the agent
- **THEN** the messages are `F-001: approved → in-progress` and `F-002: approved → in-progress`, and each `changed` is exactly that feature's `feature.md` and `log.md`
- **AND** M-01's file still holds `status: planned`

### S-026.1.4 · A refused start leaves the milestone planned {negative}
- **GIVEN** M-01 planned, F-001 approved in M-01 with `depends_on: [F-002]`, and F-002 a draft
- **WHEN** `moveFeature(root, "F-001", "in-progress", { actor: "agent", now })` runs
- **THEN** it throws an AzimuthError with code `gate` and the message `F-001 cannot move to in-progress: Every dependency is done (F-002 is draft).`
- **AND** M-01's file, F-001's `feature.md` and F-001's `log.md` are byte for byte as before

### S-026.1.5 · A verifying feature sent back activates a drifted milestone {edge}
- **GIVEN** M-01 planned and F-001 verifying in M-01
- **WHEN** `moveFeature(root, "F-001", "in-progress", { actor: "agent", reason: "A test fails on CI", now })` runs
- **THEN** its message is `F-001: verifying → in-progress (M-01: planned → active)`
- **AND** M-01's file holds exactly `---\nid: M-01\ntitle: First\nstatus: active\n---\n`

### S-026.1.6 · azimuth move prints the activation {happy}
- **GIVEN** a project with M-01 planned and F-001 approved in M-01
- **WHEN** `azimuth move F-001 in-progress` runs
- **THEN** it exits 0 and its stdout is `F-001: approved → in-progress (M-01: planned → active)\n`
- **AND** `azimuth show M-01 --brief` then prints `M-01 active First: 0/1 done\n`

### S-026.1.7 · The viewer's move activates the milestone {happy}
- **GIVEN** M-01 planned and F-001 approved in M-01
- **WHEN** `runAction(root, { action: "move", ref: "F-001", expect: "approved", payload: { to: "in-progress" } })` runs
- **THEN** it returns `{ result: { ref: "F-001", from: "approved", to: "in-progress", changed: [".azimuth/features/F-001-thing/feature.md", ".azimuth/features/F-001-thing/log.md", ".azimuth/milestones/M-01-first.md"], auto: false, message: "F-001: approved → in-progress (M-01: planned → active)" } }`
- **AND** M-01's file holds `status: active`

### S-026.1.8 · A stale viewer move writes nothing {negative}
- **GIVEN** M-01 planned and F-001 approved in M-01
- **WHEN** `runAction(root, { action: "move", ref: "F-001", expect: "draft", payload: { to: "in-progress" } })` runs
- **THEN** it returns `{ status: 409, body: { ok: false, error: "conflict", message: "F-001 is now approved, not draft. Reload to see the latest state." } }`
- **AND** M-01's file still holds `status: planned` and F-001's status is still `approved`

## ST-026.2 · check warns about a planned milestone whose work has started
**Intent:** As the user of a project that drifted before the upgrade, I want check to point at a planned milestone with started features, so that I move it to active once.

### S-026.2.1 · Planned milestones with started work {happy}
- **GIVEN** M-01 planned with F-001 in progress and F-002 an idea, and M-02 planned with F-003 verifying, F-004 done, F-005 deferred and F-006 cancelled, each feature in its milestone
- **WHEN** `validate(model, facts, derive(model, facts))` runs with `makeFacts()`
- **THEN** its `W-MILESTONE-PLANNED` problems are exactly `` { code: "W-MILESTONE-PLANNED", severity: "warning", file: ".azimuth/milestones/M-01-first.md", line: null, ref: "M-01", message: "M-01 is still planned with work started on 1 of its 2 features; move it to active (`azimuth move M-01 active`)." } `` and `` { code: "W-MILESTONE-PLANNED", severity: "warning", file: ".azimuth/milestones/M-02-second.md", line: null, ref: "M-02", message: "M-02 is still planned with work started on 2 of its 3 features; move it to active (`azimuth move M-02 active`)." } ``, in that order
- **AND** on the built index, `startedCount` gives 1 for M-01 and 2 for M-02, and `milestoneStartedWhilePlanned` is true for both

### S-026.2.2 · No started work, or not planned {negative}
- **GIVEN** M-01 planned with F-001 approved, F-002 a draft and F-003 deferred; M-02 active with F-004 in progress; and M-03 with `status: released` and `released_at: 2026-10-01` with F-005 in progress
- **WHEN** `validate` runs
- **THEN** no problem has code `W-MILESTONE-PLANNED`, and `milestoneStartedWhilePlanned` is false for all three milestones of the built index

### S-026.2.3 · A finished planned milestone gets only the ready warning {edge}
- **GIVEN** M-01 planned with F-001 done and F-002 cancelled, and M-02 planned whose only feature F-003 is cancelled
- **WHEN** `validate` runs
- **THEN** its problems whose code starts with `W-MILESTONE` are exactly `[{ code: "W-MILESTONE-READY", severity: "warning", file: ".azimuth/milestones/M-01-first.md", line: null, ref: "M-01", message: "Every feature of M-01 is done but it is still planned; ask the user to release it." }]`
- **AND** `milestoneStartedWhilePlanned` is false for both milestones of the built index

### S-026.2.4 · check on the milestone prints the warning {happy}
- **GIVEN** a project with M-01 planned, F-001 in progress in M-01 and F-002 an idea in M-01
- **WHEN** `azimuth check M-01` runs
- **THEN** it exits 0 and its stdout is exactly `` W-MILESTONE-PLANNED .azimuth/milestones/M-01-first.md M-01\n  M-01 is still planned with work started on 1 of its 2 features; move it to active (`azimuth move M-01 active`).\n\n0 errors, 1 warnings\n ``

## ST-026.3 · A milestone has a page
**Intent:** As the user, I want `azimuth show M-NN` to list the milestone's features by status and name the ones keeping it from being ready, so that I see what is left without scanning every feature.

### S-026.3.1 · The page's data groups the features {happy}
- **GIVEN** the page project
- **WHEN** `milestonePage(index, "M-01")` runs on the built index
- **THEN** it returns `{ milestone: <the index's M-01>, groups: [{ status: "in-progress", counted: true, features: [{ id: "F-006", priority: "P0", title: "Reset password" }, { id: "F-001", priority: "P1", title: "Login" }] }, { status: "approved", counted: true, features: [{ id: "F-002", priority: "P2", title: "Logout" }] }, { status: "deferred", counted: true, features: [{ id: "F-004", priority: "P3", title: "Export" }] }, { status: "done", counted: true, features: [{ id: "F-003", priority: "P2", title: "Signup" }] }, { status: "cancelled", counted: false, features: [{ id: "F-005", priority: "P2", title: "Import" }] }], blocking: ["F-006", "F-001", "F-002", "F-004"], ready: false, started_while_planned: false }`
- **AND** `milestonePage(index, "M-09")` returns `null`

### S-026.3.2 · show prints the page {happy}
- **GIVEN** the page project
- **WHEN** `azimuth show M-01` runs
- **THEN** it exits 0 and its stdout is exactly `M-01 First\nStatus: active, target 2026-11-15\nGoal: Ship the login flow.\nProgress: 1/5 done\n\nin-progress (2)\n  F-006 P0 Reset password\n  F-001 P1 Login\napproved (1)\n  F-002 P2 Logout\ndeferred (1)\n  F-004 P3 Export\ndone (1)\n  F-003 P2 Signup\ncancelled (1, not counted)\n  F-005 P2 Import\n\nKeeping it from being ready: F-006, F-001, F-002, F-004\n`

### S-026.3.3 · A ready milestone says so {edge}
- **GIVEN** a project with M-01 planned, with no target or goal, F-001 done in M-01 and F-002 cancelled in M-01
- **WHEN** `azimuth show M-01` runs
- **THEN** its stdout is exactly `M-01 First\nStatus: planned\nProgress: 1/1 done\n\ndone (1)\n  F-001 P2 Feature F-001\ncancelled (1, not counted)\n  F-002 P2 Feature F-002\n\nReady: every feature is done; ask the user to release M-01.\n`

### S-026.3.4 · A planned milestone with started work gives the move {edge}
- **GIVEN** a project with M-01 planned, F-001 in progress in M-01 and F-002 an idea in M-01
- **WHEN** `azimuth show M-01` runs
- **THEN** its stdout is exactly `M-01 First\nStatus: planned\nProgress: 0/2 done\n\nin-progress (1)\n  F-001 P2 Feature F-001\nidea (1)\n  F-002 P2 Feature F-002\n\nKeeping it from being ready: F-001, F-002\nWork has started on its features but it is still planned: azimuth move M-01 active\n`

### S-026.3.5 · A released milestone shows its dates and no readiness {edge}
- **GIVEN** a project with M-01 with `status: released`, `target: 2026-10-20` and `released_at: 2026-10-21`, and F-001 done in M-01
- **WHEN** `azimuth show M-01` runs
- **THEN** its stdout is exactly `M-01 First\nStatus: released 2026-10-21, target 2026-10-20\nProgress: 1/1 done\n\ndone (1)\n  F-001 P2 Feature F-001\n`

### S-026.3.6 · A milestone without features {edge}
- **GIVEN** a project with M-01 planned and F-001 in progress in M-01, and M-02 planned that no feature names
- **WHEN** `azimuth show M-02` runs
- **THEN** its stdout is exactly `M-02 Second\nStatus: planned\nProgress: 0/0 done\n\nNo features count toward it yet.\n`

## ST-026.4 · --brief, --json and unknown IDs keep their output
**Intent:** As an agent reading state cheaply, I want `--brief` to stay one line and `--json` to stay the entity, so that hook context and scripts don't change.

### S-026.4.1 · --brief stays one line {happy}
- **GIVEN** the page project
- **WHEN** `azimuth show M-01 --brief` runs
- **THEN** it exits 0 and its stdout is exactly `M-01 active First: 1/5 done, target 2026-11-15\n`

### S-026.4.2 · --json stays the entity {edge}
- **GIVEN** the page project
- **WHEN** `azimuth show M-01 --json` runs
- **THEN** its stdout parses to `{ "id": "M-01", "title": "First", "status": "active", "target": "2026-11-15", "released_at": null, "goal": "Ship the login flow.", "features": ["F-001", "F-002", "F-003", "F-004", "F-005", "F-006"], "progress": { "done": 1, "total": 5, "by_status": { "in-progress": 2, "approved": 1, "done": 1, "deferred": 1 } }, "file": ".azimuth/milestones/M-01-first.md" }`

### S-026.4.3 · An unknown milestone is refused {negative}
- **GIVEN** the page project
- **WHEN** `azimuth show M-09` runs
- **THEN** it exits 2, its stdout is empty and the first line of its stderr is `M-09 not found.`
