---
id: F-024
title: Log on issues, cross-feature task groups, a kept viewer port and clearer wording
summary: azimuth log takes issue IDs; azimuth next groups ready tasks across features; autostart keeps a replaced viewer's port; skills and the reapprove refusal explain when no reapproval is needed and show --option's syntax.
status: draft
priority: P2
size: M
mode: brownfield
milestone: M-02
depends_on: []
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
---
# F-024: Log on issues, cross-feature task groups, a kept viewer port and clearer wording

## Objective
Five smaller frictions from the second ZenithMD run (experience report §4.7 and §5.9) cost time
or left no trail. This feature removes each one:

- **An issue keeps a progress trail.** `azimuth log BUG-…` was refused ("not a feature, story,
  scenario or task"), so the 1.1-hour BUG-0005 investigation left nothing in Azimuth until the
  resolving `move --reason`. `azimuth log <issue ID> "<text>"` (BUG-, DEBT-, RISK-) now adds a
  bullet `<time> · <actor> · <text>` to the issue's "## Status notes" section with the existing
  `addStatusNote`, the section where issue moves keep their reasons. The refusal for other kinds
  names the kinds `log` takes. The Issue page's History dates the bullet and sorts it with the
  moves and commits.
- **`azimuth next` groups ready tasks across features.** The "Can run together" lines appeared
  only inside one feature, so the orchestrator matched `files` lists across features by hand.
  `azimuth next` without an ID now ends with the groups of the ready tasks of every in-progress
  feature, built by `parallelGroups` with `parallel.shared_files`, when at least two features
  have ready tasks.
- **A replaced viewer keeps its port.** The viewer ran on 4321 while config.yaml said 4319:
  autostart started the replacement without a port, so the server's scan (`--port N` tries N,
  N+1 …) moved on while the old viewer still held its port, and open pages lost their server.
  `ensureViewer` now starts the replacement of a stale or dead viewer with `--port <old port>`,
  after waiting up to 1 s for a stale one to exit. A changed `viewer.port` still wins: the viewer
  record now keeps the `viewer.port` config.yaml held when that viewer started (`config_port`),
  and when config.yaml says otherwise now, the replacement starts on the configured port.
- **The refused reapprove explains itself.** `azimuth reapprove` is refused while a feature is
  verifying, and the message didn't say that the done gate ignores the approval, so a close-out
  fix looked blocked. The refusal for a verifying feature now says so.
- **The skills say what needs a reapprove and how `--option` is written.** The build skill said
  every spec edit other than notes and settled values makes the approval stale, though plan.md
  isn't part of the spec hash; and `--option "a: text"` was rejected because no skill showed the
  `--option a="Label: detail"` form next to `azimuth new question`.

## Out of scope
- Change requests (`--review`) on issues, and log entries on questions, decisions, milestones,
  sessions or runs.
