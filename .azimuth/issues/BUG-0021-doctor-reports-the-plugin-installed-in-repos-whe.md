---
id: BUG-0021
type: bug
title: doctor reports the plugin installed in repos where it isn't enabled
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/cli/commands/harness.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
Enable the plugin at local scope in repo A; run `azimuth doctor` in repo B.

## Expected
doctor says the plugin isn't enabled for repo B and how to enable it.

## Actual
"✓ Claude Code plugin azimuth@azimuth is installed": the check greps the plugin list for the name without looking at its scope or project, so no hooks will run while doctor says all is well.
