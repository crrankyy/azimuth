---
id: BUG-0027
type: bug
title: Records an agent creates outside a session are attributed to you
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/cli/commands/write.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
With `AZIMUTH_ACTOR=agent` and no open Azimuth session, `azimuth new question "…"` or `azimuth new issue "…"`.

## Expected
The record names the agent as its author.

## Actual
It is recorded as created by `you`, because those fields only allow a session ID or `you`.

Decided by the user on 2026-10-18. Allow `agent` as a value (a file-format change).
