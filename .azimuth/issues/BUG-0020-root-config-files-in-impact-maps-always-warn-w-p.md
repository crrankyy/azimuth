---
id: BUG-0020
type: bug
title: Root config files in impact maps always warn W-PATH
status: resolved
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/validate.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
A greenfield feature's impact.md lists `package.json` and `vitest.config.ts`.

## Expected
Repository-root files (project configuration) don't need a module.

## Actual
`W-PATH package.json is not under any module path in architecture.md` on almost every early feature.
