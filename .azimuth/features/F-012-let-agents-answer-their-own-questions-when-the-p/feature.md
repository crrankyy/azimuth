---
id: F-012
title: Let agents answer their own questions when the project allows it
summary: "With autonomy.questions: proceed, a non-blocking question an agent raises with a recommendation is answered with it at once, marked as the agent's answer and listed in your inbox until you acknowledge or overrule it."
status: done
priority: P2
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:8f8a2e33257e4c8daffb7089546d8ace8c56477202f91ed976a9886894ddb3be
approved_commit: c088d7c
review_ack_at: null
---
# F-012: Let agents answer their own questions when the project allows it

## Objective
Make "decide, record, proceed, let the user overrule later" a project setting instead of a prose
rule. With `autonomy.questions: proceed`, a non-blocking question an agent raises with a
recommended option is answered with that option at once (`answer.by: agent`), noted in the
feature's log as an automatic decision and listed in the inbox's Review group until you
acknowledge it or answer it differently. Your answer replaces the agent's and reaches the agent
like any answer of yours. Under `ask`, the default, nothing changes.

## Out of scope
- Agents answering a question that is already open, one you raised, or one with no recommended
  option. Only a new question an agent raises can be answered, at the moment it is created.
- Blocking questions: they wait for you in every mode, and the gates don't change.
- Autonomy for each feature or each question; the setting covers the whole project.
- Writing the assumption into feature.md for the agent. The agent still records how it applied
  the answer with `azimuth resolve`.
- The build and ship skills' wording. Only the protocol and the spec and azimuth skills change.
- Telling you about agent answers anywhere except the viewer and `azimuth status`.

## Integration points
- `src/core/types.ts`, `src/core/config.ts`: `autonomy.questions` (`ask | proceed`, default
  `ask`); `answer.by` and `review_ack_at` on questions.
- `src/core/init.ts`: `azimuth init` writes the new key with a comment, like the other autonomy keys.
- `src/core/parse/records.ts`: reads `answer.by`, which defaults to `you`, and `review_ack_at`.
- `src/core/transitions.ts`: new `proceedWithRecommendation`. `answerQuestion` lets you replace an
  agent's answer, and `acknowledge` accepts questions an agent answered.
- `src/cli/commands/write.ts`: `new question` calls `proceedWithRecommendation` and prints the
  result. `ack` takes a Q-ID.
- `src/core/inbox.ts`: a `review-auto` item for each agent answer you haven't acknowledged.
- `src/core/delta.ts`, `src/core/next.ts`: an agent's answer is not reported as the user's
  decision. Acknowledging a question is reported like acknowledging a feature or ADR.
- `src/core/brief.ts`: the autonomy line in `status --brief` (also in the session-start context)
  names the questions mode.
- Viewer: `screens/Questions.tsx` (the agent's answer and "Answer differently"),
  `screens/Inbox.tsx` (the Review item's actions, the "Recently cleared" list) and
  `screens/overview/activity.ts` (who answered).
- Agent instructions: `src/core/protocol.ts`, `plugin/skills/spec/SKILL.md`,
  `plugin/skills/azimuth/SKILL.md`.

## Invariants
- Under `ask`, and in every project without the key, questions behave exactly as today. Only you
  answer them.
- A blocking question, or one without exactly one recommended option, is never answered by an
  agent.
- No agent can change or replace an answer. `azimuth answer` is still for you only, in every mode.
- Every agent answer is visible: `answer.by: agent` in the file, an `· auto` note in the feature's
  log when the question names a feature, and a Review item until you acknowledge or replace it.
- Question files written before this feature parse unchanged: an answer without `by` is yours,
  and `review_ack_at` is absent (null). No migration.
- The viewer still acts as you, never as an agent.

## Assumptions
- Proceed applies when the actor creating the question is `agent` (from `AZIMUTH_ACTOR`). A
  question you create stays open in every mode.
- "With a recommendation" means exactly one option has `recommended: true`, which is what
  `--recommend` writes. With none, or with two or more (already `W-QUESTION-OPTIONS`), the question
  stays open.
- The agent's answer has empty `text`, because the option is the answer.
- The answer is written by a second locked write in `new question`, right after `createQuestion`,
  which is unchanged. If that write fails, the question stays open, as it would today.
- An agent's answer is not the user's decision. It is left out of "Decided by the user" (status
  brief and `next`) and out of the prompt delta. Like any answer, the agent records it with
  `azimuth resolve`, and `show F-NNN --brief` lists it as "Answered, not yet applied" until then.
- When you replace an agent's answer, `resolution` is cleared and nothing is written to the
  feature's log. Your answer reaches the agent as an ordinary answer through the delta and
  "Decided by the user". `review_ack_at` is left as it is: the Review item goes away because the
  answer is now yours.
- An agent's answer counts as an answer for the ADR guard, so an agent may accept an ADR that
  resolves it. You can still replace the answer. concepts.md says the guard is about open
  questions.
- Acknowledging an agent's answer reaches agents as "acknowledged the automatic answer to Q-…",
  like the acknowledgements of features and ADRs.
- In the inbox, "Answer differently" opens the same inline answer form that open questions use,
  with the recommendation preselected as today. On the Questions screen it shows the full form
  below the agent's answer.
- Projects get the new protocol text when `azimuth init` rewrites `.azimuth/PROTOCOL.md`. Nobody
  edits this repository's copy by hand.
