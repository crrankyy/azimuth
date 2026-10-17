---
id: DEBT-0001
type: debt
title: Delivery worker logs unstructured strings
status: open
severity: medium
likelihood: null
impact: null
links: [F-007, F-010]
files: [src/worker/deliver.ts]
found_by: SES-20261017-1430
created: 2026-10-17
resolved_at: null
---
## Problem
The worker logs with template strings, so attempts can't be correlated by delivery ID.

## Proposed fix
Switch to pino with `deliveryId` and `attempt` fields before F-010 adds metrics.
