---
id: BUG-0014
type: bug
title: Clicking the preselected recommended option clears the answer's choice
status: open
severity: high
likelihood: null
impact: null
links: []
files: [viewer/src/components/AnswerComposer.tsx]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
1. Open a question whose recommended option is shown as selected.
2. Click that option (the one you want), add a note, Send answer.

## Expected
The recommended option stays chosen; the answer records it.

## Actual
The click clears the preselected option, so the answer is saved as `{option: null, text: …}`. Without a note, Send is disabled with no explanation.
