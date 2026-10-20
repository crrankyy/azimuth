---
tasks:
  - id: T-021.1
    title: files_changed and deviation rules (red → green)
    status: todo
    after: []
    covers: [S-021.1.1, S-021.1.2, S-021.1.3, S-021.3.1, S-021.3.2, S-021.3.3]
    files: [src/core/as-built.ts, src/core/run-scope.ts, test/core/as-built.test.ts]
    verify: pnpm exec vitest run test/core/as-built.test.ts -t "S-021.1|S-021.3" --reporter=verbose
    note: null
  - id: T-021.2
    title: The done gate needs a reason for every deviation (red → green)
    status: todo
    after: []
    covers: [S-021.6.1, S-021.6.2, S-021.6.3, S-021.6.4]
    files: [src/core/gates.ts, test/core/as-built-gate.test.ts]
    verify: pnpm exec vitest run test/core/as-built-gate.test.ts --reporter=verbose
    note: null
  - id: T-021.3
    title: Read the feature's commits and write as-built.md (red → green)
    status: todo
    after: [T-021.1]
    covers: [S-021.2.1, S-021.2.2, S-021.2.3, S-021.4.1, S-021.4.2, S-021.4.3, S-021.4.4, S-021.4.5]
    files: [src/core/as-built.ts, src/core/git.ts, src/core/frontmatter.ts, src/core/create.ts, test/core/as-built.test.ts]
    verify: pnpm exec vitest run test/core/as-built.test.ts -t "S-021.2|S-021.4" --reporter=verbose
    note: null
  - id: T-021.4
    title: azimuth as-built on the command line (red → green)
    status: todo
    after: [T-021.3]
    covers: [S-021.5.1, S-021.5.2, S-021.5.3, S-021.5.4, S-021.5.5, S-021.5.6]
    files: [src/cli/commands/as-built.ts, src/cli/main.ts, test/cli/as-built.test.ts]
    verify: pnpm exec vitest run test/cli/as-built.test.ts --reporter=verbose
    note: null
  - id: T-021.5
    title: Verify and azimuth skills, docs and full verification
    status: todo
    after: [T-021.2, T-021.4]
    covers: []
    files: [plugin/skills/verify/SKILL.md, plugin/skills/azimuth/SKILL.md, docs/cli.md, docs/file-format.md, docs/concepts.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-021: Plan

Test-first, no scaffolding task: each slice creates what it needs. Two slices start at once and
touch separate files:

- **The draft** (T-021.1 → T-021.3 → T-021.4). T-021.1 creates `src/core/as-built.ts` with the
  types of contract.md and the pure `filesChanged` and `deviationsFor`, and exports `repoPath`
  from `run-scope.ts`. T-021.3 adds `readFeatureCommits` to `git.ts` (moving readCommits' refs
  rule into the private `commitRefs` both use), the `padded` option of `inlineYaml`, the
  `template` export of `create.ts`, and `asBuiltText`, `asBuiltMessage` and `writeAsBuilt`.
  T-021.4 adds the command and its `COMMANDS` entry.
- **The gate** (T-021.2): `asBuiltCheck` in `gates.ts`, with its own test file. It reads only
  the model (`f.files.asBuilt`, `f.asBuilt`), so it needs nothing from the draft slice.

T-021.5 updates the skills and docs, then runs everything.

Notes for builders:

- `filesChanged` takes `{ changes }[]` structurally, so T-021.1 doesn't need `git.ts`; T-021.3's
  `CommitChanges` fits it.
- Test repositories: `writeTree` with `MINIMAL_CONFIG`, `featureFiles` (status and `impact`), a
  `.gitignore` holding `.azimuth/cache/`, then `initRepo` and `commitAll(root, message)` from
  `test/helpers/git.ts`; a trailer goes in the message (`"feat(F-001): add a\n\nRefs: T-001.1"`).
  `commitAll` runs git with `gitEnv()`; `readFeatureCommits` only reads, so no `vi.stubEnv` is
  needed. S-021.2.3 runs `git(root, ["mv", "src/old.ts", "src/new.ts"])` before `commitAll`.
  S-021.2.2's config is `MINIMAL_CONFIG + "git:\n  log_depth: 1\n"`.
- The example project of contract.md is built by a small function in each test file
  (`test/core/as-built.test.ts` and `test/cli/as-built.test.ts`) rather than a new helper file.
  A test that needs an existing as-built.md writes it after the commits; as-built reads only the
  commits, and `.azimuth/` paths never count.
- "Exactly the example file" compares the whole text with the string in contract.md. "The
  deviations are" compares the lines under `deviations:`.
- `commitAll` gives every commit the same date by default, which is why `readFeatureCommits` uses
  `--topo-order`; don't depend on dates for the order.
- The gate tests follow `test/core/settle-gate.test.ts`: `writeTree` without git,
  `analyzeProject(root, now)` and `evaluateGate(ctx, f, "done")`, then the `done.as-built` check.
  Existing tests that read this check (`test/core/analysis.test.ts`, `test/core/git-trace.test.ts`,
  `test/core/settle-gate.test.ts` and `test/fixtures/hookline/expected-index.ts`) must pass
  unchanged: the id, the rule text and the missing-file result stay as they are.
- The CLI tests run `runCli` from `test/helpers/cli.ts`; `<today>` is
  `new Date().toISOString().slice(0, 10)`. S-021.5.1's session file follows
  `test/cli/note.test.ts`.
- `inlineYaml(value, { padded: true })` passes `flowCollectionPadding: true` to `toString`;
  without the option, keep `false`, so every existing frontmatter write is unchanged.
- T-021.5:
  - `plugin/skills/verify/SKILL.md`, step 4 becomes: run `azimuth as-built <F-ID>`, which drafts
    `as-built.md` from the feature's commits (`files_changed`, and the `deviations` from
    impact.md: `unplanned-create`, `unplanned-modify`, `unplanned-delete`, `planned-unchanged`,
    each with an empty reason) and lists the deviations that need a reason. Then edit the file:
    write each deviation's `reason` (why the build differs from the plan), add deviations of your
    own kinds for anything else that differs (a changed interface, a corrected test) with their
    reasons, write the Summary (what was built and how), and file each follow-up with
    `/azimuth:bug` and list its ID in `follow_ups`. Rerun the command after a later commit: it
    keeps the reasons, your deviations, the body and the follow-ups. The done gate refuses while
    a deviation has no reason.
  - `plugin/skills/azimuth/SKILL.md`: a CLI table row `azimuth as-built <F-ID>`, "Draft
    as-built.md from the feature's commits (reruns keep the reasons)".
  - `docs/cli.md`: a Change-table row for `azimuth as-built <F-ID> [--json]` and a paragraph
    after the note and settle one: what it writes (the commits it reads, past `git.log_depth`;
    the change rules; the deviations), what a rerun keeps, the output (the example message),
    the statuses it takes and its refusals, and that it adds the feature to the session's
    `touched` list.
  - `docs/file-format.md`, `as-built.md`: drafted by `azimuth as-built`; `change` is `create`,
    `modify` or `delete` and how each is decided; a table of the four generated deviation kinds
    (and that other kinds may be written by hand); what a rerun keeps; and that the done gate
    needs a non-blank reason on every deviation.
  - `docs/concepts.md`, the verifying → done row: "`as-built.md` exists, parses and gives a
    reason for every deviation" in place of "`as-built.md` exists".

Files shared with other 0.3 features (merge by hunk; F-021 needs no code of theirs):

- `src/core/gates.ts` (F-018, F-020, F-023): F-021 changes only the `done.as-built` line of
  `doneGate` and adds the private `asBuiltCheck`.
- `src/core/git.ts` (F-020 may add a git status reader there): F-021 adds `CommitChanges`,
  `readFeatureCommits` and the private `commitRefs`, and changes only the refs line of
  `readCommits`.
- `docs/cli.md`, `docs/file-format.md` and `docs/concepts.md` (several 0.3 features): F-021
  changes the Change table, the as-built section and the verifying → done row, which F-018 and
  F-020 also edit.
