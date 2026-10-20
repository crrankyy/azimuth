# F-024: Stories

Unless a scenario says otherwise, a project is `MINIMAL_CONFIG` (`test/helpers/tree.ts`), and
"the bug file" is `.azimuth/issues/BUG-0001-x.md` holding
`---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n`.
Core calls run with `actor: "agent"` and `now` 2026-10-20T09:00:00Z unless a scenario names
another. Features are written with `featureFiles` (`test/helpers/project.ts`): tasks are todo,
without `after` or `covers`, and features have priority P2, unless a scenario says otherwise.
In ST-024.5, C and P are ports on 127.0.0.1 that the test finds free, C is the project's
`viewer.port`, a viewer.json record has `config_port: C` unless a scenario says otherwise, and a
"stand-in stale viewer" is a separate Node process listening on P that answers every request
with `{"build":"0.0.0+0","root":"<the project's real path>"}`.

## ST-024.1 · An issue under investigation keeps a progress trail
**Intent:** As the user, I want `azimuth log` to take a bug, debt or risk ID, so that an investigation leaves a dated trail on the issue before it is resolved.

### S-024.1.1 · A note on a bug becomes a Status notes bullet {happy}
- **GIVEN** the bug file
- **WHEN** `addLogEntry(root, "BUG-0001", "note", "Reproduced with a BOM", { actor: "agent", now })` runs
- **THEN** the bug file holds `---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n\n## Status notes\n- 2026-10-20T09:00:00Z · agent · Reproduced with a BOM\n`
- **AND** it returns `{ ref: "BUG-0001", from: null, to: null, changed: [".azimuth/issues/BUG-0001-x.md"], auto: false, message: "BUG-0001: note added" }`

### S-024.1.2 · A note follows the moves' bullets, its lines indented {edge}
- **GIVEN** the bug file with `status: in-progress` in its frontmatter and the body `## Status notes\n- 2026-10-20T08:00:00Z · you · open → in-progress: Taking it\n\n## Actual\nIt breaks.\n`
- **WHEN** `addLogEntry(root, "BUG-0001", "note", "Fails on Windows:\nonly with CRLF", { actor: "agent", now })` runs
- **THEN** the body after the frontmatter is `## Status notes\n- 2026-10-20T08:00:00Z · you · open → in-progress: Taking it\n- 2026-10-20T09:00:00Z · agent · Fails on Windows:\n  only with CRLF\n\n## Actual\nIt breaks.\n`
- **AND** the frontmatter is unchanged, `status: in-progress` included

### S-024.1.3 · azimuth log on a bug passes check {happy}
- **GIVEN** a project with the bug file
- **WHEN** `azimuth log BUG-0001 "Reproduced with a BOM"` runs as the agent
- **THEN** it exits 0 and its stdout is `BUG-0001: note added\n`
- **AND** the bug file's last line is `- <stamp> · agent · Reproduced with a BOM` with a stamp matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`, and `azimuth check BUG-0001` then exits 0 with stdout `No problems.\n`

### S-024.1.4 · A question is refused with the kinds log takes {negative}
- **GIVEN** a project with the bug file and an open question Q-0001
- **WHEN** `azimuth log Q-0001 "Asked again"` runs as the agent
- **THEN** it exits 1, its stderr is `✗ Q-0001 is not a feature, story, scenario, task or issue.\n` and its stdout is empty
- **AND** Q-0001's file is unchanged

### S-024.1.5 · A change request on an issue is refused {negative}
- **GIVEN** the bug file
- **WHEN** `addLogEntry(root, "BUG-0001", "review", "Look again", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `Change requests (--review) go to a feature; BUG-0001 is an issue.`
- **AND** the bug file is unchanged

### S-024.1.6 · An unknown issue is refused {edge}
- **GIVEN** the bug file and no BUG-0009
- **WHEN** `addLogEntry(root, "BUG-0009", "note", "Reproduced", { actor: "agent", now })` runs
- **THEN** it throws an AzimuthError with code `not-found` and the message `BUG-0009 does not exist.`

### S-024.1.7 · The Issue page's History dates the note and sorts it in {happy}
- **GIVEN** the hookline fixture's BUG-0001 (filed 2026-10-14 by you) whose body ends with `## Status notes\n- 2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers\n- 2026-10-15T13:00:00Z · agent · Fails only with two workers\n`, and the commit `abc1234` of S-017.6.1 (2026-10-16T12:00:00Z, refs F-005 and BUG-0001)
- **WHEN** `<IssueHistory index={index} issue={BUG-0001} />` renders
- **THEN** its rows read `Oct 14 You filed it`, `Oct 15 An agent moved it from Open to In progress: Reproduced with two workers`, `Oct 15 An agent noted: Fails only with two workers` and `Oct 16 abc1234 fix(F-005): keep the lease while recording the outcome`, in this order
- **AND** `issueHistory(issue, index.commits)[2]` is `{ kind: "logged", at: "2026-10-15T13:00:00Z", actor: "agent", text: "Fails only with two workers" }`

