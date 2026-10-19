---
id: DEBT-0004
type: debt
title: pidAlive in lock.ts duplicates processAlive in live.ts
status: open
severity: low
likelihood: null
impact: null
links: [F-007]
files: [src/core/lock.ts, src/core/live.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
`acquireVerifyLock` (F-007) needs to know whether a lock holder's pid is alive, and `lock.ts` got
its own `pidAlive` for it. `src/core/live.ts` already exports `processAlive`, but importing it
into `lock.ts` would create a cycle, since `live.ts` imports from `lock.ts`.

## Proposed fix
Move the pid check into a small module both can import (for example `src/core/process.ts`) and
use it in both places.
