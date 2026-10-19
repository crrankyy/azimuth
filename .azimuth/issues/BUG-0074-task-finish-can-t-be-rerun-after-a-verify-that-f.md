---
id: BUG-0074
type: bug
title: task finish can't be rerun after a verify that failed for reasons outside the task
status: open
severity: medium
likelihood: null
impact: null
links: [F-009]
files: [src/core/finish.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
1. `azimuth task finish T-009.6 --commit "…"` while another lane's files fail `format:check`.
2. The commit lands and the verify fails for a reason outside the task; the task stays in-progress.
3. Fix the outside cause and run the same `azimuth task finish T-009.6 --commit "…"` again.

## Expected
It skips the commit (the task's files are already committed), verifies again and moves the task
to done.

## Actual
The stage step finds nothing to commit and stops with "Nothing to commit", so the task needs a
manual `azimuth verify` and `azimuth move` (T-009.6 on 2026-10-20).