### S-024.1.8 · A bullet whose first part isn't a time stays as written {edge}
- **GIVEN** the hookline fixture's BUG-0001 whose body ends with `## Status notes\n- someday · you · Look again\n`, and no commit naming it
- **WHEN** `issueHistory(issue, index.commits)` runs
- **THEN** it returns `[{ kind: "created", at: "2026-10-14", by: "you" }, { kind: "note", at: null, text: "someday · you · Look again" }]`

## ST-024.2 · A refused reapprove in verifying explains the done gate
**Intent:** As an orchestrator closing a feature out, I want the refusal to say that the done gate ignores the approval, so that I fix the spec without looking for a way to re-approve it.

### S-024.2.1 · A verifying feature is told no reapproval is needed {happy}
- **GIVEN** a git project with F-001 verifying
- **WHEN** `reapproveFeature(root, "F-001", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `F-001 is verifying; only approved or in-progress features can be re-approved. The done gate doesn't check the approval, so a spec fix during close-out needs no reapproval.`
- **AND** F-001's feature.md and log.md are unchanged

### S-024.2.2 · A done feature keeps today's refusal {negative}
- **GIVEN** a git project with F-001 done
- **WHEN** `reapproveFeature(root, "F-001", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `F-001 is done; only approved or in-progress features can be re-approved.`

### S-024.2.3 · An idea keeps today's refusal {edge}
- **GIVEN** a git project with F-001 an idea
- **WHEN** `reapproveFeature(root, "F-001", { actor: "you", now })` runs
- **THEN** it throws an AzimuthError with code `invalid` and the message `F-001 is idea; only approved or in-progress features can be re-approved.`

## ST-024.3 · Ready tasks are grouped across in-progress features
**Intent:** As an orchestrator running several features at once, I want the ready tasks of all of them grouped by the files they list, so that I don't match `files` lists across features by hand.

### S-024.3.1 · Two features' tasks, by priority {happy}
- **GIVEN** F-001 in progress (P2) with todo T-001.2 (files `["src/a.ts"]`) and in-progress T-001.3 (files `["src/c.ts"]`), and F-002 in progress (P0) with todo T-002.1 (files `["src/a.ts"]`)
- **WHEN** `crossFeatureGroups(index)` runs on the built index
- **THEN** it returns `{ features: ["F-002", "F-001"], groups: [{ tasks: ["T-002.1", "T-001.3"], shared: [] }, { tasks: ["T-001.2"], shared: [] }] }`

### S-024.3.2 · One feature with ready tasks gives no groups {negative}
- **GIVEN** F-001 in progress with todo T-001.2 (files `["src/a.ts"]`) and T-001.3 (files `["src/b.ts"]`), F-002 in progress whose only task T-002.1 is blocked with the note `Waiting on the user`, and F-003 approved with todo T-003.1 (files `["src/c.ts"]`)
- **WHEN** `crossFeatureGroups(index)` runs on the built index
- **THEN** it returns `null`

### S-024.3.3 · A feature held by a blocking question is left out {edge}
- **GIVEN** F-001, F-002 and F-003 in progress with todo T-001.1 (files `["src/a.ts"]`), T-002.1 (files `["src/b.ts"]`) and T-003.1 (files `["src/c.ts"]`), and an open blocking question Q-0001 on F-002
- **WHEN** `crossFeatureGroups(index)` runs on the built index
- **THEN** it returns `{ features: ["F-001", "F-003"], groups: [{ tasks: ["T-001.1", "T-003.1"], shared: [] }] }`

## ST-024.4 · azimuth next prints the cross-feature groups
**Intent:** As an orchestrator, I want `azimuth next` to end with the cross-feature groups in the form `next F-NNN` uses, so that I can launch lanes of several features from one command.

### S-024.4.1 · The groups follow the items {happy}
- **GIVEN** F-001 in progress with todo T-001.1 (files `["src/a.ts"]`), and F-002 in progress with todo T-002.1 (files `["src/b.ts"]`) and T-002.2 (files `["src/a.ts"]`)
- **WHEN** `azimuth next` runs
- **THEN** it exits 0 and its stdout is exactly `T-001.1 azimuth move T-001.1 in-progress\n  F-001\nT-002.1 azimuth move T-002.1 in-progress\n  F-002\nT-002.2 azimuth move T-002.2 in-progress\n  F-002\nAcross F-001, F-002:\nCan run together: T-001.1, T-002.1\nOn its own: T-002.2\n`

### S-024.4.2 · One feature with ready tasks prints no cross-feature lines {negative}
- **GIVEN** F-001 in progress with todo T-001.2 (files `["src/a.ts"]`) and T-001.3 (files `["src/b.ts"]`), and F-002 in progress whose only task T-002.1 is blocked with the note `Waiting on the user`
- **WHEN** `azimuth next` runs
- **THEN** it exits 0 and its stdout is exactly `T-001.2 azimuth move T-001.2 in-progress\n  F-001\nT-001.3 azimuth move T-001.3 in-progress\n  F-001\nF-002 Unblock a task\n  Blocked tasks: T-002.1\n`

### S-024.4.3 · Tasks that share only a shared file run together across features {happy}
- **GIVEN** a project with `parallel: { shared_files: [src/registry.ts] }`, F-001 in progress with todo T-001.2 (files `["src/a.ts", "src/registry.ts"]`), and F-002 in progress with todo T-002.1 (files `["src/b.ts", "src/registry.ts"]`)
- **WHEN** `azimuth next` runs
- **THEN** the last two lines of its stdout are `Across F-001, F-002:` and `Can run together: T-001.2, T-002.1 (shared: src/registry.ts)`

### S-024.4.4 · At most six group lines are printed {edge}
- **GIVEN** F-001 in progress with todo T-001.1, T-001.2, T-001.3 and T-001.4, and F-002 in progress with todo T-002.1, T-002.2 and T-002.3, every task with files `["src/a.ts"]`
- **WHEN** `azimuth next` runs
- **THEN** the last eight lines of its stdout are `Across F-001, F-002:`, `On its own: T-001.1`, `On its own: T-001.2`, `On its own: T-001.3`, `On its own: T-001.4`, `On its own: T-002.1`, `On its own: T-002.2` and `… and 1 more`

### S-024.4.5 · next --json stays the array of items {edge}
- **GIVEN** the project of S-024.4.1
- **WHEN** `azimuth next --json` runs
- **THEN** its stdout parses to an array (not an object) whose refs are `["T-001.1", "T-002.1", "T-002.2"]`

### S-024.4.6 · next F-NNN prints only its own groups {edge}
- **GIVEN** the project of S-024.4.1
- **WHEN** `azimuth next F-002` runs
- **THEN** its stdout is exactly `T-002.1 azimuth move T-002.1 in-progress\n  F-002\nT-002.2 azimuth move T-002.2 in-progress\n  F-002\nCan run together: T-002.1, T-002.2\n`

## ST-024.5 · A replaced viewer keeps its port
**Intent:** As the user, I want a restarted viewer to come back on the port it had, so that my open page reconnects and the URL I know stays right.

### S-024.5.1 · A stale viewer is replaced on its port {happy}
- **GIVEN** a git project whose viewer.json records a stand-in stale viewer that exits on SIGTERM, with its pid, port P and `config_port: C`
- **WHEN** `ensureViewer(root, 8_000)` runs
- **THEN** it returns `http://127.0.0.1:<P>/`
- **AND** the stand-in exited with the signal `SIGTERM`, and viewer.json records port P and a pid other than the stand-in's

