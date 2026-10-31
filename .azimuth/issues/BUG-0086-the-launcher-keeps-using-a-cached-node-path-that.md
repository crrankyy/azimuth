---
id: BUG-0086
type: bug
title: The launcher keeps using a cached Node path that no longer runs
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [plugin/bin/azimuth]
found_by: SES-20261031-1611
created: 2026-10-31
resolved_at: null
---
## Repro
The launcher caches the Node it found in `~/.cache/azimuth/node-path` and on later calls checks only that the file is executable (`[ -x ]`). On 2026-10-31 a Homebrew upgrade of simdutf (33 to 37) left `/usr/local/opt/node@22/bin/node` unable to load (`dyld: Library not loaded: libsimdutf.33.dylib`).

## Expected
A cached Node that no longer runs is dropped, and the launcher searches again (nvm's Node was installed).

## Actual
Every `azimuth` call and every hook aborted (exit 134) with the dyld error until the cache file was rewritten by hand.

## Fix
Not in 0.3.1 (not part of the request); filed for a later release.
