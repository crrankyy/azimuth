---
id: BUG-0028
type: bug
title: Stale-architecture warning counts Azimuth's own record commits
status: resolved
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/validate.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
Reconcile `architecture.md`, then make 10 commits that only change `.azimuth/` (as-built, recorded decisions, session records).

## Expected
No W-ARCH-STALE: no code changed since the reconciliation.

## Actual
W-ARCH-STALE fires, because every commit counts. Each feature makes several record commits, so the warning fires long before the architecture can be out of date.

Decided by the user on 2026-10-18. Count only code commits, as the done check does since F-002, and update the reference test built from the spec's sample data to match.

## Status notes
- 2026-10-18T16:23:58Z · agent · in-progress → resolved: Fixed in a948fb7
