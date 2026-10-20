---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/spec/SKILL.md, change: modify }
  - { path: src/core/derive.ts, change: modify }
  - { path: src/core/flows.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: src/core/init.ts, change: modify }
  - { path: src/core/next.ts, change: modify }
  - { path: src/core/parse/stories.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/validate.ts, change: modify }
  - { path: test/cli/check.test.ts, change: modify }
  - { path: test/cli/milestone.test.ts, change: create }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/core/check-hints.test.ts, change: create }
  - { path: test/core/measured.test.ts, change: create }
  - { path: test/core/milestone-ready.test.ts, change: create }
  - { path: test/core/strict-hints.test.ts, change: create }
  - { path: test/golden/index.test.ts, change: modify }
deviations:
  - { path: src/core/flows.ts, kind: unplanned-modify, reason: "milestoneReady moved here from derive.ts so next.ts, which the viewer can use, stays free of Node imports" }
follow_ups: []
---
# F-023: As built

## Summary
`check` applies W-NO-NEGATIVE to an idea that has stories, and in drafts hints W-MEASURED (an offset or range in a THEN or AND line) and W-NO-COVERS (a task covering no scenario, unless it lists only Markdown). Hints (`HINT_CODES`) don't count toward strict approval. W-MILESTONE-READY flags a planned or active milestone whose features are all done, and `azimuth next` asks the agent to have the user release it.

## Deviations
`milestoneReady` lives in `src/core/flows.ts`, not `derive.ts` as the contract said (bd1e2c3), because `derive.ts` pulls in `node:crypto`.

## Follow-ups
None.
