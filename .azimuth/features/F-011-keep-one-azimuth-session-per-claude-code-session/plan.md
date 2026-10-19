---
tasks:
  - id: T-011.1
    title: Scaffolding, and the Goals and Notes sections in the index
    status: todo
    after: []
    covers: [S-011.6.1, S-011.6.2]
    files: [src/core/types.ts, src/core/parse/records.ts, src/core/facts.ts, src/core/build-index.ts, src/core/live.ts, src/core/session.ts, src/hooks/handlers.ts, test/helpers/project.ts, test/fixtures/hookline/expected-index.ts, test/core/session.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/session.test.ts test/golden/index.test.ts --reporter=verbose
    note: null
  - id: T-011.2
    title: The sidecar and live summaries that read it (red → green)
    status: todo
    after: [T-011.1]
    covers: [S-011.2.1, S-011.2.2, S-011.2.3, S-011.2.4, S-011.5.1]
    files: [src/core/live.ts, test/core/live.test.ts]
    verify: pnpm exec vitest run test/core/live.test.ts --reporter=verbose
    note: null
  - id: T-011.3
    title: Reuse at session start, session notes, the current session and a lean close (red → green)
    status: todo
    after: [T-011.2]
    covers: [S-011.1.1, S-011.1.2, S-011.1.3, S-011.1.4, S-011.1.5, S-011.2.5, S-011.2.6, S-011.2.7, S-011.3.1, S-011.3.2, S-011.3.3, S-011.4.5]
    files: [src/core/session.ts, test/core/session.test.ts]
    verify: pnpm exec vitest run test/core/session.test.ts --reporter=verbose
    note: null
  - id: T-011.4
    title: W-SESSION-OPEN and close --stale skip active sessions (red → green)
    status: todo
    after: [T-011.3]
    covers: [S-011.5.2, S-011.5.3, S-011.5.4, S-011.5.5, S-011.5.6]
    files: [src/core/session.ts, src/core/validate.ts, test/core/session.test.ts]
    verify: pnpm exec vitest run test/core/session.test.ts --reporter=verbose
    note: null
  - id: T-011.5
    title: session note and reuse through the CLI (red → green)
    status: todo
    after: [T-011.3]
    covers: [S-011.1.6, S-011.3.4, S-011.3.5, S-011.3.6, S-011.3.7]
    files: [src/cli/commands/work.ts, test/cli/session.test.ts]
    verify: pnpm exec vitest run test/cli/session.test.ts --reporter=verbose
    note: null
  - id: T-011.6
    title: SessionStart fills the sidecar and SessionEnd closes the session (red → green)
    status: todo
    after: [T-011.3]
    covers: [S-011.4.1, S-011.4.2, S-011.4.3, S-011.4.4, S-011.7.1, S-011.7.2, S-011.7.3]
    files: [src/hooks/handlers.ts, test/hooks/hooks.test.ts]
    verify: pnpm build && pnpm exec vitest run test/hooks/hooks.test.ts --reporter=verbose
    note: null
  - id: T-011.7
    title: Session cards show goals and notes (red → green)
    status: todo
    after: [T-011.1]
    covers: [S-011.6.3, S-011.6.4]
    files: [viewer/src/components/SessionCard.tsx, viewer/src/components/session-card.css, viewer/src/components/SessionCard.test.tsx]
    verify: pnpm exec vitest run viewer/src/components/SessionCard.test.tsx --reporter=verbose
    note: null
  - id: T-011.8
    title: Skills, protocol, docs and full verification
    status: todo
    after: [T-011.4, T-011.5, T-011.6, T-011.7]
    covers: []
    files: [plugin/skills/build/SKILL.md, plugin/skills/spec/SKILL.md, plugin/skills/verify/SKILL.md, plugin/skills/ship/SKILL.md, plugin/skills/azimuth/SKILL.md, src/core/protocol.ts, docs/cli.md, docs/concepts.md, docs/file-format.md, docs/claude-code.md, docs/viewer.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-011: Plan

Build after F-012 (and F-010 and F-008, which are in flight): they change `types.ts`,
`parse/records.ts`, `build-index.ts`, `validate.ts`, `protocol.ts`, the golden index and the
same skills and docs (see Integration points in feature.md).

Test-first. The scaffolding (T-011.1) adds `Session.goals` and `Session.notes` with their parser
(its only behaviour, tested in the new `test/core/session.test.ts`, with the golden index gaining
the two empty fields), `Facts.sesLastSeen` filled by `analyzeProject` and defaulted by `makeFacts`,
`HookInput.transcript_path`, the `LiveMeta` type and the signatures of `liveMetaFile`,
`readLiveMeta`, `updateLiveMeta`, `sessionsLastSeen`, `sessionOfClaude`, `appendNote` and
`sessionStale` with placeholder bodies the next tasks replace, and the optional `meta` argument
of `summarizeLive`.

After it, the sidecar (T-011.2, `live.ts`) and the viewer (T-011.7) touch separate files and can
be built in parallel. The session logic (T-011.3, `session.ts`) needs the sidecar. After it, the
stale rule (T-011.4, `session.ts` and `validate.ts`), the CLI (T-011.5, `work.ts`) and the hooks
(T-011.6, `handlers.ts`) touch separate files and can be built in parallel; T-011.4 and T-011.3
share `test/core/session.test.ts`, which is why T-011.4 comes after T-011.3. Hook tests run
against the built CLI, so T-011.6 builds first; its in-process tests call the handlers with
`ctx.now` for exact times. S-011.4.5 spies on `loadProject` (wrapping the real module with
`vi.mock`, as `test/cli/new.test.ts` does for `recordInSession`), which guards the SessionEnd
budget without a wall-clock test; S-011.4.4 keeps one wall-clock check like the existing
"ends the session quickly" test. T-011.8 stops the build, spec, verify and ship skills calling
`session close`, updates the azimuth skill's reference table and the protocol template's
Sessions section, documents the behaviour and runs everything.
