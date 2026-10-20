---
id: F-021
title: Draft as-built.md from the feature's commits
summary: azimuth as-built F-NNN writes files_changed and deviations from the commits whose Refs name the feature, keeping reasons already written, and the done gate requires a reason on every deviation.
status: approved
priority: P1
size: M
mode: brownfield
milestone: M-02
depends_on: []
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
approved_at: 2026-10-20
approved_by: agent
approved_hash: sha256:f4daf8fc8d49f02d3c3fb130ea54703c24bf13f000bc6db95e4634457063a99f
approved_commit: 7f7a8c2
review_ack_at: null
---
# F-021: Draft as-built.md from the feature's commits

## Objective
Close-out still costs about ten minutes per feature, most of it spent writing as-built.md by
hand: `git log --name-only` over the `Refs:` commits, a comparison with impact.md by eye, then
60 lines of YAML and prose (0.2 experience report §4.5 and §5.5). The review of the 0.3 plan
(finding 6) adds that a generated file must not make the done gate trivial: today
`done.as-built` passes as soon as the file exists.

- `azimuth as-built <F-ID>` writes the feature's as-built.md from git and impact.md:
  - `completed_at`: today (UTC).
  - `files_changed`: every path the feature's commits changed, outside `.azimuth/`, read with
    `git log --name-status --no-renames` over the whole history, past `git.log_depth`. Per
    path, the first change decides `create`, a final delete gives `delete`, anything else is
    `modify`.
  - `deviations`: each changed path that no create, modify or test row of impact.md plans, as
    `unplanned-create`, `unplanned-modify` or `unplanned-delete`, and each create, modify or test
    row that no commit changed, as `planned-unchanged`. Every reason starts empty.
  - A rerun keeps the reason already written for the same path and kind, the deviations written
    by hand with other kinds, the body and `follow_ups`. A new file takes its body from the
    as-built template.
  - It prints the file written, how many commits, files and deviations it found, and which
    deviations still need a reason.
- `done.as-built` passes only when as-built.md exists, parses, and every deviation has a
  non-blank reason. Its detail names each deviation without one.
- The verify skill's step 4 runs the command and has the agent write each reason, the Summary
  and the follow-ups. The CLI, file-format and concepts docs and the azimuth skill's CLI table
  describe it.

## Out of scope
- `azimuth close-out` (report §5.5's second half: verify, trace, `reconciled_at` and the docs
  commit in one command), and writing the Summary, the reasons or the follow-ups.
- Committing or staging as-built.md, and logging the command in the feature's log.
- Uncommitted work: only commits count, not the working tree.
- Change mismatches as deviations (a `create` row whose file the commits only modified, a
  `modify` row whose file they deleted): a planned path that changed is never a deviation.
- Checking at the done gate that as-built.md is current with HEAD, or that `files_changed`
  matches the commits.
- Validating deviation kinds or `files_changed` values in `azimuth check`.
- Viewer changes. The As-built tab keeps computing its own "planned, not changed" rows (create
  and modify only) beside the new `planned-unchanged` deviations, and shows `delete` as text.
- Changes to what `readCommits` returns, to the index's commits or to `git.log_depth`'s meaning
  elsewhere.

## Integration points
- `src/core/as-built.ts` (new): the pure `filesChanged`, `deviationsFor`, `asBuiltText` and
  `asBuiltMessage`, and `writeAsBuilt`, which loads the feature with `loadProject`
  (`model.ts`), reads its commits, and writes the file under the project lock with
  `withLock` and `writeFileAtomic` (`lock.ts`). The body of a new file comes from the
  `feature/as-built.md` template through `template` (`create.ts`, now exported: the project's
  copy, else the built-in one) and `fill` (`templates.ts`), split with `splitFrontmatter`; an
  existing file is read with `parseFrontmatter` (`frontmatter.ts`).
- `src/core/git.ts`: new `readFeatureCommits` and `CommitChanges`. The refs rule of
  `readCommits` (Refs trailer IDs, else the Conventional Commits scope) moves into a private
  `commitRefs` that both use; `readCommits` keeps its behaviour. Shared with F-020, which reads
  git status for the committed-test check: F-021 adds a function and changes no other.
- `src/core/run-scope.ts`: `repoPath` is exported; impact paths are normalised with it and
  matched with `inScope`, as `runScope` does for the done gate (F-006).
- `src/core/frontmatter.ts`: `inlineYaml` takes an optional `{ padded: true }` for the
  `{ path: …, change: … }` style of the template and the docs. Without it the output is unchanged.
- `src/core/gates.ts` (shared with F-018, F-020 and F-023): only the `done.as-built` check in
  `doneGate` changes, through a new private `asBuiltCheck(f)`. Its id and rule text stay.
- `src/cli/commands/as-built.ts` (new): the `as-built` command, registered in `COMMANDS` in
  `src/cli/main.ts` after `settle`, recording the feature in the session's `touched` with
  `recordInSession`, as `note.ts` and `settle.ts` do.
- Agent instructions and docs: `plugin/skills/verify/SKILL.md` (step 4),
  `plugin/skills/azimuth/SKILL.md` (CLI table), `docs/cli.md` (Change table and a paragraph),
  `docs/file-format.md` (the as-built section: change values, deviation kinds, reruns) and
  `docs/concepts.md` (the verifying → done gate row). `docs/cli.md`, `docs/file-format.md` and
  `docs/concepts.md` are shared with other 0.3 features; the concepts row is edited by F-018 and
  F-020 too.

