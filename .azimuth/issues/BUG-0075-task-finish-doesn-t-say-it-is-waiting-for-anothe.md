---
id: BUG-0075
type: bug
title: task finish doesn't say it is waiting for another verify
status: resolved
severity: low
likelihood: null
impact: null
links: [F-009]
files: [src/core/finish.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: 2026-10-19
---
## Repro
Run `azimuth task finish` while another `azimuth verify` holds the verify lock.

## Expected
It says it is waiting, as `azimuth verify` prints "waited Ns for another verify".

## Actual
`finishTask` (`src/core/finish.ts`) calls `verifyBatch` without `onProgress`, so it waits
silently; the build skill's "waited 40s" line was removed with F-009's docs.
