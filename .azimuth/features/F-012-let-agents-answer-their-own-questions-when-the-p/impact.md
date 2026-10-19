---
files:
  - path: src/core/types.ts
    change: modify
    note: QUESTION_AUTONOMY and Autonomy.questions; answer.by and review_ack_at on Question
  - path: src/core/config.ts
    change: modify
    note: Reader and default (ask) for autonomy.questions
  - path: src/core/init.ts
    change: modify
    note: configYaml writes autonomy.questions with its comment
  - path: src/core/parse/records.ts
    change: modify
    note: answerReader reads by (default you, rejects other values); parseQuestion reads review_ack_at
  - path: src/core/transitions.ts
    change: modify
    note: proceedWithRecommendation (new); answerQuestion replaces an agent's answer; acknowledge takes questions
  - path: src/cli/commands/write.ts
    change: modify
    note: new question answers with the recommendation under proceed and says so; ack takes a Q-ID
  - path: src/core/inbox.ts
    change: modify
    note: review-auto item for each agent answer you haven't acknowledged
  - path: src/core/delta.ts
    change: modify
    note: Agent answers are not user events; acknowledging a question is
  - path: src/core/next.ts
    change: modify
    note: pendingAnswers keeps only your answers
  - path: src/core/brief.ts
    change: modify
    note: The autonomy line names the questions mode
  - path: src/core/protocol.ts
    change: modify
    note: Who answers questions under ask and under proceed
  - path: src/core/create.ts
    change: read
    note: createQuestion stays as it is; new question composes it with proceedWithRecommendation
  - path: src/server/actions.ts
    change: read
    note: The viewer's answer and acknowledge actions reach the changed transitions unchanged
  - path: viewer/src/screens/Questions.tsx
    change: modify
    note: An agent's answer is labelled as such and offers Answer differently
  - path: viewer/src/screens/questions.css
    change: modify
    note: Layout of the Answer differently action
  - path: viewer/src/screens/Inbox.tsx
    change: modify
    note: Review items for questions offer Answer differently and Acknowledge; Recently cleared lists only your answers
  - path: viewer/src/screens/overview/activity.ts
    change: modify
    note: Recent activity says who answered
  - path: viewer/src/components/AnswerComposer.tsx
    change: read
    note: Reused unchanged as the overrule form
  - path: test/core/questions.test.ts
    change: test
    note: Config key, question fields, answering with the recommendation, acknowledging and overruling
  - path: test/core/question-review.test.ts
    change: test
    note: Review items, the prompt delta, pending answers and the status line
  - path: test/e2e/questions.test.ts
    change: test
    note: new question through the built CLI under proceed and ask
  - path: test/core/parse.test.ts
    change: test
    note: The default autonomy now includes questions ask
  - path: test/core/analysis.test.ts
    change: test
    note: A hand-built answer gets by you to match the Question type
  - path: test/fixtures/hookline/expected-index.ts
    change: test
    note: autonomy.questions, answer.by and review_ack_at in the golden index
  - path: viewer/src/screens/Questions.test.tsx
    change: test
    note: The agent's answer and the overrule action on the Questions screen
  - path: viewer/src/screens/Inbox.test.tsx
    change: test
    note: Review item actions for questions and features; Recently cleared
  - path: viewer/src/screens/overview/activity.test.ts
    change: test
    note: Who answered in recent activity
  - path: docs/concepts.md
    change: modify
    note: autonomy.questions, the Review item and the guardrails
  - path: docs/file-format.md
    change: modify
    note: Config key; answer.by and review_ack_at on questions
  - path: docs/cli.md
    change: modify
    note: new question under proceed; answer replaces an agent's answer; ack takes a Q-ID
  - path: docs/viewer.md
    change: modify
    note: Answer differently on Questions and in the inbox; acknowledging an agent's answer
  - path: plugin/skills/spec/SKILL.md
    change: modify
    note: Under proceed, raise smaller decisions as non-blocking questions with a recommendation and carry on
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: Who answers questions under ask and proceed
---
# F-012: Impact map

The setting lives in config and the index's `project.autonomy`. `new question` writes the
question as it does today. Under proceed, a second locked write in `transitions.ts` then answers
it with the agent's recommendation. Everything else reads `answer.by`: the inbox, the delta and
pending answers in core, and the Questions and Inbox screens in the viewer.
