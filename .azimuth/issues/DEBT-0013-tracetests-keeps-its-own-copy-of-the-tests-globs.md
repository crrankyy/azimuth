---
id: DEBT-0013
type: debt
title: traceTests keeps its own copy of the tests.globs include/exclude rule
status: open
severity: low
likelihood: null
impact: null
links: [F-019]
files: [src/core/trace.ts, src/core/glob.ts]
found_by: SES-20261020-1730
created: 2026-10-20
resolved_at: null
---
## Problem
F-019 added `testFileMatcher(globs)` to `glob.ts` for the `tests.globs` rule (a `!` glob excludes). `traceTests` in `trace.ts` still compiles the same include and exclude lists itself, so the rule lives in two places.

## Proposed fix
Have `traceTests` use `testFileMatcher`. F-020 owned `trace.ts` while F-019 was built, so the switch was left for later.
