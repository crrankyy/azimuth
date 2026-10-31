---
id: BUG-0084
type: bug
title: "The viewer can't release a planned milestone: Release… only shows on active ones"
status: resolved
severity: medium
likelihood: null
impact: null
links: [M-02, F-023]
files: [viewer/src/screens/roadmap/Timeline.tsx, src/core/next.ts, src/core/validate.ts]
found_by: SES-20261020-2303
created: 2026-10-20
resolved_at: 2026-10-31
---
## Repro
Finish every feature of a `planned` milestone (M-02 for 0.3.0), then open the Roadmap to release it, as `azimuth next` ("Ask the user to release M-02 in the viewer") and W-MILESTONE-READY tell the agent to ask.

## Expected
A Release… control on the finished milestone, or a way to make it active first.

## Actual
`Timeline.tsx` renders `ReleaseControl` only when `m.status === "active"`, and no viewer control moves a milestone from planned to active (`MILESTONE_FLOW`: planned → active → released). The user had to run `azimuth move M-02 active` and `azimuth move M-02 released` from their own terminal. Both of this project's milestones went from planned to released without ever being active.

## Fix
The user decided on 2026-10-21 to fix this in the next release, not in 0.3.0.

## Status notes
- 2026-10-31T17:26:12Z · agent · open → resolved: Fixed in dddaf4e (F-028, T-028.4): the viewer offers Release on a planned milestone whose features are all done.
