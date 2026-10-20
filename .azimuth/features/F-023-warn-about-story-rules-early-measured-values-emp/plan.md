---
tasks:
  - id: T-023.1
    title: Measured values in THEN and AND lines (red → green)
    status: todo
    after: []
    covers: [S-023.2.1, S-023.2.2, S-023.2.3]
    files: [src/core/parse/stories.ts, test/core/measured.test.ts]
    verify: pnpm exec vitest run test/core/measured.test.ts -t "S-023.2.[123]" --reporter=verbose
    note: null
  - id: T-023.2
    title: Milestones ready for release in check and next (red → green)
    status: todo
    after: []
    covers: [S-023.5.1, S-023.5.2, S-023.5.3, S-023.5.4, S-023.6.1, S-023.6.2, S-023.6.3]
    files: [src/core/derive.ts, src/core/validate.ts, src/core/next.ts, test/core/milestone-ready.test.ts, test/cli/milestone.test.ts]
    verify: pnpm exec vitest run test/core/milestone-ready.test.ts test/cli/milestone.test.ts -t "S-023.[56]" --reporter=verbose
    note: null
  - id: T-023.3
    title: Story rule for ideas, W-MEASURED and W-NO-COVERS in drafts (red → green)
    status: todo
    after: [T-023.1, T-023.2]
    covers: [S-023.1.1, S-023.1.2, S-023.1.3, S-023.2.4, S-023.2.5, S-023.3.1, S-023.3.2, S-023.3.3, S-023.3.4]
    files: [src/core/validate.ts, test/core/check-hints.test.ts, test/cli/check.test.ts, test/core/analysis.test.ts, test/golden/index.test.ts]
    verify: pnpm exec vitest run test/core/check-hints.test.ts test/cli/check.test.ts test/core/analysis.test.ts test/golden/index.test.ts -t "S-023.1|S-023.2.[45]|S-023.3|S-013.1|catches drift|matches the sample.s problems" --reporter=verbose
    note: null
  - id: T-023.4
    title: Hints don't count toward strict approval (red → green)
    status: todo
    after: [T-023.3]
    covers: [S-023.4.1, S-023.4.2, S-023.4.3]
    files: [src/core/validate.ts, src/core/gates.ts, test/core/strict-hints.test.ts]
    verify: pnpm exec vitest run test/core/strict-hints.test.ts -t "S-023.4" --reporter=verbose
    note: null
  - id: T-023.5
    title: Docs, spec skill, strict comments and full verification
    status: todo
    after: [T-023.4]
    covers: []
    files: [docs/file-format.md, docs/concepts.md, docs/cli.md, plugin/skills/spec/SKILL.md, src/core/init.ts, src/core/types.ts]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-023: Plan

The work is test-first, and every task writes its scenarios' tests before the code. Read the
preamble of `stories.md` first: it defines the default project and Fixture A, which `azimuth
brief` doesn't print. Tests write the real placeholder characters where stories.md writes ⟦?⟧
and ⟦=v⟧.

T-023.1 (the parser) and T-023.2 (milestones) touch separate files and can be built in
parallel. T-023.3 needs both: it reads `thenLines` and `measuredValue`, and it changes
`validate.ts` after T-023.2. T-023.4 adds the hint list to `validate.ts` and the strict filter to
`gates.ts`. T-023.5 changes the docs and the skill, then runs everything. The plan needs no
scaffolding task.

Notes for builders:

- **T-023.1** (`parse/stories.ts`):
  - Track `thenLines` on the parser's `Draft`. A THEN clause starts a list with its body and
    line. An AND whose previous clause is THEN adds an entry. An indented continuation line
    while the last clause is THEN appends ` <text>` to the last entry, as the clause text does.
  - `finishScenario` copies the list. The joined `then` text stays as it is.
  - `measuredValue` sits beside `isVague` and imports `placeholderParts` from
    `../placeholders`, which has no Node imports.
  - Write the two patterns of contract.md as module constants, case-insensitive for the word
    pattern. Return `match[0]` of the earliest match by index.
- **T-023.2** (`derive.ts`, `validate.ts`, `next.ts`):
  - `milestoneReady` goes right after `milestoneProgress`: status planned or active,
    `progress.total > 0` and `progress.done === progress.total`.
  - `milestoneProblems(model)` is a private function in `validate.ts`, listed in `validate()`
    after `questionProblems`. It spreads `milestoneProgress(model, m.id)` into each record.
  - `releaseItems` maps `index.milestones.filter(milestoneReady)`. `nextWork` pushes it right
    after the critical issues, as its own statement, so F-024's cross-feature groups (a separate
    change to `azimuth next` with no ID) merge by hunk.
  - Core tests build the index with `buildIndex(tree.root)` over `writeTree`, as
    `test/core/next.test.ts` does.
  - A milestone file is `---\nid: M-01\ntitle: First\nstatus: planned\n---\n`. Features join
    with `extra: { milestone: "M-01" }`, and a cancelled one is
    `featureFiles({ …, status: "cancelled", ideaOnly: true })`.
  - An issue file is
    `---\nid: BUG-0001\ntype: bug\ntitle: Crash\nseverity: critical\ncreated: 2026-10-01\n---\n`.
  - S-023.5.1 to S-023.5.3 and S-023.6.1 go in `test/core/milestone-ready.test.ts`. S-023.5.4,
    S-023.6.2 and S-023.6.3 go in `test/cli/milestone.test.ts`, run with `runCli` in projects
    that hold `src/app.ts`.
