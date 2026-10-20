---
id: BUG-0082
type: bug
title: The inbox asks to reapprove a verifying feature whose spec changed
status: open
severity: low
likelihood: null
impact: null
links: [F-024]
files: [src/core/inbox.ts]
found_by: SES-20261020-1730
created: 2026-10-20
resolved_at: null
---
## Repro
Edit a spec file of a feature in `verifying` (a files-list or story fix at close-out) and commit it.

## Expected
No reapproval prompt: the done gate doesn't check the approval, which `azimuth reapprove` now says when it refuses a verifying feature (F-024).

## Actual
`src/core/inbox.ts` (~line 81) adds a high-urgency `reapprove-spec` item for any active feature with `modified_since_approval`, verifying included, and reapprove then refuses it.
