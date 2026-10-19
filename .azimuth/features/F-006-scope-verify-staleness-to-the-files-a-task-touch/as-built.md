---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/config.ts, change: modify }
  - { path: src/core/run-scope.ts, change: create }
  - { path: src/core/derive.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: test/helpers/project.ts, change: modify }
  - { path: test/core/parse.test.ts, change: modify }
  - { path: test/core/run-scope.test.ts, change: create }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/core/git-trace.test.ts, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
deviations:
  - { path: src/core/derive.ts, kind: unused-code, reason: "codeChangedSince is kept, but the done gate no longer calls it (staleRun in gates.ts uses runScope and staleCause); only F-002's unit test in test/core/analysis.test.ts still does" }
follow_ups: [DEBT-0005]
---
# F-006: As built

## Summary
A task's verify run stays current until a later code commit touches a path in its scope.
`runScope` (new `src/core/run-scope.ts`) builds the scope from the task's `files`, the feature's
create, modify and test impact paths, the paths of the modules that the feature's own modules
depend on (directly), and the globs of the new `verify.shared_paths` key, which defaults to the
root build manifests (`package.json`, `pnpm-lock.yaml`, `Cargo.toml`, `Cargo.lock`, `go.mod`,
`go.sum`, `pyproject.toml`, `uv.lock`). `staleCause` in `derive.ts` walks the commits after the
run, oldest first, and returns the first one that changed a path in scope outside `.azimuth/`,
or whose changed files aren't known. The done gate's `done.verify-passed` detail names it:
`T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts`. A task with no paths of its
own keeps the old rule (any code commit makes its run stale). `runCurrent` is gone and
`sameCommit` is exported.

The real-git test reproduces issue #1 through `buildIndex` and `showBrief`: another feature's
commit leaves F-001's run current, and a commit to F-001's own file names that commit and path.
The verify skill's close-out reruns only the runs the done gate names, and `docs/concepts.md` and
`docs/file-format.md` describe the rule and the key. The Hookline golden index needed no change.

## Deviations
- `codeChangedSince` stays in `src/core/derive.ts`, although the done gate no longer uses it.
  Only F-002's unit test still calls it.

Otherwise the files match `impact.md`.

## Follow-ups
- DEBT-0005: `codeChangedSince` is used only by a test; remove it or give it a caller again.
