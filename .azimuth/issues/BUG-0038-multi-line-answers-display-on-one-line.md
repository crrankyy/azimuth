---
id: BUG-0038
type: bug
title: Multi-line answers display on one line
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [viewer/src/screens/Questions.tsx]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Answer a question with a note of several lines; view the answered question.

## Expected
The note keeps its line breaks.

## Actual
Line breaks collapse, so a structured answer reads as one paragraph.

Seen in viewer QA on 2026-10-18, before the high-priority fixes; not re-checked since.
