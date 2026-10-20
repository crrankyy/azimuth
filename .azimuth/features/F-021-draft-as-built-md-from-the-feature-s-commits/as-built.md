---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: src/cli/commands/as-built.ts, change: create }
  - { path: src/cli/main.ts, change: modify }
  - { path: src/core/as-built.ts, change: create }
  - { path: src/core/create.ts, change: modify }
  - { path: src/core/frontmatter.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: src/core/git.ts, change: modify }
  - { path: test/cli/as-built.test.ts, change: create }
  - { path: test/core/as-built-gate.test.ts, change: create }
  - { path: test/core/as-built.test.ts, change: create }
deviations:
  - { path: src/core/run-scope.ts, kind: planned-unchanged, reason: "F-019 had already exported repoPath for --adopt, so T-021.1 needed no change there" }
follow_ups: []
---
# F-021: As built

## Summary
`azimuth as-built F-NNN` reads every commit naming the feature or its parts (past `git.log_depth`), writes `files_changed` (a final delete wins, then a first create, else modify) and deviations from impact.md (`unplanned-<change>`, `planned-unchanged`) with empty reasons, and on a rerun keeps reasons, hand-written deviations, `follow_ups` and the body. `done.as-built` passes only when every deviation has a reason. The verify skill's step 4 uses it; this feature's own as-built was drafted with it.

## Deviations
`src/core/run-scope.ts` was planned for exporting `repoPath`, which F-019 did first. The contract's `filesChanged` comment was corrected to the rule S-021.1.2 pins (a path created then deleted is a delete) and reapproved.

## Follow-ups
None. Small things noted in notes.md: a rerun that changes nothing still prints "Wrote …".
