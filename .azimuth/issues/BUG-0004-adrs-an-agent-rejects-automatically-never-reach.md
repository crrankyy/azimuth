---
id: BUG-0004
type: bug
title: ADRs an agent rejects automatically never reach the Inbox for review
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/core/inbox.ts, viewer/src/screens/decisions/AdrView.tsx]
found_by: SES-20261018-0136
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
1. Set `autonomy.accept_adrs: auto`.
2. As the agent, reject one of its proposed ADRs (`azimuth move ADR-… rejected --note …`).
3. Open the Inbox.

## Expected
Like an automatic acceptance, the automatic rejection appears under Review until you acknowledge it or move it back (the Decisions page already says "Rejected automatically… Acknowledge it, or move it back").

## Actual
Nothing appears in the Inbox. `inbox.ts` only adds review-auto items for ADRs an agent accepted, so an agent can drop a decision without you ever seeing it.
