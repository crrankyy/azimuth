---
id: RISK-0002
type: risk
title: Worker memory grows with large response bodies
status: open
likelihood: med
severity: null
impact: medium
links: [F-007]
files: [src/worker/deliver.ts]
found_by: you
created: 2026-10-15
resolved_at: null
---
## Scenario
A receiver that answers with multi-megabyte bodies makes the worker buffer each body in full before it is truncated for the attempt log.

## Mitigation
Stream the response and stop reading after the 2048-byte excerpt.
