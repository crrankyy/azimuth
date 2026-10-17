---
id: RISK-0001
type: risk
title: SQLite write contention above ~200 deliveries/s
status: open
severity: null
likelihood: medium
impact: high
links: [ADR-0001]
files: [src/store/db.ts]
found_by: you
created: 2026-10-15
resolved_at: null
---
## Scenario
A burst of events makes worker and API writes queue behind the single SQLite writer, and delivery latency climbs.

## Mitigation
Batch attempt writes. Benchmark at 300/s before M-02 ships.