- **T-023.3** (`validate.ts`):
  - In `featureProblems`, move the story-kind loop out of the `specified` block under
    `specified || f.status === "idea"`. The uncovered-scenario check, `W-SIZE-XL`,
    `E-SPEC-MISSING` and `pathProblems` stay under `specified`.
  - Add the draft-only `W-MEASURED` and `W-NO-COVERS` loops, with the exact messages of
    contract.md. `W-NO-COVERS` skips a task whose `files` is non-empty and all end in `.md`.
    S-023.3.4 goes in `test/core/check-hints.test.ts`.
  - Existing tests change because what they pin changes. A draft task covering nothing now gets
    a hint, so:
    - `test/cli/check.test.ts`: in `project()`, T-001.2 gets `covers: ["S-001.1.1"]`. The
      S-013.1 tests' expected output then stays exactly what F-013's THEN values say (S-001.2.1
      is still uncovered). Update the doc comment above `project()` to match. Add S-023.1.1 and
      S-023.3.3 in their own `describe` in this file.
    - `test/core/analysis.test.ts`: in "catches drift, uncovered scenarios, task problems and
      missing paths", the expected list gains `"W-NO-COVERS T-002.1"`.
    - `test/golden/index.test.ts`: `expectedWithDeviations()` adds the five hints of the Hookline
      drafts with a comment saying the sample predates them, and re-sorts with `sortProblems`
      (from `src/core/validate.ts`). The hints are for T-008.1, T-008.5 and T-008.6 (file
      `.azimuth/features/F-008-delivery-replay/plan.md`) and for T-009.4 and T-009.5 (file
      `.azimuth/features/F-009-endpoint-rate-limits/plan.md`), in that order, each with line
      null and the W-NO-COVERS message. Hookline's drafts hold no `W-MEASURED` match, and its
      idea F-010 has no stories.
  - The verify runs those tests by name too.
- **T-023.4** (`validate.ts`, `gates.ts`):
  - Add `HINT_CODES` and `isHint` near the top of `validate.ts`.
  - In `approveGate`'s strict block, filter `featureProblems(ctx, f, "warning")` with
    `!isHint(p)`, with a comment on why: nothing silences a hint, and it goes away at approval.
  - The test builds the gate context as `test/core/analysis.test.ts`'s `analyze()` does. Use
    `loadTree(files, config)`, and set `makeFacts({ git: { available: true, headSpecHash: new
    Map([["F-001", specHash(spec)]]) } })`.
- **T-023.5**:
  - `docs/file-format.md`:
    - Stories: a "Measured value" row (`W-MEASURED` in a draft, the patterns, "write `{?}`",
      placeholders never count). The story-kind sentence says `check` warns (`W-NO-NEGATIVE`)
      from the moment a feature has stories, its idea included.
    - `plan.md`: `W-NO-COVERS` in a draft for a task with empty `covers`, except one whose files
      are all Markdown; fine to leave for scaffolding or wiring; gone at approval.
    - Milestones: `W-MILESTONE-READY` and the `azimuth next` item.
    - Config: the `strict` comment reads "true: auto-approval also requires zero warnings
      (hints aside)".
  - `docs/concepts.md`:
    - The draft → approved row: "(With `autonomy.strict`: no warnings either; hints don't
      count.)"
    - Autonomy: the `strict` comment, plus one sentence on hints.
    - Milestones in "Other lifecycles": a milestone whose features are all done is reported and
      offered by `azimuth next` for you to release.
    - Problems: hints (`W-MEASURED`, `W-NO-COVERS`) are warnings about a draft that `check`
      shows like any other, and `autonomy.strict` doesn't count.
  - `docs/cli.md`: the `azimuth next` row reads "(critical bugs and debt, then milestones ready
    for you to release, then feature work by status and priority, then high-severity ones)".
  - `plugin/skills/spec/SKILL.md`, section 4:
    - `check` already applies the story rule to the idea, so running it before
      `move <F-ID> draft` catches what the approval gate would refuse.
    - After the draft move, run `check <F-ID>` again for the draft hints. `W-MEASURED` means: if
      only the code can measure the value, write `{?}` (section 3). `W-NO-COVERS` doesn't come up for
      a task whose files are all Markdown, and is fine to leave for scaffolding or wiring. Hints don't count toward `autonomy.strict`.
  - `src/core/init.ts` and `src/core/types.ts`: the `strict` comments say hints aside.

Files shared with other 0.3 features (merge by hunk):

- `src/core/gates.ts` (F-018, F-020, F-021): only the strict block of `approveGate`.
- `src/core/derive.ts` (F-020): only the new `milestoneReady`.
- `src/core/next.ts` (F-024; F-022 reads it): only `releaseItems` and one line in `nextWork`.
- `src/core/types.ts` (F-018, F-020) and `src/core/init.ts` (F-018, F-022): one comment line
  each.
- `docs/cli.md`, `docs/file-format.md` and `docs/concepts.md`: only the rows and sentences named
  above.
- `test/golden/index.test.ts` (F-018 reads it): only `expectedWithDeviations`. F-018 and F-020
  change `test/fixtures/hookline/expected-index.ts`, which F-023 leaves alone.
