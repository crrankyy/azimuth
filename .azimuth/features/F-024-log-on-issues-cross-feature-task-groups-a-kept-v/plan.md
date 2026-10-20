---
tasks:
  - id: T-024.1
    title: Log on issues (red → green)
    status: in-progress
    after: []
    covers: [S-024.1.1, S-024.1.2, S-024.1.3, S-024.1.4, S-024.1.5, S-024.1.6, S-024.1.7, S-024.1.8]
    files: [src/core/transitions.ts, src/cli/commands/write.ts, viewer/src/screens/issues/history.ts, viewer/src/screens/issues/IssueHistory.tsx, test/core/transitions.test.ts, test/cli/log.test.ts, viewer/src/screens/issues/history.test.tsx]
    verify: pnpm exec vitest run test/core/transitions.test.ts test/cli/log.test.ts viewer/src/screens/issues/history.test.tsx -t "S-024.1" --reporter=verbose
    note: null
  - id: T-024.2
    title: The reapprove refusal in verifying (red → green)
    status: todo
    after: [T-024.1]
    covers: [S-024.2.1, S-024.2.2, S-024.2.3]
    files: [src/core/transitions.ts, test/core/transitions.test.ts]
    verify: pnpm exec vitest run test/core/transitions.test.ts -t "S-024.2" --reporter=verbose
    note: null
  - id: T-024.3
    title: Cross-feature groups of ready tasks (red → green)
    status: in-progress
    after: []
    covers: [S-024.3.1, S-024.3.2, S-024.3.3]
    files: [src/core/next.ts, test/core/next.test.ts]
    verify: pnpm exec vitest run test/core/next.test.ts -t "S-024.3" --reporter=verbose
    note: null
  - id: T-024.4
    title: azimuth next prints the cross-feature groups (red → green)
    status: todo
    after: [T-024.3]
    covers: [S-024.4.1, S-024.4.2, S-024.4.3, S-024.4.4, S-024.4.5, S-024.4.6]
    files: [src/cli/commands/read.ts, test/cli/parallel.test.ts]
    verify: pnpm exec vitest run test/cli/parallel.test.ts -t "S-024.4" --reporter=verbose
    note: null
  - id: T-024.5
    title: A replaced viewer keeps its port (red → green)
    status: in-progress
    after: []
    covers: [S-024.5.1, S-024.5.2, S-024.5.3, S-024.5.4, S-024.5.5, S-024.5.6, S-024.5.7, S-024.5.8]
    files: [src/server/autostart.ts, src/server/registry.ts, src/server/server.ts, test/server/autostart.test.ts]
    verify: pnpm exec vitest run test/server/autostart.test.ts -t "S-024.5" --reporter=verbose
    note: null
  - id: T-024.6
    title: Skills, docs and full verification
    status: todo
    after: [T-024.2, T-024.4, T-024.5]
    covers: []
    files: [plugin/skills/build/SKILL.md, plugin/skills/azimuth/SKILL.md, plugin/skills/bug/SKILL.md, docs/cli.md, docs/viewer.md, docs/file-format.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-024: Plan

Test-first, in three independent slices that start together: `transitions.ts` (T-024.1, then
T-024.2, since both change that file and its test), `next.ts` then `read.ts` (T-024.3, then
T-024.4), and `autostart.ts` (T-024.5). No scaffolding task: each slice's types live in its own
file. T-024.6 changes the skills and docs, then runs everything.

Notes for builders:

- T-024.1: in `addLogEntry`, after the two existing checks, branch on `idKind(ref) === "issue"`
  before `featureOf`: refuse `review`, then inside `withLock` find the issue in
  `analyzeProject(root, now).model.issues` (as `moveIssue` does), and save
  ``addStatusNote(read(root, issue.file), `${stamp(now)} · ${opts.actor} · ${body.trim()}`)``.
  The refusal for every other kind replaces `is not a feature, story, scenario or task.` with
  `is not a feature, story, scenario, task or issue.` `addStatusNote`'s comment ("Issues have
  no log, so the reasons given for their moves are kept here.") names the notes `log` adds too.
  In `write.ts` only the `log` summary changes (contract.md). Tests: S-024.1.1, .2, .5 and .6 extend `test/core/transitions.test.ts`
  with its `repo()` and `errorOf()` helpers; S-024.1.3 and .4 go in the new
  `test/cli/log.test.ts` with `runCli` and `writeTree` (no git needed; create Q-0001 with
  `runCli(root, ["new", "question", "Which one?"])`); S-024.1.7 extends
  `viewer/src/screens/issues/history.test.tsx`, reusing its `fixture`, `bug1`, `KEEP_LEASE`,
  `rows` and `renderHistory`; S-024.1.8 goes there too. In `history.ts`, `parseBullet` tries
  `MOVE_NOTE` first, then a `LOG_NOTE` pattern `/^(\S+) · (you|agent) · (.+)$/` with the same
  `Date.parse` check, else today's undated note; `HistoryEntry` gains the `logged` member
  (contract.md). In `IssueHistory.tsx`, `EntryText` gains a `logged` case,
  `<Who by={entry.actor} /> noted: {entry.text}`. F-017's S-017.6.x tests must pass unchanged.
- T-024.2: in `reapproveFeature`, append ` The done gate doesn't check the approval, so a spec fix
  during close-out needs no reapproval.` to the status refusal when `f.status === "verifying"`.
  Tests write F-001 with `featureFiles({ id: "F-001", status })` in `repo()`.
- T-024.3: `crossFeatureGroups` goes after `taskGroups` in `next.ts` and doesn't touch
  `nextWork` (F-023 changes it). Filter `index.features` to in-progress ones without a
  `blocked_by` entry of kind `question`, sort with `byPriority`, keep those with
  `readyTasks(f).length > 0`, return null below two, else one
  `parallelGroups(tasks, index.project.shared_files)`. Tests write several features with
  `writeTree` and `featureFiles` (priority through `extra: { priority: "P0" }`), the blocking
  question with `createQuestion(root, { title, feature: "F-002", blocking: true }, ctx)` from
  `src/core/create.ts`, then `buildIndex`.
- T-024.4: in the `next` command, after the items and only without an F-ID, print
  `crossFeatureLines(cross)` when `crossFeatureGroups(index)` isn't null, reusing `groupLine`.
  `--json` and the F-ID path stay as they are. Tests extend `test/cli/parallel.test.ts` with its
  `project`, `SHARED_CONFIG` and `lastLines` helpers.
- T-024.5: `waitForExit` and the `--port` argument go in `autostart.ts`; `ensureViewer` keeps its
  signature and passes `--port <existing.port>` only when `existing.config_port ===
  loadConfig(root).config.viewer.port`. `registry.ts` adds the optional `config_port` to
  `ViewerRecord`; `server.ts` writes it in the record (`register: true`) from
  `loadConfig(root).config.viewer.port`. S-024.5.6 runs `startServer` in process
  (`viewerDir` as in `test/server/lifecycle.test.ts`, `plugin/dist/viewer`) and closes it. Its spawned server is the built bundle (`plugin/dist/cli.mjs`, from `cliPath()`),
  whose `view --serve` already takes `--port`, so the tests don't need a rebuild. Tests extend
  `test/server/autostart.test.ts`, each with its own project (git, `viewer.port: <C>` from
  `freePort()`):
  - The stand-in stale viewer is `spawn(process.execPath, ["-e", <script>, String(P), root])`
    with an `http` server on 127.0.0.1:P answering `{"build":"0.0.0+0","root":<realpathSync(root)>}`
    (`healthy` compares the real path; on macOS temp folders resolve under /private). For
    S-024.5.3 the script also sets `process.on("SIGTERM", () => {})`. Wait until it answers
    before writing viewer.json (`recordFor` with its pid, P and `config_port: C`). The stand-in is the test
    process's child: Node reaps it while `waitForExit` polls, so `processAlive` turns false
    once it exited.
  - S-024.5.3 needs a P whose P+1 is also free: probe pairs with `freePort()` until both bind.
  - The bundle spawned by `ensureViewer` predates `config_port` until the next build, so no
    T-024.5 test reads `config_port` from a record the spawned viewer wrote; S-024.5.6 covers
    the writer in process.
  - Every test kills what it started in `finally`: the new viewer (the pid in viewer.json,
    SIGTERM) and the stand-in (SIGKILL), then removes the project.
  - S-024.5.4 and .5 call `waitForExit` with a stub `alive`; S-024.5.5 asserts only the lower
    bound on time (the files run one at a time, but a busy machine stretches timers).
- T-024.6 (wording; prettier realigns the tables):
  - `plugin/skills/build/SKILL.md`, step 5's first bullet: ``a decision is needed: raise a
    question (`azimuth new question "<question>" --feature <F-ID> --option a="Label: detail"
    --option b="Label: detail" --recommend a`), and `azimuth move <T-ID> blocked --note
    "Waiting on Q-…"` if it blocks the task;``. In "Notes, settled values and the approval",
    everything before its last sentence becomes: "The approval covers the feature.md body,
    impact.md, stories.md and contract.md. plan.md isn't part of it: editing a task's `files`,
    `covers` or `verify` needs no `azimuth reapprove`, and neither do `azimuth note` and
    `azimuth settle`. An edit to one of the four spec files makes the approval stale: a lesson
    written into feature.md, or a story corrected because the code proved a THEN wrong. A story
    correction needs `azimuth reapprove <F-ID>` while the feature is approved or in progress;
    once it is verifying, the done gate doesn't check the approval, so a close-out fix needs
    none. A lesson belongs in a note." The last sentence (settled values reviewed in the inbox,
    no done while a placeholder is open) stays.
  - `plugin/skills/azimuth/SKILL.md`: the `new question` row shows
    `azimuth new question "<question>" --feature F-NNN [--blocking] --option a="Label: detail" --option b="Label: detail" --recommend a`;
    the `log` row says "Progress note in the feature's log, or in an issue's Status notes".
  - `plugin/skills/bug/SKILL.md`, after step 4: "While you investigate or fix an issue, record
    each finding with `azimuth log <ID> "<finding>"`: it adds a dated bullet to the issue's
    Status notes, where `azimuth move <ID> resolved --reason "…"` later adds the closing one."
  - `docs/cli.md`: the `next` row adds "and, across features, which ready tasks can run
    together"; the `reapprove` row adds "Only approved and in-progress features: a verifying
    feature needs none, since the done gate doesn't check the approval."; the `log` row adds
    "for an issue (`BUG-`, `DEBT-`, `RISK-`), a bullet `<time> · <actor> · <message>` in its
    Status notes, next to the reasons of its moves" and "`--review` (you only, features only)".
    After "Without an ID, `--json` prints the array of items.", a paragraph: without an ID, when
    two or more in-progress features have ready tasks, the output ends with `Across <F-IDs>:`
    and the group lines of all their ready tasks together (features in `next`'s order, a
    feature held by an open blocking question left out, `parallel.shared_files` as above), at
    most six, then `… and <n> more`; `--json` still prints the array of items. Add an example
    block.
  - `docs/viewer.md`, after "A newer build replaces an older running viewer automatically": the
    replacement keeps the old viewer's port (it waits up to a second for the old one to exit and
    takes the next free port only when that one is still taken); a viewer that stopped without
    removing its record (a crash, a reboot) comes back on the port it had, so open pages
    reconnect; when `viewer.port` in config.yaml changed since that viewer started, the
    replacement starts at the new `viewer.port` (or the next free port) instead.
  - `docs/viewer.md`'s Issue row says "history" without listing its rows, so it stays as is.
  - `docs/file-format.md`, the issue paragraph on Status notes: `azimuth log <ID> "<text>"` adds
    a bullet there too, `<time> · <actor> · <text>`, with an example line under the move's one
    (`- 2026-10-18T17:05:00Z · agent · Fails only offline`).

Files shared with other 0.3 features (merge by hunk; F-024 changes only its own functions and
sections):

- F-023: `src/core/next.ts` (F-023 adds the milestone-ready item in `nextWork`; F-024 adds
  `crossFeatureGroups` after `taskGroups`) and possibly `test/core/next.test.ts`.
- F-020: `src/cli/commands/read.ts` (F-020 changes `trace`; F-024 changes `next`).
- F-018, F-019, F-022: `plugin/skills/build/SKILL.md` (F-024 changes only step 5's question bullet
  and "Notes, settled values and the approval").
- F-019, F-021: `plugin/skills/azimuth/SKILL.md` (F-024 changes only the `new question` and
  `log` rows).
- Every 0.3 feature: `docs/cli.md` (F-024 changes the `next`, `reapprove` and `log` rows and adds
  the cross-feature paragraph after `next`'s groups).
- F-018, F-021, F-023: `docs/file-format.md` (F-024 changes only the issue Status notes
  paragraph).
