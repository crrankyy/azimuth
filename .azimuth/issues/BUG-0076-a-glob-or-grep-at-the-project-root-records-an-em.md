---
id: BUG-0076
type: bug
title: A Glob or Grep at the project root records an empty file path
status: open
severity: low
likelihood: null
impact: null
links: [F-014]
files: [src/hooks/handlers.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
Let an agent run Glob or Grep with `path` set to the project root.

## Expected
The live record's `file` is null, as for tools without a file.

## Actual
`describeTool` (`src/hooks/handlers.ts`) turns any string `path` into a project-relative `file`,
so the project root becomes `""` (seen in the 2026-10-20 smoke test). This predates F-014; the
Agents tab could show an empty file name.
