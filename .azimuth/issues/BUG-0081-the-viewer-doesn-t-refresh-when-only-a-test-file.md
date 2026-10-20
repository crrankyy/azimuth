---
id: BUG-0081
type: bug
title: The viewer doesn't refresh when only a test file changes
status: open
severity: low
likelihood: null
impact: null
links: [F-020]
files: [src/server/server.ts]
found_by: SES-20261020-1730
created: 2026-10-20
resolved_at: null
---
## Repro
With the viewer open on a feature's Stories tab, add a test for one of its scenarios to a test file (not committed). Nothing changes until something under `.azimuth/` or git's HEAD changes; touching `.azimuth/config.yaml` makes the uncommitted test and its tag appear.

## Expected
The viewer picks up test-file changes, so F-020's `uncommitted` tag shows while a lane's test is still in the working tree.

## Actual
`watchProject` (src/server/server.ts) watches `.azimuth/`, the live folder and git's HEAD, packed-refs and logs/HEAD, but no test files, so the index isn't rebuilt. Found while screenshotting F-020's tag. In practice a task move or finish refreshes it soon after.
