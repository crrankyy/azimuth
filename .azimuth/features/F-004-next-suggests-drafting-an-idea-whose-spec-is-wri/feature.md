---
id: F-004
title: Next suggests drafting an idea whose spec is written
summary: azimuth next and the brief suggest azimuth move <F-ID> draft once an idea's spec files exist, instead of telling the agent to write the spec again.
status: draft
priority: P2
size: S
mode: brownfield
milestone: null
depends_on: []
superseded_by: null
tags: []
created: 2026-10-18
updated: 2026-10-18
---
# F-004: Next suggests drafting an idea whose spec is written

## Objective
`azimuth next`, the status brief and `show --brief` suggest `azimuth move <F-ID> draft` once an
idea's spec files exist, instead of telling the agent to write the spec again.

## Out of scope
- Deferred features (resuming one stays a decision for the user).
- Other statuses' suggestions.

## Integration points
- `src/core/next.ts`: `nextForFeature`'s idea case, which `nextWork`, `statusBrief` and
  `showBrief` all use.

## Invariants
- An idea without spec files still gets `/azimuth:spec <F-ID>`.

## Assumptions
- The idea → draft gate (every spec file written) is the right signal; the content is judged
  by the approval gate later.
