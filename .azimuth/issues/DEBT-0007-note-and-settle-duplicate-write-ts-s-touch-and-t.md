---
id: DEBT-0007
type: debt
title: note and settle duplicate write.ts's touch() and transitions.ts's readOr
status: open
severity: low
likelihood: null
impact: null
links: [F-008]
files: [src/cli/commands/note.ts, src/cli/commands/settle.ts, src/core/settle.ts, src/core/notes.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
`src/cli/commands/note.ts` and `settle.ts` (F-008) build the session's `touched` list themselves,
because `touch()` in `src/cli/commands/write.ts` isn't exported; `readOr` in `src/core/settle.ts`
duplicates the private `readOr` in `src/core/transitions.ts`, and `readOptional` in
`src/core/notes.ts` is close to both.

## Proposed fix
Export `touch()` (or move it next to `recordInSession`) and share one optional-file reader.
