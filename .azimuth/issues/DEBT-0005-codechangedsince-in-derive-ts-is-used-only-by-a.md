---
id: DEBT-0005
type: debt
title: codeChangedSince in derive.ts is used only by a test since path-scoped staleness
status: open
severity: low
likelihood: null
impact: null
links: [F-006]
files: [src/core/derive.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
Since F-006, the done gate decides staleness with `staleCause` and `runScope`; `codeChangedSince`
in `src/core/derive.ts` is now called only by F-002's unit test.

## Proposed fix
Remove `codeChangedSince` and move its test's cases onto `staleCause`, or give it a caller again.
