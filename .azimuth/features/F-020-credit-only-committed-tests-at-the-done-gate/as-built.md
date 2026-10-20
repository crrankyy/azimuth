---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: src/core/build-index.ts, change: modify }
  - { path: src/core/derive.ts, change: modify }
  - { path: src/core/facts.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: src/core/git.ts, change: modify }
  - { path: src/core/trace.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: test/cli/trace.test.ts, change: modify }
  - { path: test/core/committed-tests.test.ts, change: create }
  - { path: test/core/git-trace.test.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: viewer/src/screens/Verification.test.tsx, change: create }
  - { path: viewer/src/screens/Verification.tsx, change: modify }
  - { path: viewer/src/screens/feature/StoriesTab.test.tsx, change: modify }
  - { path: viewer/src/screens/feature/StoriesTab.tsx, change: modify }
  - { path: viewer/src/screens/feature/feature.css, change: modify }
  - { path: viewer/src/screens/verification.css, change: modify }
deviations:
  - { path: docs/viewer.md, kind: unplanned-modify, reason: "The Stories tab and Verification paragraphs describe the new tag; adopted into T-020.7 with task finish --adopt" }
follow_ups: [BUG-0081, DEBT-0012]
---
# F-020: As built

## Summary
The analysis lists every changed path from one `git status` call and marks a test ref uncommitted when its scenario marker and name aren't in HEAD's copy of the file. `done.scenarios-passing` counts a scenario only when one of its passing tests is committed (a marked test when it has one), and names the files of the ones it leaves out. `azimuth trace` prints `(uncommitted)`, and the viewer tags the test in the Stories tab and the Verification matrix.

## Deviations
`docs/viewer.md` wasn't planned but describes the tag. After a screenshot showed the tag clipped in the Verification matrix, the test cell's name moved into its own span (1dc7001) and S-020.5.3/S-020.5.4 were corrected and reapproved.

## Follow-ups
BUG-0081: the viewer doesn't refresh when only a test file changes, so the tag appears at the next records or git change. DEBT-0012: two parsers for git status output.
