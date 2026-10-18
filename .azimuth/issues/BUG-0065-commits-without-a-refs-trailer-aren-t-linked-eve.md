---
id: BUG-0065
type: bug
title: Commits without a Refs trailer aren't linked, even when their scope names the feature
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/core/git.ts]
found_by: SES-20261018-1839
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
Let an agent commit `feat(F-003): recognise inline code spans` without a `Refs:` trailer.

## Expected
The commit is linked to F-003: it appears in the feature's commits and Activity, not as untracked.

## Actual
Only the `Refs:` trailer links a commit. In the subagent rehearsal on 2026-10-18 the Sonnet
orchestrator left the trailer out of all 21 commits for F-002 to F-005 (Opus included it for every
F-001 task), so the Activity feed showed every commit as "untracked · no refs" and the features
listed none of their commits, although each subject's scope named the feature.

## Status notes
- 2026-10-18T18:58:35Z · agent · in-progress → resolved: Fixed in 2b9a087; the rehearsal repo went from 0 to 34 of 42 commits linked
