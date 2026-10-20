---
id: BUG-0077
type: bug
title: The top bar's key hints wrap at 1024 px
status: open
severity: low
likelihood: null
impact: null
links: [F-015]
files: [viewer/src/components/AppShell.tsx]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: null
---
## Repro
Open the Agents screen or a transcript page at 1024 px wide.

## Expected
The top bar's key hints stay on one line, or shorten.

## Actual
The hints wrap onto a second line (scratchpad shots/F-015/transcript-1024.png). The top bar is
shared, and other screens with several hints wrap the same way.
