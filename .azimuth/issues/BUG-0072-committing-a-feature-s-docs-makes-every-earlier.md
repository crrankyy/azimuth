---
id: BUG-0072
type: bug
title: Committing a feature's docs makes every earlier task run of the feature stale
status: open
severity: medium
likelihood: null
impact: null
links: [F-006]
files: [src/core/run-scope.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
1. Build a feature's code tasks and verify them.
2. Commit its last task, which changes docs the feature's impact.md lists (docs/cli.md).

## Expected
The code tasks' runs stay current: the docs don't change what their tests check.

## Actual
F-006's run scope includes every create/modify/test path in the feature's impact, so the docs
commit makes every earlier task run stale, and close-out reruns them all (seen for F-006, F-007,
F-008, F-010, F-012, F-013 and F-017 on 2026-10-20). `docs/cli.md` is bundled into the CLI, so
excluding all Markdown would be wrong; scoping each task to impact paths that no later task of the
same feature owns is one option.
