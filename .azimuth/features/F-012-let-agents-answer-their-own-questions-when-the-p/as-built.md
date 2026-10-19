---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/config.ts, change: modify }
  - { path: src/core/init.ts, change: modify }
  - { path: src/core/parse/records.ts, change: modify }
  - { path: src/core/transitions.ts, change: modify }
  - { path: src/cli/commands/write.ts, change: modify }
  - { path: src/core/inbox.ts, change: modify }
  - { path: src/core/delta.ts, change: modify }
  - { path: src/core/next.ts, change: modify }
  - { path: src/core/brief.ts, change: modify }
  - { path: src/core/protocol.ts, change: modify }
  - { path: viewer/src/screens/Questions.tsx, change: modify }
  - { path: viewer/src/screens/questions.css, change: modify }
  - { path: viewer/src/screens/Inbox.tsx, change: modify }
  - { path: viewer/src/screens/overview/activity.ts, change: modify }
  - { path: test/core/questions.test.ts, change: create }
  - { path: test/core/question-review.test.ts, change: create }
  - { path: test/e2e/questions.test.ts, change: create }
  - { path: test/core/parse.test.ts, change: modify }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: viewer/src/screens/Questions.test.tsx, change: create }
  - { path: viewer/src/screens/Inbox.test.tsx, change: create }
  - { path: viewer/src/screens/overview/activity.test.ts, change: create }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/cli.md, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: plugin/skills/spec/SKILL.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
deviations:
  - { path: src/cli/commands/write.ts, kind: interface-change, reason: "new question prints only the ID on stdout and the created line plus the two answered-automatically lines on stderr, because F-013 had made new print only the ID on stdout; the approved spec had all three lines on stdout" }
  - { path: .azimuth/features/F-012-let-agents-answer-their-own-questions-when-the-p/stories.md, kind: spec-change, reason: "S-012.3.2 and S-012.3.5 were corrected to that split in 25e78d6 and the spec re-approved; the CLI block in contract.md still shows the earlier three stdout lines" }
follow_ups: []
---
# F-012: As built

## Summary
The new key `autonomy.questions` (`ask | proceed`, default `ask`) is read from config and written
by `azimuth init`. Under `proceed`, `new question` from an agent follows `createQuestion` with
`proceedWithRecommendation` (`transitions.ts`). A non-blocking question with exactly one
recommended option is answered with it at once (`answer.by: agent`, empty text), with an `· auto`
note in the feature's log. `inbox.ts` lists it as a Review item until you acknowledge it
(`azimuth ack Q-…`) or answer it differently: `answerQuestion` replaces the agent's answer and
clears its `resolution`. Agent answers stay out of "Decided by the user" and the prompt delta,
acknowledging one reaches agents like other acknowledgements, and the autonomy line of
`status --brief` names the questions mode. Question files without `by` or `review_ack_at` parse
as before.

In the viewer, the Questions screen labels an agent's answer and offers "Answer differently". The
inbox's Review item for a question offers Acknowledge and Answer differently, "Recently cleared"
lists only your answers, and recent activity leads an agent's answer with "Agent answered". The
protocol text, the spec and azimuth skills and the docs say who answers questions under `ask` and
under `proceed`.

## Deviations
- `new question` prints only the ID on stdout and the created line plus the two
  answered-automatically lines on stderr. F-013, built first, had made `new` print only the ID on
  stdout; the approved spec had all three lines on stdout.
- S-012.3.2 and S-012.3.5 were corrected to that output in 25e78d6 and the spec re-approved. The
  CLI block in `contract.md` still shows the earlier three stdout lines.

Otherwise the files match `impact.md`.

## Follow-ups
None.
