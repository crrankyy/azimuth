---
tasks:
  - id: T-028.1
    title: Milestones read tag and released_commit (red → green)
    status: done
    after: []
    covers: [S-028.2.1, S-028.2.2, S-028.2.3, S-028.2.4]
    files: [src/core/types.ts, src/core/parse/records.ts, test/fixtures/hookline/expected-index.ts, test/core/parse.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/parse.test.ts -t "S-028.2" --reporter=verbose
    note: null
  - id: T-028.2
    title: Release a milestone in the core (red → green)
    status: done
    after: [T-028.1]
    covers: [S-028.3.1, S-028.3.2, S-028.3.3, S-028.3.4, S-028.3.5, S-028.4.1, S-028.4.2, S-028.4.3, S-028.4.4, S-028.4.5, S-028.4.6, S-028.4.7]
    files: [src/core/release.ts, src/core/git.ts, src/core/transitions.ts, test/core/release.test.ts]
    verify: pnpm exec vitest run test/core/release.test.ts -t "S-028.[34]" --reporter=verbose
    note: null
  - id: T-028.3
    title: azimuth release (red → green)
    status: done
    after: [T-028.2]
    covers: [S-028.5.1, S-028.5.2, S-028.5.3, S-028.5.4, S-028.5.5]
    files: [src/cli/commands/write.ts, src/cli/main.ts, test/cli/release.test.ts]
    verify: pnpm exec vitest run test/cli/release.test.ts -t "S-028.5" --reporter=verbose
    note: null
  - id: T-028.4
    title: The viewer releases a finished planned milestone (red → green)
    status: done
    after: [T-028.2]
    covers: [S-028.6.1, S-028.6.2, S-028.6.3, S-028.6.4, S-028.6.5, S-028.6.6, S-028.6.7, S-028.6.8]
    files: [src/server/actions.ts, viewer/src/screens/roadmap/release.ts, viewer/src/screens/roadmap/Timeline.tsx, viewer/src/screens/roadmap/release.test.ts, viewer/src/screens/roadmap/Timeline.test.tsx, test/server/release-action.test.ts]
    verify: pnpm exec vitest run test/server/release-action.test.ts viewer/src/screens/roadmap/release.test.ts viewer/src/screens/roadmap/Timeline.test.tsx -t "S-028.6" --reporter=verbose
    note: null
  - id: T-028.5
    title: The milestone page shows the release and its commits (red → green)
    status: done
    after: [T-028.1]
    covers: [S-028.7.1, S-028.7.2, S-028.7.3, S-028.7.4]
    files: [src/core/milestone-page.ts, test/core/release-page.test.ts, test/core/milestone-page.test.ts]
    verify: pnpm exec vitest run test/core/release-page.test.ts -t "S-028.7" --reporter=verbose
    note: null
  - id: T-028.6
    title: The Roadmap rows show the release and the commits (red → green)
    status: done
    after: [T-028.4]
    covers: [S-028.7.5, S-028.7.6, S-028.7.7]
    files: [viewer/src/screens/roadmap/release.ts, viewer/src/screens/roadmap/Timeline.tsx, viewer/src/screens/roadmap/roadmap.css, viewer/src/screens/roadmap/release.test.ts, viewer/src/screens/roadmap/Timeline.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/roadmap/release.test.ts viewer/src/screens/roadmap/Timeline.test.tsx -t "S-028.7" --reporter=verbose
    note: null
  - id: T-028.7
    title: Refs may name any item, in the protocol and conventions (red → green)
    status: done
    after: []
    covers: [S-028.1.1, S-028.1.2, S-028.1.3, S-028.1.4, S-028.1.5, S-028.1.6]
    files: [src/core/protocol.ts, src/core/init.ts, test/core/refs.test.ts, test/core/task-brief.test.ts, test/cli/milestone.test.ts]
    verify: pnpm exec vitest run test/core/refs.test.ts -t "S-028.1" --reporter=verbose
    note: null
  - id: T-028.8
    title: Docs, skills and full verification
    status: done
    after: [T-028.3, T-028.5, T-028.6, T-028.7]
    covers: []
    files: [docs/cli.md, docs/concepts.md, docs/file-format.md, docs/viewer.md, plugin/skills/azimuth/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-028: Plan

Test-first. T-028.1 adds the fields; then three lanes run together: the core release (T-028.2,
then the CLI in T-028.3 and the viewer in T-028.4, then the Roadmap rows in T-028.6), the
milestone page (T-028.5) and the Refs slice (T-028.7, independent). T-028.4 and T-028.6 share the
Roadmap files, so T-028.6 comes after T-028.4. T-028.8 changes the docs and skills, then runs
everything.

Notes for builders:

- T-028.1: `Milestone` gains `tag: string | null` and `released_commit: Sha | null` after
  `released_at` (contract.md). `parseMilestone` reads both with `opt(ctx, key,
  r.nullable(r.text()), null)` and adds them to `unknownKeys`. In `expected-index.ts`, add
  `"tag": null` and `"released_commit": null` after `"released_at"` on M-01, M-02 and M-03. Fix
  any other place the typecheck shows building a `Milestone` literal. Tests extend
  `test/core/parse.test.ts`. The golden index test (`test/golden/index.test.ts`) must pass
  unchanged.
- T-028.2: `src/core/release.ts` follows `moveMilestone` (`transitions.ts`): validate outside
  the lock, then `withLock`, `analyzeProject(root, now)`, find the milestone in `model.milestones`,
  `checkExpected` (export it from transitions.ts; its body doesn't change), then the release and
  feature checks. Features: `model.features` with `milestone === id`, minus `RETIRED_STATUSES`
  (`derive.ts`), in model order; list each not done as `<F-ID> (<status>)`. HEAD is
  `facts.git.head`; with a tag, `tagCommit(root, tag)` when `facts.git.available`. Write with
  `updateFrontmatter(text, { status, released_at, tag, released_commit })` and
  `writeFileAtomic`; `changed` is the repo-relative file. `tagCommit` in `git.ts` uses the
  module's `git()` helper: `git(root, ["rev-parse", "--verify", "--quiet", "--short=7",
  `refs/tags/${tag}^{commit}`])?.trim() || null`. Tests in the new `test/core/release.test.ts`
  copy `repo()` and `errorOf()` from `test/core/transitions.test.ts`; S-028.3.1 tags with
  `git(root, ["tag", "v0.3.1"])` from `test/helpers/git.ts`. A SHA of digits only is written
  quoted by `inlineYaml`, so compare the file with the SHA as `inlineYaml(sha)` writes it.
  S-028.3.4 uses `writeTree` without `initRepo`. "Unchanged" means byte for byte: read the file
  before and after.
- T-028.3: in `write.ts`, `export const release: Command` after `move`, usage
  `release <M-ID> [--tag <name>] [--json]`, summary from contract.md, options `tag` (string) and
  `json` (boolean). Call `releaseMilestone(rt.root, id, { actor: rt.actor, session: rt.session,
  tag })`, then `touch(rt, id)`, then `report(rt, result, result.message)`. When
  `result.tag_found === false` and not `--json`, write the hint line to stderr after stdout.
  Register `release: write.release` in `main.ts` right after `move`. Tests in the new
  `test/cli/release.test.ts` with `runCli` (pass `{ AZIMUTH_ACTOR: "you" }`), `writeTree`,
  `initRepo` and `commitAll`.
- T-028.4: `actions.ts` gains `case "release"` (contract.md). `roadmap/release.ts` imports
  `milestoneReady` from `src/core/flows.ts` and `plural`/`shortDate` from `viewer/src/lib/format`.
  In `Timeline.tsx`, `MilestoneLane` renders `ReleaseControl` when `releaseOffer(m)` isn't null;
  `ReleaseControl` takes the offer (enabled, why) instead of computing `notDone`, sends
  `releaseRequest(m)` through `run`, and puts `releaseLead(m)` in a paragraph before the dialog's
  text, which gains "and the current commit". Tests: `release.test.ts` calls the functions on
  milestones built from the fixture index; `Timeline.test.tsx` renders
  `<UiProvider><IndexContext.Provider value={…}><Screen route={parseRoute("#/roadmap")} />`
  as `viewer/src/screens/issues/IssuePage.test.tsx` does (NOW 2026-10-18T12:00:00Z, `live`),
  and cuts each lane's markup at the next `rm-lane` to look inside it.
  `test/server/release-action.test.ts` calls `runAction` directly on a temp git project.
- T-028.5: in F-026's `src/core/milestone-page.ts` (no Node imports), `milestonePage` fills
  `commits` with `index.commits.filter((c) => c.refs.includes(id))`; `releaseSection` and
  `commitsSection` go after `readinessSection` in `SECTIONS` (contract.md). Change nothing else
  in the module. Tests in the new `test/core/release-page.test.ts` call `milestonePage` and
  `formatMilestonePage` on a clone of `expectedIndex` and split the text on `"\n\n"`.
- T-028.6: `milestoneCommits` and `releasedLabel` go in `roadmap/release.ts`. `dateLine` returns
  `releasedLabel(m)` for a released milestone. The expanded lane's label lists the commits under
  the progress row, then the Release control; rows are
  `<span className="rm-commit" title={c.subject}><span className="az-mono">{c.sha}</span> {c.subject}</span>`,
  then `<span className="rm-commit-more">and {n} more</span>`. `roadmap.css` gives the rows one
  line each with an ellipsis, in the lane label's muted text style.
- T-028.7: the `PROTOCOL` text changes in two places only (S-028.1.4 gives both exactly); the
  `CLAUDE_BLOCK` and `AGENTS_BLOCK` don't change. In `init.ts`, the conventions template's
  Commits line (S-028.1.6). S-028.1.1 to S-028.1.3 test today's `commitRefs` through
  `buildIndex`; they need no source change. Tests in the new `test/core/refs.test.ts`;
  S-028.1.5 and S-028.1.6 call `initProject` on a `writeTree` folder.
- T-028.8 (wording; prettier realigns the tables):
  - `docs/cli.md`, Change table: a row `azimuth release <M-ID> [--tag <name>] [--json]`: "Releases
    a planned or active milestone whose features are all done (cancelled and superseded ones
    don't count). You only. Records `released_at`, the tag and the commit (below)." After the
    table, a paragraph: a planned milestone passes through active in the same write;
    `released_commit` is the tag's commit when git has the tag, else HEAD; Azimuth never creates
    or pushes the tag, and prints `git tag <name> <sha>` to run when the tag doesn't exist yet;
    `azimuth move M-NN released` remains, without the feature check and without recording a
    commit. Add the example output of S-028.5.2.
  - `docs/concepts.md`: the "Only you release a milestone" paragraph says how (the Roadmap's
    Release…, on a planned or active milestone whose features are all done, or
    `azimuth release`), and that both record the date and the commit. The "Task → commit" bullet
    becomes "Commit → item": a `Refs:` trailer may name any item. A task, story, scenario or
    feature links the commit to the feature (Activity tab, as-built, the done gate's staleness);
    an issue to the Issue page's Commits and History; a milestone to `azimuth show M-NN` and its
    Roadmap row; any other ID shows as a chip in Activity. Keep the scope fallback sentence.
  - `docs/file-format.md`, Milestones: the YAML block gains `tag: v0.3.1 # written at release`
    and `released_commit: abc1234 # written at release`; a paragraph says `azimuth release`
    and the viewer's Release write both (null without a tag or outside git), the template
    doesn't hold them, and a 0.3.0 reader warns `W-UNKNOWN-KEY` on them.
  - `docs/viewer.md`: the Roadmap row adds "each milestone's release (tag and commit) and the
    commits naming it"; the Release row becomes "Releases a planned or active milestone whose
    features are all done (an active one shows it disabled until then); records the date and the
    current commit."
  - `plugin/skills/azimuth/SKILL.md`: the Commit bullet becomes "a `Refs:` trailer naming the
    task or feature (`Refs: T-005.2`), or the milestone or issue a commit is about
    (`Refs: M-04`, `Refs: BUG-0010`)"; the Only-the-user bullet adds "releases milestones (in the
    viewer or with `azimuth release`)".

Close-out: resolve BUG-0084 with a commit naming it (`Refs: BUG-0084`). The as-built's
follow-ups say that PROTOCOL.md changed, so every project, this one included, runs
`azimuth init --refresh`.

Files shared with other 0.3.1 features (merge by hunk; F-028 changes only its own parts):

- F-026: `src/core/transitions.ts` (F-026 changes the feature move path; F-028 only exports
  `checkExpected`) and `src/core/milestone-page.ts` (F-026 creates it; F-028 adds one field and
  two sections).
- F-025: `src/cli/main.ts` (F-025 registers `runs`; F-028 registers `release`).
- Every 0.3.1 feature: `docs/cli.md`, `docs/concepts.md`, `docs/file-format.md`,
  `docs/viewer.md` and the skills (F-028 changes only the rows and paragraphs named above).
