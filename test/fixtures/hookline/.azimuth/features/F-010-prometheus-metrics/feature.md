---
id: F-010
title: Prometheus metrics
summary: Expose delivery, attempt and queue-depth metrics in Prometheus format.
status: idea
priority: P2
size: null
mode: brownfield
milestone: M-03
depends_on: [F-007]
superseded_by: null
tags: [observability]
created: 2026-10-10
updated: 2026-10-10
approved_at: null
approved_by: null
approved_hash: null
approved_commit: null
review_ack_at: null
overrides: []
---
# F-010: Prometheus metrics

## Objective
Expose delivery, attempt and queue-depth metrics at `GET /metrics` in the Prometheus text format.

## Out of scope
- Dashboards and alert rules
