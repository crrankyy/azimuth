---
id: DEBT-0012
type: debt
title: Two parsers for git status porcelain output
status: open
severity: low
likelihood: null
impact: null
links: [F-019, F-020]
files: [src/core/git.ts, src/core/finish.ts]
found_by: SES-20261020-1730
created: 2026-10-20
resolved_at: null
---
## Problem
`git.ts` (`parseStatus`, F-020) and `finish.ts` (`porcelainPaths`, F-009) both parse `git status --porcelain=v1 -z`. They differ on purpose in one way: finish keeps a rename's source path (it must stage the deletion), the git facts skip it and also track XY for `dirty`.

## Proposed fix
One parser in `git.ts` that returns entries `{ xy, path, source }`, with `finish.ts` and `gitFacts` each taking what they need.
