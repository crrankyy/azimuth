---
id: BUG-0016
type: bug
title: A passing verify run that ran no tests marks scenarios passing
status: open
severity: high
likelihood: null
impact: null
links: []
files: [src/core/junit.ts, src/core/verify.ts, plugin/skills/spec/SKILL.md]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
1. A plan task "Red tests for count" covers 8 scenarios with `verify: pnpm typecheck`.
2. `azimuth verify` that task (exit 0; output is only `tsc --noEmit`).

## Expected
Scenarios are only marked passing by a run that shows evidence of running their tests.

## Actual
All 8 scenarios are marked passing (coverage showed 8/29 while those tests failed): without a JUnit report a passing exit code passes every covered scenario. The spec skill's "red tests then implementation" wording leads agents to write such tasks.
