---
id: BUG-0068
type: bug
title: Autostart starts another viewer whenever a busy viewer misses the 500 ms health check
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/server/autostart.ts, src/server/server.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: 2026-10-19
---
## Repro
1. Work in a large project (ZenithMD: 73 features, 500+ commits) with a Claude Code session
   that stays open all day, so the viewer rebuilds its index every 10 s.
2. Start, resume or compact sessions over the day; each SessionStart runs `ensureViewer`.

## Expected
One viewer per project. A viewer that is alive but slow to answer is reused, and a viewer that
was replaced exits once nobody uses it.

## Actual
On 2026-10-20, 19 viewer processes served ZenithMD (ports 4320–4338, all the same build, up
11 to 24 hours) and one served this repo, so all 20 ports from 4319 were taken. The next
viewer would fail with `EADDRINUSE`, and `test/server/autostart.test.ts` fails on this machine.

Two causes in the code:
- `healthy()` (`src/server/autostart.ts`) treats any fetch error, including the 500 ms timeout
  of a server that is busy rebuilding a large index, as `down`, and `ensureViewer` then spawns
  a new server without stopping the old one, whose pid is still alive.
- The idle exit in `src/server/server.ts` never fires while any Claude session in the project is
  open (`anySessionOpen`), and a replaced server never notices that `viewer.json` names another
  instance, so the old servers run forever.
