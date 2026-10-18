---
id: BUG-0029
type: bug
title: Marked tests with the same function name can count for the wrong scenario
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/validate.ts, src/core/junit.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Mark `fn parses_empty()` in `src/buffer.rs` with `// scenario: S-001.1.1` and another `fn parses_empty()` in `src/render.rs` with `// scenario: S-001.2.1`.

## Expected
`azimuth check` warns that two marked tests share a name, so the agent renames one before verify runs.

## Actual
Nothing warns. Since BUG-0025, verify matches marked tests by function name without the module path, so one test's result can count for the other's scenario.

Decided by the user on 2026-10-18. Warn in `azimuth check`.
