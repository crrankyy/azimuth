---
completed_at: 2026-10-18
files_changed:
  - { path: src/core/next.ts, change: modify }
  - { path: test/core/analysis.test.ts, change: modify }
deviations: []
follow_ups: []
---
# F-004: As built

## Summary
`nextForFeature` suggests `azimuth move <F-ID> draft` for an idea whose draft gate passes (its
spec files exist) and `/azimuth:spec <F-ID>` otherwise. `azimuth next`, the status brief and
`show --brief` all use it.

## Deviations
None.

## Follow-ups
None.
