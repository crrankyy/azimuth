---
id: DEBT-0010
type: debt
title: The viewer's useTranscript and useScreenKeys hooks have no tests
status: open
severity: low
likelihood: null
impact: null
links: [F-015]
files: [viewer/src/data/transcript.ts, viewer/src/lib/keys.ts]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: null
---
## Problem
`useTranscript` (`viewer/src/data/transcript.ts`) queues at most one request in flight and one
more after it, and `useScreenKeys` (`viewer/src/lib/keys.ts`) guards keys like `useListKeys`. Neither
hook has a test: viewer tests render with `renderToStaticMarkup` in node, where effects don't run.
F-015's live browser check covered them once.

## Proposed fix
Add a DOM test environment (jsdom or happy-dom, a new dev dependency, so ask first) and test both
hooks, or move their logic into pure functions the existing tests can reach.
