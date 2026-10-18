---
id: BUG-0040
type: bug
title: Re-approve with an uncommitted spec gives no hint and blames an agent
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/feature/ActionDialogs.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Edit an approved feature's spec without committing; open Re-approve.

## Expected
The dialog says the spec must be committed first.

## Actual
The button is enabled with no hint; the refusal says 'An agent changed …'.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
