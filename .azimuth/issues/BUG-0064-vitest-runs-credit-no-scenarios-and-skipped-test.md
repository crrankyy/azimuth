---
id: BUG-0064
type: bug
title: Vitest runs credit no scenarios, and skipped tests could pass
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/core/junit.ts, plugin/skills/spec/SKILL.md]
found_by: SES-20261018-1825
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
In this repository, run a task whose verify command is `pnpm exec vitest run test/core/live.test.ts -t S-005.2`
(Vitest 5.0.5), via `azimuth verify T-005.3`.

## Expected
The six S-005.2.* scenarios it ran are recorded as passing.

## Actual
The run passes but records no scenarios, so F-005's done check shows "0 of 18". Run by
`azimuth verify` (not a terminal), Vitest's default reporter prints only the summary
("Test Files 1 passed"): no test file and no test name. Since BUG-0016 a passing run credits a
scenario only when the output names it or its test file, so Vitest projects can't reach done.
BUG-0016's test used invented output with file lines.

With `--reporter=verbose`, Vitest prints every test with its title, but also the skipped ones
(`↓ test/core/live.test.ts > … > S-005.2.3 …`), and any line naming a scenario ID counts as a pass:
a skipped test would pass its scenario.

## Status notes
- 2026-10-18T18:58:35Z · agent · in-progress → resolved: Fixed in 94d8d5b; F-005's verify runs then credited 18/18 scenarios from Vitest's verbose output