## Invariants
- `azimuth as-built` writes only the feature's as-built.md (and, from the CLI, the session's
  `touched` list). It never stages, commits, logs or moves anything.
- A refusal writes nothing.
- Two runs on the same day with the same commits, impact.md and as-built.md write the same bytes;
  a second run straight after the first changes nothing.
- No reason is ever invented: a generated deviation starts with `""`, and a kept reason is the
  string that was there.
- A rerun keeps the body after the closing `---` byte for byte.
- No path under `.azimuth/` appears in `files_changed` or `deviations`.
- `git.log_depth` doesn't limit the commits as-built reads; the index, `readCommits` and every
  other gate check keep their behaviour.
- `done.as-built` keeps its id, rule text and place in the done gate, and still fails without a
  detail when as-built.md is missing. The other done checks don't change.
- `inlineYaml` without the new option returns what it returns today.

## Assumptions
- Statuses: the command takes a feature in `verifying` or `done`. `verifying` is close-out;
  `done` lets a project refresh or backfill a finished feature's record (the plan's ZenithMD
  comparison runs it on a done feature). Any other status is refused: before verifying, tasks
  are still being committed, and the draft would report planned rows as unchanged.
- `completed_at` is the UTC date of the run, except that a `done` feature whose as-built.md
  already has a `completed_at` keeps it.
- Outside a git repository the command is refused rather than writing a draft with no files, in
  which every planned row would read as unchanged. In a repository without commits the feature
  has no commits (`files_changed: []`).
- Which commits: every commit reachable from HEAD, oldest first (`git log --topo-order
  --reverse`, so commits made in the same second keep their order), with no `-n` limit. A commit
  is the feature's when one of its refs is the feature, or one of its stories, scenarios or tasks
  (`featureOf(ref) === F-ID`), by the rule the index and the done gate already use
  (`readCommits` and `commitsFor`): the Refs trailer's IDs, else the IDs in the subject's
  Conventional Commits scope. A Refs trailer that names another feature wins over the scope; a
  task ID no longer in plan.md still counts. To keep the output small, `git log` is pre-filtered
  with `--fixed-strings --grep=F-NNN --grep=-NNN.` before the exact rule is applied.
- Merge commits list no files (`git log`'s default), so changes count once, in the commits that
  made them.
- Changes: `A` → create, `D` → delete, `M` and `T` (type change) → modify. A rename shows as a
  delete of the old path and a create of the new one (`--no-renames`), so with impact.md naming
  only the new path, the old path is an `unplanned-delete`. Paths are repo-relative as git
  prints them with `core.quotepath=off`, so, as in F-006 and F-009, the project root is taken to
  be the repository root.
- Planned: a changed path is planned when it equals or lies under the path of a create, modify
  or test row (`repoPath` removes a leading `./` and a trailing `/`; `inScope` matches it), so a
  row naming a directory covers every file under it. A `read` row is never a deviation and
  plans no change: a changed file that only `read` rows name is `unplanned-<change>`. A create,
  modify or test row is `planned-unchanged` when no changed path equals it or lies under it; its
  deviation's path is the normalised row path, once per path. Rows under `.azimuth/` are ignored
  like the changed paths there.
- Order: `files_changed` sorted by path; the generated deviations sorted by path, then the kept
  deviations of other kinds in the order they had.
- Reruns: the four generated kinds are recomputed. A deviation of one of them that is generated
  again keeps the first non-blank reason found for its path and kind; one that no longer applies
  is dropped with its reason. Deviations of any other kind (`clarification`, `test-change` and
  the like, written by hand) are kept as written. `follow_ups` is kept when it is a list (else
  `[]`), the body is kept, and any other frontmatter key is dropped: the format has only four.
  An existing file whose frontmatter isn't valid YAML is refused.
- Format: the frontmatter is written whole, one flow mapping per list item in the template's
  style (`  - { path: src/a.ts, change: create }`, `inlineYaml(item, { padded: true })`), `[]`
  for an empty list, `follow_ups` as `inlineYaml(list)` and an empty reason as `reason: ""`. A
  rerun keeps the file's BOM and line ending; a new file uses LF.
- A new file's body is the `feature/as-built.md` template filled with the feature's ID and the
  date, without its frontmatter: the project's copy when `.azimuth/templates/` holds one, as
  `azimuth new` does.
- The gate counts a reason as missing when it is blank after trimming, for every deviation,
  whatever its kind. An as-built.md that exists but doesn't parse (the model has no `asBuilt`)
  fails with a detail pointing to `azimuth check`, since its deviations can't be read.
- The CLI's exit codes follow `note` and `settle`: 0 written, 1 refused (unknown feature, status,
  no git, invalid frontmatter, git log failed), 2 usage (missing or non-feature ID, no project).
- The as-built output is one line, plus a second naming the deviations without a reason when
  there are any (exact text in contract.md). `--json` prints the result object.
- F-021's own stories write as-built YAML inside backticks on one line; the exact multi-line file
  is the example in contract.md.