- Other viewer changes: only the Issue page's History reads the new bullet form. A bullet in no
  known form still shows as written, undated, after the dated rows (F-017's S-017.6.4).
- The JSON of `azimuth next` without an ID: it stays the array of items (F-010's S-010.4.5).
  `azimuth next F-NNN` and its `{items, groups}` JSON are unchanged.
- Cross-feature groups anywhere other than `azimuth next` without an ID (`status --brief`, the
  viewer, `azimuth brief`), and F-023's milestone-ready item in `next`.
- The server's port scan (`server.ts`), the port `azimuth view` picks in the foreground, and
  `view --stop`. The viewer record gains only `config_port`.
- Killing a stale viewer that ignores SIGTERM (no SIGKILL), and waiting for a dead viewer's
  process.
- The inbox's "changed since approval" item for a verifying feature, and the protocol template's
  `azimuth new question` example (`src/core/protocol.ts`).

## Integration points
- `src/core/transitions.ts`: `addLogEntry` dispatches an issue ID (`idKind`, `ids.ts`) to a new
  branch that reads the issue from `analyzeProject`'s model inside `withLock`, as `moveIssue`
  does, and writes the bullet with `addStatusNote` and the `stamp` helper. `reapproveFeature`'s
  status refusal gains a sentence for `verifying`. F-019 and F-020 only read this file.
- `src/cli/commands/write.ts`: the `log` command's summary names issues; its `touch` already
  records an issue ID alone in the session's `touched` list.
- `src/core/next.ts`: a new `crossFeatureGroups(index)` next to `taskGroups`, reusing
  `readyTasks`, `parallelGroups` and `byPriority`. Shared with F-023, which adds its
  milestone-ready item inside `nextWork`; F-024 doesn't change `nextWork`. F-022 reads
  `parallelGroups`.
- `src/cli/commands/read.ts`: the `next` command prints the cross-feature lines (with the
  existing `groupLine`) when it has no ID. Shared with F-020, which changes `trace` in the same
  file.
- `src/server/autostart.ts`: `ensureViewer` compares the record's `config_port` with
  `loadConfig(root).config.viewer.port`, passes `--port` to the detached `view --serve` it
  spawns when they match, and waits for a stale viewer's exit with a new exported `waitForExit`,
  built on `processAlive` (`src/core/live.ts`). The hooks (`src/hooks/handlers.ts`),
  `azimuth view --detach` and `azimuth session start` call `ensureViewer` unchanged.
- `src/server/registry.ts`: `ViewerRecord` gains an optional `config_port` (records written by
  older builds lack it). `src/server/server.ts`: a registering server writes it from
  `loadConfig(root)` (which never throws), next to the port it bound; its port scan is unchanged.
- The Issue page's History: `viewer/src/screens/issues/history.ts` parses a Status notes bullet
  `<stamp> · <actor> · <text>` that isn't a move as a dated `logged` entry, and
  `IssueHistory.tsx` renders it as `<who> noted: <text>`; tests in `history.test.tsx`.
- Agent instructions and docs: `plugin/skills/build/SKILL.md` (shared with F-018, F-019 and
  F-022; F-024 changes only step 5's question bullet and "Notes, settled values and the
  approval"), `plugin/skills/azimuth/SKILL.md` (shared with F-019 and F-021; F-024 changes only
  the `new question` and `log` rows), `plugin/skills/bug/SKILL.md`, `docs/cli.md` (shared with
  every 0.3 feature; F-024 changes the `next`, `reapprove` and `log` rows and the `next`
  paragraph), `docs/file-format.md` (shared with F-018, F-021 and F-023; F-024 changes only the
  issue Status notes paragraph) and `docs/viewer.md`.

## Invariants
- `azimuth log` on a feature, story, scenario or task writes exactly what it writes today, and
  `--review` keeps its rules.
- A log on an issue changes only that issue's file, and only by adding one bullet to its Status
  notes: the frontmatter (`status`, `resolved_at`) and every other section stay byte for byte.
  A refused `log` writes nothing.
- `azimuth next F-NNN`, `azimuth next F-NNN --json` and `azimuth next --json` print what they
  print today. Without an ID, the items come first, unchanged, and the cross-feature lines
  follow them only when at least two features have ready tasks.
- Each ready task appears in at most one cross-feature group, and only tasks `next` lists as
  ready appear.
- `ensureViewer` reuses a healthy or busy viewer as today: no signal, no spawn, same URL. Only a
  stale viewer is signalled, with SIGTERM only, and one call spawns at most one server.
- Without a viewer record, or when the record's `config_port` differs from config.yaml's
  `viewer.port` (or is missing), the spawned server gets no `--port`, so `viewer.port` applies as
  today.
- The History keeps reading move bullets as moves and keeps a bullet in no known form as an
  undated note, as written (F-017's S-017.6.1 to S-017.6.4 pass unchanged).
- `azimuth reapprove` keeps its success path and every refusal other than the verifying one.

## Assumptions
- An issue's log bullet is `<stamp> · <actor> · <text>`: the stamp is the UTC time to the second
  (`2026-10-20T09:00:00Z`), the same prefix issue moves write before
  `<from> → <to>: <reason>`. The text is trimmed; further lines continue indented two spaces
  (`addStatusNote`). Like the moves' bullets, it carries no session ID. The section is created at
  the end of the body when missing. The result message is `BUG-0001: note added`, matching the
  feature form `F-001: note added`.
- The History reads a Status notes bullet as a move first (today's pattern), else as a logged
  note when it is `<stamp> · <you|agent> · <text>` and the stamp parses as a time: kind
  `logged` with `at`, `actor` and `text`, sorted with the other dated entries (ties keep body
  order). Its row reads `Oct 15 An agent noted: <text>` (`You noted: …` for you). Anything else
  stays an undated note.
- The refusal for any other ID reads `Q-0001 is not a feature, story, scenario, task or issue.`
  (code `invalid`). `--review` on an issue is refused with `Change requests (--review) go to a
  feature; BUG-0001 is an issue.` (code `invalid`), checked after the existing "Only the user
  requests changes." policy check. An unknown issue is refused as `moveIssue` refuses it:
  `BUG-0009 does not exist.` (code `not-found`).
- The cross-feature groups take every in-progress feature that no open blocking question holds
  (`nextWork` skips those features too) and that has a ready task; features in `nextWork`'s
  order (priority, then ID), each feature's tasks in `readyTasks` order (in-progress first, then
  plan order); one `parallelGroups` call over all of them with `index.project.shared_files`.
- The printed section is a line `Across F-001, F-002:` naming those features in that order, then
  one `groupLine` per group (`Can run together: …`, `On its own: …`, the form of
  `next F-NNN`), at most six, then `… and <n> more` when more groups exist (the wording
  `status --brief` uses for its issue list). It comes after every item, wherever F-023 puts its
  milestone item.
- `ensureViewer` passes the recorded port both for a stale viewer and for a dead record (any
  `down` state, including a recorded port now answered by another project's viewer) when the
  record's `config_port` equals config.yaml's `viewer.port`: the server's own scan moves on from
  a taken port. Otherwise it passes no `--port`, so the server starts at the configured port.
- The record field is `config_port`, not `requested_port`: it holds config.yaml's `viewer.port`
  at the server's start, not the `--port` it was given, because a replacement started with
  `--port <old port>` must carry the configured value forward for the next comparison. A record
  without it (written before 0.3) counts as differing, so the first replacement after the
  upgrade starts at the configured port (the 4319-vs-4321 confusion of the report ends there).
  The stale viewer is still waited for, since the configured port may be the one it holds.
- `waitForExit` checks at once and then every 50 ms, and resolves `true` as soon as the process
  is gone or `false` at the timeout. `ensureViewer` waits up to 1,000 ms for a stale viewer, on
  top of `waitMs`, so the prompt hook's `ensureViewer(root, 0)` can take up to 1 s longer once
  after a rebuild; a viewer normally exits within a few hundred milliseconds of SIGTERM. When the
  wait times out, the replacement still asks for the old port and the scan takes the next one.
- The build skill states what the approval covers: the feature.md body, impact.md, stories.md
  and contract.md. Editing plan.md (a task's `files`, `covers` or `verify`) needs no reapprove,
  and neither do notes and settled values. The skills that show `azimuth new question` with
  options (build and azimuth) show `--option a="Label: detail"`; the spec skill already does. The
  bug skill gains one sentence on logging progress on an issue.
