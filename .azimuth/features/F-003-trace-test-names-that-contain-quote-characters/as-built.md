---
completed_at: 2026-10-18
files_changed:
  - { path: src/core/trace.ts, change: modify }
  - { path: test/core/git-trace.test.ts, change: modify }
deviations: []
follow_ups: []
---
# F-003: As built

## Summary
The JavaScript test-title pattern in `src/core/trace.ts` now runs to the next unescaped quote of
the kind that opened the title, and backslash escapes are removed from the recorded name. F-001's
tests named with "doesn't" are now traced as markers instead of mentions.

## Deviations
None in the code. After approval the spec's examples moved from S-001.1.x to the unused S-900
range (re-approved), because F-001 already uses S-001.1.x in this repository and the test
strings would have been traced as F-001's tests.

## Follow-ups
None.
