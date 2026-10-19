---
id: F-010
title: Let tasks share registry files
summary: A project-level list of shared files (parallel.shared_files) lets tasks that each add to the same registry file run in parallel without conflict warnings, and azimuth next F-NNN lists which ready tasks can run together.
status: approved
priority: P2
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:c9807d1e308375347310c656f740f76f96b27d49610b9c06e334cd766568f00e
approved_commit: 83e0a14
review_ack_at: null
---
# F-010: Let tasks share registry files

## Objective
Real code has registry files that nearly every task extends: an enum and its dispatch, a keymap,
a list of commands. Today the rule "parallel only when `files` don't overlap" serialises every
task that touches one, and `W-FILE-CONFLICT` fires for them so often that it gets ignored
(experience report §4.6 and §5.5: allowing additive overlap on six such files took a build from
three to seven tasks an hour). A new config key `parallel.shared_files` lists such files as globs.
Paths it matches are never file conflicts (`W-FILE-CONFLICT` and the index's
`derived.file_conflicts`), `azimuth next F-NNN` groups the ready tasks that can run together
because they share no other file (`Can run together: T-010.2, T-010.3 (shared: src/registry.ts)`),
the index carries the globs as `project.shared_files` for the viewer, and the build and spec skills
let tasks listing a shared file run in parallel, each adding one complete insertion to it.

## Out of scope
- A hunk-staging command (`azimuth stage`): committing a shared file with the tasks whose
  insertions it holds stays the orchestrator's job (decided by the user).
- Marking files per feature or per plan (`additive: true` in `plan.md` or `impact.md`): the list
  is project-level (decided by the user).
- Checking that edits to a shared file are additive, or that a task left the other tasks'
  insertions alone.
- Viewer changes. The Plan tab (`PlanTab.tsx`, `TaskDag.tsx`) shows no overlap or parallelism
  hint today, so it has nothing to skip; F-015's Agents panel will read `project.shared_files`.
  The viewer's existing "File conflict" flags read `derived.file_conflicts`, which this feature
  changes in core.
- A plan check for parallel tasks that list the same file: none exists (only the spec skill states
  the rule, and its text changes here). Adding one is a separate feature.
- Showing the groups anywhere but `azimuth next F-NNN`: `show --brief`, `status --brief`, the hooks
  and `next` without an ID are unchanged.
- `!` exclusions, directory entries and path normalisation in the shared list or task `files`.
- `azimuth init` writing the key.
- Verify staleness (F-006): a shared file a task lists still belongs to its run scope.

## Integration points
- `src/core/config.ts`: the `parallel` section with `shared_files` (type, default `[]`, reader
  `r.strings()`). F-007 is adding `verify` keys to this file; T-010.1 starts once that change is
  committed.
- `src/core/types.ts`: `Project.shared_files` in the index contract.
- `src/core/build-index.ts`: `buildIndex` copies `config.parallel.shared_files` into
  `index.project`; `status --json` and the server's index carry it.
- `src/core/validate.ts`: `conflictProblems` skips paths the shared globs match, compiled with
  `globToRegExp` and matched with `matchesAny` from `src/core/glob.ts`.
- `src/core/derive.ts`: `fileConflicts` skips the same paths, so `derived.file_conflicts` (read by
  the viewer's Features table, `FeatureHeader.tsx` and `ImpactTree.tsx`) agrees with
  `W-FILE-CONFLICT`.
- `src/core/next.ts`: `TaskGroup`, `parallelGroups` and `taskGroups` next to `readyTasks`, which
  gives the order.
- `src/cli/commands/read.ts`: the `next` command prints one line per group and, with an ID and
  `--json`, prints `{items, groups}`.
- `plugin/skills/build/SKILL.md` ("Delegating to subagents"), `plugin/skills/spec/SKILL.md` (§3.5),
  `docs/concepts.md`, `docs/file-format.md` and `docs/cli.md`.

## Invariants
- With `parallel.shared_files` empty (the default), `W-FILE-CONFLICT`, `derived.file_conflicts`
  and the item lines of `azimuth next` are unchanged; the Hookline golden index changes only by
  `project.shared_files: []`.
- Grouping never puts two tasks that list the same file outside the shared list in one group.
  Every ready task of an in-progress feature is in exactly one group, and groups and the tasks in
  them keep `next`'s order.
- `azimuth next` without an ID prints the same text and the same JSON array as before.
- `src/core/next.ts` and `src/core/glob.ts` import no Node modules, so the viewer can use them.
- Task `files`, impact entries and run files don't change format.

## Assumptions
- Globs are matched with `globToRegExp` against paths as written in `impact.md` and `plan.md`
  (repo-relative, the `tests.globs` syntax without `!`), so `*` doesn't cross `/`:
  `keymaps/*.toml` matches `keymaps/default.toml` but not `keymaps/vim/extra.toml`. Two entries
  name the same file only when their text is equal, as `W-FILE-CONFLICT` compares them today.
- The same list applies between features (`W-FILE-CONFLICT`, `file_conflicts`) and between the
  tasks of one feature (`next`): a registry file is extended additively by whoever touches it.
- Groups are built in `readyTasks` order: in-progress tasks first, then todo tasks, each in plan
  order. So the first group starts with the tasks already running and shows which todo tasks can
  join them. Each task joins the first group none of whose tasks lists one of its files outside
  the shared list, or starts a new group.
- A task without `files` gets a group of its own that no other task joins, since nothing says what
  it changes.
- A group's `shared` lists the shared files that at least two of its tasks list, sorted.
- `azimuth next F-NNN` prints the group lines only when the feature has two or more ready tasks: a
  group of two or more as `Can run together: <IDs>[ (shared: <paths>)]`, a group of one as
  `On its own: <ID>`. With `--json` it prints `{items, groups}`, where `items` is the array it
  printed before and `groups` is `[]` unless the feature is in progress. Nothing in the repository
  reads `next --json`.
- `azimuth init` keeps writing its current config; the default `[]` applies until a project sets
  the key.
