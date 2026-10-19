---
tasks:
  - id: T-012.1
    title: Config key and question fields (red → green)
    status: todo
    after: []
    covers: [S-012.1.1, S-012.1.2, S-012.1.3, S-012.2.1, S-012.2.2, S-012.2.3]
    files: [src/core/types.ts, src/core/config.ts, src/core/init.ts, src/core/parse/records.ts, test/core/questions.test.ts, test/core/parse.test.ts, test/core/analysis.test.ts, test/fixtures/hookline/expected-index.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/questions.test.ts test/core/parse.test.ts test/core/analysis.test.ts test/golden/index.test.ts --reporter=verbose
    note: null
  - id: T-012.2
    title: Review items, prompt delta and status line (red → green)
    status: todo
    after: [T-012.1]
    covers: [S-012.1.4, S-012.4.1, S-012.4.2, S-012.4.3, S-012.4.4]
    files: [src/core/inbox.ts, src/core/delta.ts, src/core/next.ts, src/core/brief.ts, test/core/question-review.test.ts]
    verify: pnpm exec vitest run test/core/question-review.test.ts --reporter=verbose
    note: null
  - id: T-012.3
    title: Answer a new question with its recommendation (red → green)
    status: todo
    after: [T-012.1]
    covers: [S-012.3.1, S-012.3.2, S-012.3.3, S-012.3.4, S-012.3.5, S-012.3.6, S-012.3.7]
    files: [src/core/transitions.ts, src/cli/commands/write.ts, test/core/questions.test.ts, test/e2e/questions.test.ts]
    verify: pnpm build && pnpm exec vitest run test/core/questions.test.ts test/e2e/questions.test.ts -t S-012.3 --reporter=verbose
    note: null
  - id: T-012.4
    title: Acknowledge or replace an agent's answer (red → green)
    status: todo
    after: [T-012.2, T-012.3]
    covers: [S-012.5.1, S-012.5.2, S-012.5.3, S-012.5.4, S-012.5.5]
    files: [src/core/transitions.ts, src/cli/commands/write.ts, test/core/questions.test.ts]
    verify: pnpm exec vitest run test/core/questions.test.ts -t S-012.5 --reporter=verbose
    note: null
  - id: T-012.5
    title: Questions screen and recent activity show agent answers (red → green)
    status: todo
    after: [T-012.1]
    covers: [S-012.6.1, S-012.6.2, S-012.6.5]
    files: [viewer/src/screens/Questions.tsx, viewer/src/screens/questions.css, viewer/src/screens/Questions.test.tsx, viewer/src/screens/overview/activity.ts, viewer/src/screens/overview/activity.test.ts]
    verify: pnpm exec vitest run viewer/src/screens/Questions.test.tsx viewer/src/screens/overview/activity.test.ts --reporter=verbose
    note: null
  - id: T-012.6
    title: Inbox Review items for questions (red → green)
    status: todo
    after: [T-012.1]
    covers: [S-012.6.3, S-012.6.4]
    files: [viewer/src/screens/Inbox.tsx, viewer/src/screens/Inbox.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/Inbox.test.tsx --reporter=verbose
    note: null
  - id: T-012.7
    title: Docs, agent instructions and full verification
    status: todo
    after: [T-012.2, T-012.4, T-012.5, T-012.6]
    covers: []
    files: [docs/concepts.md, docs/file-format.md, docs/cli.md, docs/viewer.md, plugin/skills/spec/SKILL.md, plugin/skills/azimuth/SKILL.md, src/core/protocol.ts]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-012: Plan

Test-first. T-012.1 adds the config key and the question fields, and the parser that fills them,
because the Question type needs both before anything compiles. It also updates three existing
tests that the new fields change:
- `test/core/parse.test.ts` compares the whole default `autonomy` object, which now has
  `questions: "ask"`. The test is right, but the default it checks changes.
- `test/core/analysis.test.ts` builds an answer by hand, which needs `by: "you"`.
- The Hookline golden index (`expected-index.ts`) gains `autonomy.questions: "ask"`,
  `answer.by: "you"` on Q-0001 and `review_ack_at: null` on every question.

After T-012.1, four slices touch separate files and can run in parallel:
- T-012.2: what reads agent answers in core (inbox, delta, pending answers, the status line).
- T-012.3: the automatic answer (`proceedWithRecommendation` and `new question`).
- T-012.5: the Questions screen and recent activity.
- T-012.6: the inbox.

T-012.4 (acknowledge and replace) edits `transitions.ts` and `write.ts` after T-012.3. Its
scenarios also check that the Review item disappears, which comes from T-012.2.

The e2e test in T-012.3 runs the built CLI, so its verify builds first. In T-012.7 the protocol
line "Only the user answers questions…" has to stay true under `ask` and also say what happens
under `proceed`: your non-blocking question with a recommendation is answered with it, you carry
on and record it with `azimuth resolve`, and the user can overrule it. The spec skill §2 and the
azimuth skill say the same. Under proceed, the spec skill tells agents to raise smaller
decisions as non-blocking questions with `--recommend` instead of only writing an assumption.
concepts.md rewords the ADR guardrail to "an open question".