### S-024.5.2 · A dead viewer's record gives its port {edge}
- **GIVEN** a git project whose viewer.json records pid 999999, port P and `config_port: C`, with nothing listening on P
- **WHEN** `ensureViewer(root, 8_000)` runs
- **THEN** it returns `http://127.0.0.1:<P>/`, not `http://127.0.0.1:<C>/`
- **AND** viewer.json records port P

### S-024.5.3 · A port still taken moves to the next one {edge}
- **GIVEN** a git project whose viewer.json records a stand-in stale viewer that ignores SIGTERM, with its pid, port P and `config_port: C`, where port P+1 is free and isn't C
- **WHEN** `ensureViewer(root, 8_000)` runs
- **THEN** it returns `http://127.0.0.1:<P+1>/`
- **AND** it returned no sooner than 1,000 ms after it was called, and the stand-in still runs

### S-024.5.4 · The wait ends when the process is gone {happy}
- **GIVEN** an `alive` check that returns `true`, `true`, then `false`
- **WHEN** `waitForExit(4242, 1_000, alive)` runs
- **THEN** it resolves `true` after `alive` was called exactly 3 times, each time with 4242

### S-024.5.5 · The wait gives up at its timeout {edge}
- **GIVEN** an `alive` check that always returns `true`
- **WHEN** `waitForExit(4242, 200, alive)` runs
- **THEN** it resolves `false`, no sooner than 200 ms after it was called

### S-024.5.6 · A viewer records the port config.yaml asks for {happy}
- **GIVEN** a project whose config.yaml has `viewer.port: C`
- **WHEN** `startServer({ root, viewerDir, port: P, register: true })` runs
- **THEN** viewer.json records `port: P` and `config_port: C`

### S-024.5.7 · A changed viewer.port wins over the old port {edge}
- **GIVEN** a git project whose config.yaml has `viewer.port: C`, and whose viewer.json records pid 999999, port P and a `config_port` of P (the value config.yaml held before), with nothing listening on P or C
- **WHEN** `ensureViewer(root, 8_000)` runs
- **THEN** it returns `http://127.0.0.1:<C>/`, not `http://127.0.0.1:<P>/`

### S-024.5.8 · A record from an older build follows config.yaml {edge}
- **GIVEN** a git project whose viewer.json records pid 999999 and port P without a `config_port` field, with nothing listening on P or C
- **WHEN** `ensureViewer(root, 8_000)` runs
- **THEN** it returns `http://127.0.0.1:<C>/`
