---
id: BUG-0019
type: bug
title: New repos have no format reference for project docs and as-built
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/init.ts, src/core/templates.ts, plugin/skills/verify/SKILL.md]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
Run `azimuth init` in a new repo, then `/azimuth:init` and `/azimuth:verify` as an agent.

## Expected
The repo shows the format of `architecture.md` modules, glossary terms and `as-built.md`.

## Actual
The stubs only say `modules: []` and `terms: []`, and there is no as-built template; the agent read Azimuth's bundled CLI and its source (`src/core/types.ts`) to learn the formats.
