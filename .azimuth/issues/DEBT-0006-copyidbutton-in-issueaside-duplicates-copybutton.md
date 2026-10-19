---
id: DEBT-0006
type: debt
title: CopyIdButton in IssueAside duplicates CopyButton's copy logic
status: open
severity: low
likelihood: null
impact: null
links: [F-017]
files: [viewer/src/screens/issues/IssueAside.tsx]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Problem
F-017 made "Copy ID" a tertiary Button with its own copy handler (`CopyIdButton` in
`viewer/src/screens/issues/IssueAside.tsx`), because `CopyButton` in `components/CodeBlock.tsx`
renders only the small style. The copy-and-"Copied" logic now exists twice.

## Proposed fix
Let `CopyButton` take a variant (small or Button style) and use it on the issue page.
