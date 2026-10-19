---
tasks:
  - id: T-010.1
    title: The parallel.shared_files key and project.shared_files in the index
    status: done
    after: []
    covers: [S-010.1.1, S-010.1.2, S-010.1.3, S-010.1.4, S-010.1.5]
    files: [src/core/config.ts, src/core/types.ts, src/core/build-index.ts, test/core/parse.test.ts, test/cli/parallel.test.ts, test/fixtures/hookline/expected-index.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/parse.test.ts test/cli/parallel.test.ts -t S-010.1 --reporter=verbose && pnpm exec vitest run test/golden/index.test.ts --reporter=verbose
    note: null
  - id: T-010.2
    title: File conflicts skip shared files (red → green)
    status: done
    after: [T-010.1]
    covers: [S-010.2.1, S-010.2.2, S-010.2.3, S-010.2.4]
    files: [src/core/validate.ts, src/core/derive.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t "S-010.2|one conflict per pair" --reporter=verbose
    note: null
  - id: T-010.3
    title: Group ready tasks that can run together (red → green)
    status: done
    after: [T-010.1]
    covers: [S-010.3.1, S-010.3.2, S-010.3.3, S-010.3.4, S-010.3.5, S-010.3.6]
    files: [src/core/next.ts, test/core/next.test.ts]
    verify: pnpm exec vitest run test/core/next.test.ts --reporter=verbose
    note: null
  - id: T-010.4
    title: next F-NNN prints the groups (red → green)
    status: done
    after: [T-010.3]
    covers: [S-010.4.1, S-010.4.2, S-010.4.3, S-010.4.4, S-010.4.5]
    files: [src/cli/commands/read.ts, test/cli/parallel.test.ts]
    verify: pnpm exec vitest run test/cli/parallel.test.ts -t S-010.4 --reporter=verbose
    note: null
  - id: T-010.5
    title: Skills, docs and full verification
    status: done
    after: [T-010.2, T-010.4]
    covers: []
    files: [plugin/skills/build/SKILL.md, plugin/skills/spec/SKILL.md, docs/concepts.md, docs/file-format.md, docs/cli.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-010: Plan

Test-first. T-010.1 starts once F-007's `verify` keys are committed in `src/core/config.ts`. It
adds the `parallel` section (`Config`, `DEFAULT_CONFIG`, `SHAPE`) with its parse tests, the
`Project.shared_files` field filled by `buildIndex`, the `status --json` tests in the new
`test/cli/parallel.test.ts`, and `"shared_files": []` in the Hookline golden index, which must
otherwise stay equal.

After it, the conflict rules (T-010.2: `validate.ts`, `derive.ts`) and the grouping (T-010.3:
`next.ts` and the new `test/core/next.test.ts`) touch separate files and can be built in
parallel. Both compile the globs with `globToRegExp` and match with `matchesAny` from `glob.ts`;
no new helper is needed. T-010.2's verify also reruns the existing conflict test, whose result
must not change. T-010.3 adds `TaskGroup`, `parallelGroups` and `taskGroups` to `next.ts`, which
keeps importing no Node modules; its S-010.3.5 and S-010.3.6 tests build an index from a written
project.

T-010.4 prints the groups in the `next` command (`read.ts`) and adds its CLI tests to
`test/cli/parallel.test.ts`, which T-010.1 created.

Other active features change some of the same files: F-007 (`config.ts`, `types.ts`), F-012
(`config.ts`, `types.ts`, `next.ts`, `analysis.test.ts`, the golden index) and F-013
(`docs/cli.md`). Their edits sit in other sections of those files; rebase on whichever lands
first.

T-010.5 updates the skills and docs:
- `plugin/skills/build/SKILL.md`, "Delegating to subagents": ready tasks may run in parallel when
  their `files` overlap only in files matching `parallel.shared_files`, and `azimuth next <F-ID>`
  prints which can run together. Each task adds one complete insertion to a shared file (a whole
  enum variant, match arm or registry entry) and never edits another task's insertion. The
  orchestrator commits a shared file with the tasks whose insertions it holds.
- `plugin/skills/spec/SKILL.md` §3.5: two tasks may list the same file only if one comes `after`
  the other, unless the file matches `parallel.shared_files`.
- `docs/concepts.md`: shared files, the file conflicts row, and how `next` groups ready tasks.
- `docs/file-format.md`: the `parallel` section in the config example and reference, and the
  `W-FILE-CONFLICT` sentence.
- `docs/cli.md`: the `next` row (groups, and `{items, groups}` with an ID and `--json`).

Then it runs everything.
