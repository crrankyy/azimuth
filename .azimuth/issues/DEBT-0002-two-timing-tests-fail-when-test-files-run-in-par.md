---
id: DEBT-0002
type: debt
title: Two timing tests fail when test files run in parallel
status: resolved
severity: medium
likelihood: null
impact: null
links: []
files: [vitest.config.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: 2026-10-18
---
## Problem
`test/core/scale.test.ts` (1.5 s rebuild budget) and the hook budget tests (500 ms) fail on this machine when vitest runs files in parallel, so `pnpm test` is unreliable.

## Proposed fix
Decided by the user on 2026-10-18. Run test files one at a time in `pnpm test` (about 52 s for the full suite).
