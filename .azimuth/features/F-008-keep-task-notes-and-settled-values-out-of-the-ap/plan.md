---
tasks:
  - id: T-008.1
    title: Scaffolding, and notes in the index (red → green)
    status: todo
    after: []
    covers: [S-008.3.1, S-008.3.2, S-008.3.3, S-008.3.4]
    files: [src/core/placeholders.ts, src/core/notes.ts, src/core/settle.ts, src/cli/commands/note.ts, src/cli/commands/settle.ts, src/cli/main.ts, src/core/types.ts, src/core/model.ts, src/core/build-index.ts, test/fixtures/hookline/expected-index.ts, test/core/notes.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/notes.test.ts test/golden/index.test.ts --reporter=verbose
    note: null
  - id: T-008.2
    title: azimuth note writes notes.md (red → green)
    status: todo
    after: [T-008.1]
    covers: [S-008.1.1, S-008.1.2, S-008.1.3, S-008.1.4, S-008.1.5, S-008.2.1, S-008.2.2]
    files: [src/core/notes.ts, src/cli/commands/note.ts, test/core/notes.test.ts, test/cli/note.test.ts]
    verify: pnpm exec vitest run test/core/notes.test.ts test/cli/note.test.ts -t "S-008.1|S-008.2" --reporter=verbose
    note: null
  - id: T-008.3
    title: Placeholder rules and the spec hash (red → green)
    status: todo
    after: [T-008.1]
    covers: [S-008.5.1, S-008.5.2, S-008.5.3, S-008.5.4, S-008.5.5, S-008.6.1, S-008.6.2, S-008.6.3, S-008.6.4, S-008.6.5, S-008.8.1, S-008.8.2, S-008.8.3, S-008.8.4]
    files: [src/core/placeholders.ts, src/core/spec-hash.ts, test/core/placeholders.test.ts]
    verify: pnpm exec vitest run test/core/placeholders.test.ts --reporter=verbose
    note: null
  - id: T-008.4
    title: azimuth settle records the value (red → green)
    status: todo
    after: [T-008.3]
    covers: [S-008.7.1, S-008.7.2, S-008.7.3, S-008.7.4, S-008.7.5, S-008.8.5]
    files: [src/core/settle.ts, src/cli/commands/settle.ts, test/core/settle.test.ts, test/cli/settle.test.ts]
    verify: pnpm exec vitest run test/core/settle.test.ts test/cli/settle.test.ts --reporter=verbose
    note: null
  - id: T-008.5
    title: The done gate waits for every placeholder (red → green)
    status: todo
    after: [T-008.3]
    covers: [S-008.9.1, S-008.9.2, S-008.9.3]
    files: [src/core/gates.ts, test/core/settle-gate.test.ts, test/core/analysis.test.ts, test/core/git-trace.test.ts, test/fixtures/hookline/expected-index.ts]
    verify: pnpm exec vitest run test/core/settle-gate.test.ts test/core/analysis.test.ts test/core/git-trace.test.ts test/golden/index.test.ts --reporter=verbose
    note: null
  - id: T-008.6
    title: Agent-settled values in the Review list, and acknowledging them (red → green)
    status: todo
    after: [T-008.3]
    covers: [S-008.10.1, S-008.10.2, S-008.10.3, S-008.10.4, S-008.10.5, S-008.10.6, S-008.10.7, S-008.10.8]
    files: [src/core/inbox.ts, src/core/transitions.ts, src/core/delta.ts, test/core/settle-review.test.ts]
    verify: pnpm exec vitest run test/core/settle-review.test.ts --reporter=verbose
    note: null
  - id: T-008.7
    title: Viewer shows notes and marks placeholders (red → green)
    status: todo
    after: [T-008.3]
    covers: [S-008.4.1, S-008.4.2, S-008.4.3, S-008.4.4, S-008.11.1, S-008.11.2, S-008.11.3, S-008.11.4]
    files: [viewer/src/screens/feature/AsBuiltTab.tsx, viewer/src/screens/feature/featureData.ts, viewer/src/screens/feature/FeatureDetail.tsx, viewer/src/screens/feature/StoriesTab.tsx, viewer/src/screens/feature/feature.css, viewer/src/screens/feature/AsBuiltTab.test.tsx, viewer/src/screens/feature/StoriesTab.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/feature/AsBuiltTab.test.tsx viewer/src/screens/feature/StoriesTab.test.tsx --reporter=verbose
    note: null
  - id: T-008.8
    title: Agent instructions, docs and full verification
    status: todo
    after: [T-008.2, T-008.4, T-008.5, T-008.6, T-008.7]
    covers: []
    files: [plugin/skills/spec/SKILL.md, plugin/skills/build/SKILL.md, plugin/skills/azimuth/SKILL.md, src/core/protocol.ts, docs/cli.md, docs/concepts.md, docs/file-format.md, docs/viewer.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-008: Plan

Test-first. T-008.1 lays down every new module with its signatures (placeholder bodies the
next tasks replace), registers `note` and `settle` in `COMMANDS`, and adds `notes` to the model
and the index with its tests. That changes the Hookline golden index by `notes: null` in F-005's
detail, which `expected-index.ts` gains. The commands' wiring (arguments, `--json`, session) is
written here too, so later tasks only fill in the core functions they call.

After T-008.1, the notes slice (T-008.2: `notes.ts`, the `note` command) and the placeholder
rules (T-008.3: `placeholders.ts`, `spec-hash.ts`) touch separate files and can be built in
parallel. Once T-008.3 has the shared rules, four slices with disjoint files can run at once:
- T-008.4: `settle.ts` and the `settle` command.
- T-008.5: the done gate. It also adds the new check to the tests that list every done check
  (`analysis.test.ts`, S-002.3.1 and S-002.3.2 in `git-trace.test.ts`, and F-007's next gate in
  `expected-index.ts`). Those tests aren't wrong; the gate's check list changes.
- T-008.6: the inbox's Review items, `acknowledge` (for features you approved too) and the
  delta's wording. Its tests write settle entries into log.md directly, so it doesn't wait for
  T-008.4. **It also waits for F-012's build** (T-012.2 to T-012.4 edit `inbox.ts`, `delta.ts`
  and `acknowledge` in `transitions.ts`). Azimuth's `after` can't name another feature's task,
  so this ordering lives here and in feature.md: start T-008.6 only once F-012's tasks are done.
- T-008.7: the viewer (Notes in the As-built tab, placeholder marks in the Stories tab).

T-008.8 updates the spec and build skills, the azimuth skill's CLI reference, the protocol
template, and the CLI, concepts, file-format and viewer docs, then runs everything.

Files shared with other features in flight (merge by hunk; F-008 doesn't touch `write.ts`,
`config.ts`, `verify.ts`, `parse/run.ts`, `work.ts` or the Inbox and Questions screens):
- F-007 (in progress): `src/core/types.ts` (F-008 adds one field to `FeatureDetail`),
  `src/cli/main.ts` (two `COMMANDS` entries), `docs/cli.md`, `docs/file-format.md`,
  `plugin/skills/build/SKILL.md`.
- F-012 (being built): `src/core/inbox.ts` (F-012 adds question items in the questions loop;
  F-008 changes the feature `review-auto` block), `src/core/transitions.ts` (both change
  `acknowledge`: F-012 for questions, F-008 for features), `src/core/delta.ts` (F-012 for
  questions, F-008 for the feature acknowledgement text), `test/fixtures/hookline/expected-index.ts`,
  `test/core/analysis.test.ts`, `src/core/protocol.ts`, `plugin/skills/spec/SKILL.md`,
  `plugin/skills/azimuth/SKILL.md`, `docs/cli.md`, `docs/concepts.md`, `docs/file-format.md`, `docs/viewer.md`.
- F-013 (in progress): `src/cli/main.ts`, `src/core/protocol.ts`, `plugin/skills/azimuth/SKILL.md`,
  `docs/cli.md`.
- F-017 (in progress): `src/core/types.ts`, `docs/viewer.md`.
- F-006 (T-006.6 open): `docs/concepts.md`, `docs/file-format.md`. Its `doneGate` change is
  already committed, and T-008.5 builds on it.
- F-010 (idea): its shared-files setting has no impact map yet; none of F-008's files is a
  registry file.
