---
id: F-003
title: Trace test names that contain quote characters
summary: A scenario marker in a test name such as it("S-900.1.2 doesn't …") is traced as a marker, not a mention, so coverage confidence is right for ordinary English test names.
status: done
priority: P2
size: S
mode: brownfield
milestone: null
depends_on: []
superseded_by: null
tags: []
created: 2026-10-18
updated: 2026-10-18
approved_at: 2026-10-18
approved_by: agent
approved_hash: sha256:804bc094d3e10d2aa39298ea388ce51814b2e71fe702ef2c0dea8a34cacb4f5f
approved_commit: f2c9bb3
review_ack_at: 2026-10-18T13:34:00Z
---
# F-003: Trace test names that contain quote characters

## Objective
A scenario marker in a test name that contains another quote character, such as
`it("S-900.1.2 doesn't count", …)`, is traced as a marker with its full name instead of a
low-confidence mention, so ordinary English test names get the right coverage confidence.

## Out of scope
- Test titles built with template-literal interpolation or spanning several lines.
- Languages other than the JavaScript/TypeScript title form (pytest markers and comment markers
  are unchanged).

## Integration points
- `src/core/trace.ts`: the `JS_TITLE` pattern and `scanTestFile`.

## Invariants
- A scenario ID in a string that isn't a test title stays a mention.
- `scanTestFile`'s signature and the `TestRef` shape don't change.

## Assumptions
- A title ends at the first unescaped quote of the kind that opened it; a backslash escapes the
  next character, and the recorded name has the escapes removed.
