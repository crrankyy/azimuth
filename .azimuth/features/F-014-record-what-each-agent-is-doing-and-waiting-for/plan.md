---
tasks:
  - id: T-014.1
    title: Scaffolding (index and record types, module signatures)
    status: done
    after: []
    covers: []
    files: [src/core/types.ts, src/core/live.ts, src/core/live-agents.ts, src/core/tools.ts, src/core/transcript.ts, src/server/transcript.ts, src/hooks/handlers.ts, viewer/src/screens/activity/LiveStrip.test.tsx]
    verify: pnpm typecheck && pnpm exec vitest run test/core/live.test.ts test/golden/index.test.ts viewer/src/screens/activity/LiveStrip.test.tsx --reporter=verbose
    note: null
  - id: T-014.2
    title: Edit sizes and tool targets (red → green)
    status: done
    after: [T-014.1]
    covers: [S-014.3.1, S-014.3.2, S-014.3.3, S-014.3.4, S-014.3.5]
    files: [src/core/tools.ts, test/core/tools.test.ts]
    verify: pnpm exec vitest run test/core/tools.test.ts --reporter=verbose
    note: null
  - id: T-014.3
    title: Waits open and close per agent (red → green)
    status: done
    after: [T-014.1]
    covers: [S-014.4.1, S-014.4.2, S-014.4.3, S-014.4.4, S-014.4.5, S-014.4.6]
    files: [src/core/live-agents.ts, test/core/live-agents.test.ts]
    verify: pnpm exec vitest run test/core/live-agents.test.ts -t S-014.4 --reporter=verbose
    note: null
  - id: T-014.4
    title: Statuses, current actions and recent edits (red → green)
    status: done
    after: [T-014.3]
    covers: [S-014.5.1, S-014.5.2, S-014.5.3, S-014.5.4, S-014.5.5, S-014.5.6, S-014.5.7, S-014.5.8, S-014.5.9, S-014.6.1, S-014.6.2, S-014.6.3]
    files: [src/core/live-agents.ts, test/core/live-agents.test.ts]
    verify: pnpm exec vitest run test/core/live-agents.test.ts --reporter=verbose
    note: null
  - id: T-014.5
    title: Live sessions carry activity, goals and transcript flags for 72 hours (red → green)
    status: done
    after: [T-014.4]
    covers: [S-014.7.1, S-014.7.2, S-014.7.3, S-014.7.4, S-014.7.5, S-014.7.6, S-014.7.7]
    files: [src/core/live.ts, test/core/live.test.ts]
    verify: pnpm exec vitest run test/core/live.test.ts --reporter=verbose
    note: null
  - id: T-014.6
    title: Hooks record waits, failures, edit sizes and subagent transcripts (red → green)
    status: done
    after: [T-014.2]
    covers: [S-014.1.1, S-014.1.2, S-014.1.3, S-014.1.4, S-014.1.5, S-014.2.1, S-014.2.2, S-014.2.3, S-014.2.4, S-014.2.5]
    files: [src/hooks/handlers.ts, plugin/hooks/hooks.json, src/cli/commands/harness.ts, test/hooks/hooks.test.ts]
    verify: pnpm build && pnpm exec vitest run test/hooks/hooks.test.ts --reporter=verbose
    note: null
  - id: T-014.7
    title: Transcript windows and normalised entries, with the fixture (red → green)
    status: done
    after: [T-014.2]
    covers: [S-014.8.1, S-014.8.2, S-014.8.3, S-014.8.4, S-014.8.5, S-014.8.6, S-014.8.7, S-014.9.1, S-014.9.2, S-014.9.3, S-014.9.4, S-014.9.5, S-014.9.6]
    files: [src/core/transcript.ts, test/core/transcript.test.ts, test/fixtures/transcripts/c1.jsonl, test/fixtures/transcripts/c1/subagents/agent-a1.jsonl]
    verify: pnpm exec vitest run test/core/transcript.test.ts --reporter=verbose
    note: null
  - id: T-014.8
    title: The token-guarded transcript route (red → green)
    status: done
    after: [T-014.5, T-014.7]
    covers: [S-014.10.1, S-014.10.2, S-014.10.3, S-014.10.4, S-014.10.5, S-014.10.6, S-014.10.7, S-014.10.8, S-014.10.9, S-014.10.10]
    files: [src/server/transcript.ts, src/server/server.ts, test/server/transcript.test.ts]
    verify: pnpm build && pnpm exec vitest run test/server/transcript.test.ts --reporter=verbose
    note: null
  - id: T-014.9
    title: Time-based status changes are pushed (red → green)
    status: done
    after: [T-014.8]
    covers: [S-014.11.1, S-014.11.2]
    files: [src/server/server.ts, test/server/live-refresh.test.ts]
    verify: pnpm exec vitest run test/server/live-refresh.test.ts --reporter=verbose
    note: null
  - id: T-014.10
    title: Docs and full verification
    status: done
    after: [T-014.6, T-014.9]
    covers: []
    files: [docs/claude-code.md, docs/file-format.md, docs/viewer.md, docs/concepts.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-014: Plan

Build after F-011 (this feature's dependency) and F-008, which are next and in flight. Files
F-014 shares with them:

- F-011: `src/core/types.ts`, `src/core/live.ts`, `src/hooks/handlers.ts`,
  `test/core/live.test.ts`, `test/hooks/hooks.test.ts`, `docs/claude-code.md`,
  `docs/file-format.md`, `docs/viewer.md`, `docs/concepts.md` (and it reads
  `src/cli/commands/harness.ts`, which F-014 changes). F-014 builds on F-011's `LiveMeta`,
  `readLiveMeta`, `updateLiveMeta` (test setup), `summarizeLive(…, meta)`, `HookInput.transcript_path`
  and `Session.goals`.
- F-008: `src/core/types.ts`, `docs/file-format.md`, `docs/viewer.md`.
- F-007, F-010, F-012 and F-017 (nearly done): `src/core/types.ts` and docs.

F-014 doesn't change `src/core/build-index.ts`, `src/core/session.ts` or
`test/fixtures/hookline/expected-index.ts`.

Test-first. The scaffolding (T-014.1) adds the index types (`AgentStatus`, `LiveWait`,
`LiveWaitSpan`, `LiveEdit`, `LiveActivity`, the new `LiveEvent`, `LiveAgent` and `LiveSession`
fields, `TranscriptEntry`, `TranscriptPage`), the new live record fields and the `wait` kind, the
`HookInput` fields, and the modules `tools.ts`, `live-agents.ts`, `core/transcript.ts` and
`server/transcript.ts` with their constants and signatures and placeholder bodies. `summarizeLive`
returns placeholder activity (status `running`, empty edits and waits, `transcript` false) so
today's live and viewer tests stay green; the `LiveStrip.test.tsx` builders gain the new fields.

After it, two lanes run in parallel: `tools.ts` (T-014.2) and `live-agents.ts` (T-014.3, then
T-014.4 in the same file). After T-014.2, the hooks (T-014.6, `handlers.ts`, `hooks.json`,
`harness.ts`) and the transcript reader (T-014.7, `core/transcript.ts` and the fixture) run in
parallel with each other and with the `live-agents.ts` lane. `live.ts` (T-014.5) needs
`deriveActivity`. The route (T-014.8) needs `transcriptPathOf` from T-014.5 and the reader from
T-014.7; the status refresh (T-014.9) shares `server.ts` with it, so it comes after.

Notes for builders:

- `deriveActivity` is pure: tests pass records and `now`, no files. Write a small record builder
  in the test file (as `test/core/live.test.ts` does for F-005).
- Hook tests run the built CLI through the launcher (`hook(event, input)` in
  `test/hooks/hooks.test.ts`), so T-014.6 builds first; times there are real, so assertions use
  `toMatchObject` without `at`. S-014.1.5 parses `plugin/hooks/hooks.json`.
- T-014.5 sets file times with `utimesSync` for S-014.7.3, writes sidecars with F-011's
  `updateLiveMeta`, and session files under `.azimuth/sessions/`.
- The fixture follows contract.md's table exactly and holds no real transcript content;
  `test/fixtures/` is excluded from Prettier and from the test globs. Server tests copy it to a
  temp `claude/projects/-demo/` folder, replacing `/work/demo` with the project root, and start
  their own server with `transcriptRoots` (S-014.10.10 renders `exportHtml`, which needs the
  built viewer, hence `pnpm build`).
- S-014.11 drives the server's `now` option with a mutable clock and `statusRefreshMs: 100`;
  the default stays 60 s.
- T-014.10 documents the hooks (table rows, a Transcripts paragraph: read only by the live
  server, never exported, the path checks), the live record kinds and 72-hour retention, the
  route in the HTTP API table and Security section, and agent statuses in concepts; then runs
  everything. The Hookline golden index must not change.
