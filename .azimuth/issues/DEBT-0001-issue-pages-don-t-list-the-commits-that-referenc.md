---
id: DEBT-0001
type: debt
title: Issue pages don't list the commits that reference them
status: resolved
severity: low
likelihood: null
impact: null
links: []
files: [viewer/src/screens/issues/IssueDetail.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: 2026-10-18
---
## Problem
Feature pages list the commits whose `Refs:` name them; issue pages don't, so a bug's fix (e.g. `Refs: BUG-0025`) is only visible in Activity or git.

## Proposed fix
Decided by the user on 2026-10-18. Derive the referencing commits for issues in the index and list them on the issue page.

## Status notes
- 2026-10-18T16:35:50Z · agent · in-progress → resolved: Fixed in 9fd09b5; checked in the viewer
