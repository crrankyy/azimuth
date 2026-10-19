---
id: F-006
title: Scope verify staleness to the files a task touches
summary: A task's verify run stays current until a later commit touches the task's files, the feature's impact, a module it depends on or a shared manifest, instead of going stale on any code commit.
status: done
priority: P1
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
approved_hash: sha256:19970e781903430a1ea4f18ad728eab9e8f1f92e190e4867a9f8336865f05306
approved_commit: db672ab
review_ack_at: 2026-10-19T20:29:05Z
---
# F-006: Scope verify staleness to the files a task touches

## Objective
A task's verify run stays current until a later code commit touches a path the run depends on:
the task's `files`, the feature's impact paths (create, modify or test), the paths of the
modules that the feature's modules depend on, or a shared file from `verify.shared_paths`
(root build manifests by default). Today any code commit makes every run stale, so parallel
lanes on different features invalidate each other's runs and close-out reruns every verify
(issue #1; experience report §4.1 and §5.1). When a run is stale, the done gate names the commit
and the path that made it so: `T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts`.

## Out of scope
- Renames: `git log --name-only` lists only a renamed file's new path (checked with git 2.53 on
  2026-10-20), so moving a file out of a task's scope with no other change keeps the run current.
- Other files of the feature's own modules that neither the task nor `impact.md` lists, and
  transitive module dependencies (the dependencies of a dependency).
- Uncommitted changes in the working tree (the gate ignores them, as before).
- Showing staleness anywhere but the `done.verify-passed` check: run files, `azimuth verify`
  output, task rows and the viewer are unchanged.
- `!` exclusions in `verify.shared_paths`.
- The order in which commits count as "after" a run: it stays the `git log` order the index reads.

## Integration points
- `src/core/config.ts`: the `verify.shared_paths` key (type, default, reader).
- `src/core/run-scope.ts` (new): `runScope` and `inScope`, which build a task's scope from its
  `files` (`parsePlan`), the feature's impact entries (`parseImpact`) and the architecture's
  modules (`parseArchitecture` in `src/core/parse/knowledge.ts`, `model.knowledge.architecture`),
  reusing `globToRegExp`, `matchesAny` and `inModule` from `src/core/glob.ts`.
- `src/core/derive.ts`: `staleCause` next to `codeChangedSince`, walking the commits after a run
  in `facts.git.commits` with their files from `facts.git.files`; `sameCommit` is exported.
- `src/core/gates.ts`: `doneGate` replaces `runCurrent` with `runScope` + `staleCause` and writes
  the new detail. `move F done`, `show F --brief` (`showBrief`), `next` and the index's
  `next_gate` read that check unchanged.
- `plugin/skills/verify/SKILL.md`: close-out reruns only the runs the done gate names.
- `docs/concepts.md` (done gate) and `docs/file-format.md` (the config key).

## Invariants
- The done gate's check IDs, order and rule texts don't change; a failed run still takes
  precedence over stale ones in the detail, and the Hookline golden index is unchanged.
- A run at HEAD is current. A commit that only changes `.azimuth/` never makes a run stale, and
  paths under `.azimuth/` never count, even when a scope or a shared glob would match them.
- When the gate can't tell, the run is stale: a later commit whose changed files aren't known, a
  run commit outside the history the index read, or a run at an uncommitted tree.
- A task without `files` in a feature without create, modify or test impact entries keeps
  today's rule: any later code commit makes its run stale.
- Run files and the index contract don't change (no new run or index fields).

## Assumptions
- "The feature's modules" are the architecture modules containing its impact entries with change
  create or modify. Test and read entries add no modules: `W-PATH` ignores test paths too, and a
  test module (here `tests`, which depends on core, cli, hooks and server) would pull in almost
  every path. Dependencies are direct (`depends_on` names); unknown names are ignored.
- Module paths match with `inModule` (the path, anything under it, or a file named after it), as
  `W-PATH` does. Task and impact paths match exactly or as a directory (`p/…`), after removing a
  leading `./` and trailing `/`; no filesystem check is needed to tell a directory.
- Paths compare as `git log --name-only` prints them, relative to the repository root. Like
  `isCodeCommit`, this assumes the project root is the repository root.
- Module dependencies and shared paths alone don't make a scope: without paths of its own, a
  task falls back to today's rule.
- When several commits touch the scope, the detail names the earliest one after the run and its
  first matching path in git's order. A run commit outside the history read keeps today's detail
  (`T-x last passed at <sha>`), since there is no commit or path to name.
- `verify.shared_paths` replaces the default list rather than adding to it; an empty list turns
  shared paths off. `azimuth init` keeps writing its current `verify` section; the default
  applies until a project sets the key.
- The details of S-002.1.2 and S-002.1.3 (F-002) change to the new format; their tests are
  updated with the gate, since the detail is what this feature changes.
