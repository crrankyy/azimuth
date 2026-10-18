---
completed_at: 2026-10-18
files_changed:
  - { path: src/core/derive.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/core/git-trace.test.ts, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: docs/concepts.md, change: modify }
deviations: []
follow_ups: []
---
# F-002: As built

## Summary
`isCodeCommit` and `codeChangedSince` (in `src/core/derive.ts`) tell code commits from commits
that only change `.azimuth/`, using the changed-file lists the git facts already held; a commit
with unknown files counts as code. The done gate's verify check accepts a run followed only by
record commits, and its architecture check compares `reconciled_at` with the feature's last code
commit. The verify skill is back to verify → as-built → reconcile → one close-out commit → done,
and this feature was closed out that way.

## Deviations
None. `test/golden/index.test.ts` was listed as affected; it passes unchanged, so the sample
project's gates are the same as before.

## Follow-ups
None.
