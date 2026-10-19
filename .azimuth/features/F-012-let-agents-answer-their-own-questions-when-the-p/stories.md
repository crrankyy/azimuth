# F-012: Stories

In the scenarios below, "the proceed project" is a project whose config has
`autonomy:` / `questions: proceed`. It has a feature F-001 with a log, and a question Q-0001
"Which lock?" with `feature: F-001`, `blocking: false` and `raised_by: agent`. Q-0001 has option
`a` "Lockfile" (detail "Simple", recommended) and option `b` "Advisory lock" (detail "Faster").

## ST-012.1 · The project decides whether agents proceed on their own questions
**Intent:** As the user, I want one config key that decides whether my agents may take their own recommendation, so that unattended work doesn't stall on small decisions.

### S-012.1.1 · proceed is read from the config {happy}
- **GIVEN** a config.yaml with `autonomy:` / `questions: proceed` and no other autonomy keys
- **WHEN** `parseConfig` reads it
- **THEN** `config.autonomy` is `{approve_specs: "auto", accept_adrs: "auto", questions: "proceed", strict: false}` and `problems` is `[]`

### S-012.1.2 · Without the key, questions wait for you {edge}
- **GIVEN** a config.yaml without an `autonomy.questions` key
- **WHEN** `parseConfig` reads it
- **THEN** `config.autonomy.questions` is `"ask"`
- **AND** `configYaml` for a detected stack contains the line `  questions: ask # ask: only you answer; proceed: agents take their own recommendation on non-blocking questions`

### S-012.1.3 · An unknown mode is an error {negative}
- **GIVEN** a config.yaml with `autonomy:` / `questions: maybe`
- **WHEN** `parseConfig` reads it
- **THEN** `problems` is one `E-SCHEMA` error with the message `autonomy.questions must be ask or proceed.` and `config.autonomy.questions` is `"ask"`

### S-012.1.4 · The status brief names the mode {happy}
- **GIVEN** the proceed project, whose other autonomy keys keep their defaults
- **WHEN** `statusBrief` renders its index without a viewer URL
- **THEN** the brief's second line is `Autonomy: specs auto, decisions auto, questions proceed`

## ST-012.2 · Answers record who gave them
**Intent:** As the viewer and the CLI, I want every answer to say whether you or an agent gave it, so that agent answers can be reviewed and never passed off as yours.

### S-012.2.1 · An answer written before this feature is yours {edge}
- **GIVEN** `Q-0001.md` with `status: answered`, `answer: {option: a, text: "", answered_at: 2026-10-18T10:00:00Z}` and no `review_ack_at` key
- **WHEN** the project is loaded
- **THEN** Q-0001's answer is `{option: "a", text: "", answered_at: "2026-10-18T10:00:00Z", by: "you"}`, its `review_ack_at` is `null` and `model.problems` is `[]`

### S-012.2.2 · An agent's answer and its acknowledgement are read {happy}
- **GIVEN** `Q-0001.md` whose answer has `by: agent` and whose frontmatter has `review_ack_at: 2026-10-20T10:00:00Z`
- **WHEN** the project is loaded
- **THEN** Q-0001's `answer.by` is `"agent"`, its `review_ack_at` is `"2026-10-20T10:00:00Z"` and `model.problems` is `[]`

### S-012.2.3 · An unknown answerer is an error {negative}
- **GIVEN** `Q-0001.md` whose answer has `by: bot`
- **WHEN** the project is loaded
- **THEN** `model.problems` has an `E-SCHEMA` error for `.azimuth/questions/Q-0001.md` whose message starts with `answer must be {option, text, answered_at, by: you | agent}`, and `model.questions` has no Q-0001

## ST-012.3 · An agent's question is answered with its recommendation
**Intent:** As an agent in a proceed project, I want a non-blocking question I raise with a recommendation to be answered with it right away, so that I can record the decision and carry on.

### S-012.3.1 · A non-blocking question is answered with its recommendation {happy}
- **GIVEN** the proceed project with Q-0001 open
- **WHEN** `proceedWithRecommendation(root, "Q-0001", {actor: "agent", session: "SES-20261020-0900", now: 2026-10-20T09:00:00Z})` runs
- **THEN** Q-0001 has `status: answered` and answer `{option: "a", text: "", answered_at: "2026-10-20T09:00:00Z", by: "agent"}`, and the result has `auto: true` and the message `Q-0001: answered automatically with its recommendation (a: Lockfile)`
- **AND** F-001's log ends with the header `## 2026-10-20T09:00:00Z · agent · note · SES-20261020-0900 · auto` and the body `Q-0001 answered with its recommendation: Lockfile`

### S-012.3.2 · The CLI says the question was answered {happy}
- **GIVEN** a project with `autonomy.questions: proceed`, feature F-001 and no questions
- **WHEN** an agent (`AZIMUTH_ACTOR=agent`) runs `azimuth new question "Which lock?" --feature F-001 --option a="Lockfile: Simple" --option b="Advisory lock: Faster" --recommend a`
- **THEN** it exits 0 and prints exactly three lines: `Q-0001 created: .azimuth/questions/Q-0001.md`, `Q-0001: answered automatically with its recommendation (a: Lockfile)` and `Proceed with it and record it with azimuth resolve Q-0001. The user can overrule it in the viewer.`

### S-012.3.3 · A blocking question waits for you {negative}
- **GIVEN** the proceed project with Q-0001 open and `blocking: true`
- **WHEN** `proceedWithRecommendation` runs for Q-0001 as the agent
- **THEN** it returns `null`, Q-0001 is still `open` with `answer: null`, and F-001's log is unchanged

### S-012.3.4 · A question without one recommendation waits for you {edge}
- **GIVEN** the proceed project with Q-0001 open and neither option recommended
- **WHEN** `proceedWithRecommendation` runs for Q-0001 as the agent
- **THEN** it returns `null` and Q-0001 is still `open` with `answer: null`

### S-012.3.5 · Under ask nothing is answered {edge}
- **GIVEN** the project of S-012.3.2 without the `autonomy.questions` key
- **WHEN** an agent runs the same `azimuth new question "Which lock?" … --recommend a`
- **THEN** it exits 0 and prints only `Q-0001 created: .azimuth/questions/Q-0001.md`, and Q-0001 is `open` with `answer: null`

### S-012.3.6 · A question you create waits for you {edge}
- **GIVEN** the proceed project with Q-0001 open
- **WHEN** `proceedWithRecommendation` runs for Q-0001 with actor `you`
- **THEN** it returns `null` and Q-0001 is still `open` with `answer: null`

### S-012.3.7 · A question without a feature is answered without a log entry {edge}
- **GIVEN** the proceed project with Q-0001 open and `feature: null`
- **WHEN** `proceedWithRecommendation` runs for Q-0001 as the agent
- **THEN** Q-0001's `answer.by` is `"agent"`, the result's `changed` is `[".azimuth/questions/Q-0001.md"]`, and F-001's log is unchanged

## ST-012.4 · Agent answers wait for your review and are never passed off as yours
**Intent:** As the user, I want each agent answer listed for review and kept apart from my own decisions, so that I see what was decided for me and agents act only on what I decided.

### S-012.4.1 · An agent's answer waits in the Review list {happy}
- **GIVEN** the proceed project with Q-0001 answered `{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: agent}` and no `review_ack_at`
- **WHEN** the index is built
- **THEN** its inbox has the item `{kind: "review-auto", ref: "Q-0001", title: "Which lock?", detail: "Answered by an agent with its recommendation: Lockfile. Acknowledge it or answer differently.", since: "2026-10-20T09:00:00Z", urgency: "low"}`

### S-012.4.2 · Your acknowledgement clears the item and reaches the agent {happy}
- **GIVEN** the question of S-012.4.1 with `review_ack_at: 2026-10-20T10:00:00Z`
- **WHEN** the index is built and `userEventsSince` runs from a cursor at `2026-10-20T09:30:00Z`
- **THEN** the inbox has no item with ref `Q-0001`, and the events are exactly one with feature `F-001` and the text `acknowledged the automatic answer to Q-0001`

### S-012.4.3 · Your answer reaches the agent as your decision {happy}
- **GIVEN** the proceed project with Q-0001 answered `{option: b, text: "Use the advisory lock", answered_at: 2026-10-20T10:00:00Z, by: you}` and `resolution: null`
- **WHEN** `userEventsSince` runs from a cursor at `2026-10-20T09:30:00Z` and `statusBrief` renders the index
- **THEN** the events are exactly one with feature `F-001` and the text ``answered Q-0001 (Which lock?): Advisory lock — Use the advisory lock. Apply it, then `azimuth resolve Q-0001`.``
- **AND** the brief lists `  Q-0001 (F-001) Which lock?: Advisory lock — Use the advisory lock` under `Decided by the user in the viewer, not yet applied:`

### S-012.4.4 · An agent's own answer is not reported as yours {edge}
- **GIVEN** the question of S-012.4.1 with `resolution: null`
- **WHEN** `userEventsSince` runs from a cursor at `2026-10-20T08:00:00Z`, and `pendingAnswers` and `statusBrief` read the index
- **THEN** `userEventsSince` returns `[]`, `pendingAnswers` returns `[]`, and the brief has no line `Decided by the user in the viewer, not yet applied:`

## ST-012.5 · You acknowledge or replace an agent's answer
**Intent:** As the user, I want to accept an agent's answer or give my own instead, so that agent decisions stay mine to overrule.

### S-012.5.1 · You acknowledge the agent's answer {happy}
- **GIVEN** the proceed project with Q-0001 answered by the agent at `2026-10-20T09:00:00Z` and no `review_ack_at`
- **WHEN** `acknowledge(root, "Q-0001", {actor: "you", now: 2026-10-20T10:00:00Z})` runs
- **THEN** Q-0001's `review_ack_at` is `"2026-10-20T10:00:00Z"`, the message is `Q-0001: acknowledged`, and the built index's inbox has no item with ref `Q-0001`

### S-012.5.2 · Only an agent's answer can be acknowledged {negative}
- **GIVEN** the proceed project with Q-0001 answered `by: you`
- **WHEN** `acknowledge(root, "Q-0001", {actor: "you"})` runs
- **THEN** it throws an `AzimuthError` with code `invalid` and the message `Q-0001 has no automatic decision to acknowledge.`, and `Q-0001.md` is unchanged

### S-012.5.3 · You replace the agent's answer {happy}
- **GIVEN** the proceed project with Q-0001 answered by the agent and `resolution: {kind: assumption, ref: F-001}`
- **WHEN** `answerQuestion(root, "Q-0001", {option: "b", text: "Use the advisory lock"}, {actor: "you", now: 2026-10-20T10:00:00Z})` runs
- **THEN** Q-0001's answer is `{option: "b", text: "Use the advisory lock", answered_at: "2026-10-20T10:00:00Z", by: "you"}`, its `resolution` is `null`, the message is `Q-0001: answered, replacing the agent's answer`, and the built index's inbox has no item with ref `Q-0001`

### S-012.5.4 · Your own answer stays final {negative}
- **GIVEN** the proceed project with Q-0001 answered `by: you`
- **WHEN** `answerQuestion(root, "Q-0001", {option: "b"}, {actor: "you"})` runs
- **THEN** it throws an `AzimuthError` with code `conflict` and the message `Q-0001 is already answered.`

### S-012.5.5 · An agent can't replace an agent's answer {negative}
- **GIVEN** the proceed project with Q-0001 answered by the agent
- **WHEN** `answerQuestion(root, "Q-0001", {option: "b"}, {actor: "agent"})` runs
- **THEN** it throws an `AzimuthError` with code `policy` and the message `Only the user answers questions. Leave Q-0001 open and ask them.`, and Q-0001's `answer.by` is still `"agent"`

## ST-012.6 · The viewer shows agent answers and lets you overrule them
**Intent:** As the user, I want the Questions screen and the inbox to show which answers an agent gave and let me answer differently, so that I can review agent decisions where I already work.

### S-012.6.1 · The Questions screen shows the agent's answer {happy}
- **GIVEN** an index whose Q-0001 "Which lock?" is answered `by: agent` with option `a` "Lockfile"
- **WHEN** the Questions screen renders the route `#/questions/Q-0001`
- **THEN** the markup contains `Answered by an agent with its recommendation` and a button `Answer differently`, and does not contain `Your answer`

### S-012.6.2 · Your own answer offers no overrule {edge}
- **GIVEN** the index of S-012.6.1 with Q-0001 answered `by: you`
- **WHEN** the Questions screen renders the route `#/questions/Q-0001`
- **THEN** the markup contains `Your answer` and does not contain `Answer differently`

### S-012.6.3 · The Review item for a question offers to answer differently {happy}
- **GIVEN** the index of S-012.6.1 whose inbox holds the `review-auto` item of S-012.4.1
- **WHEN** the Inbox screen renders
- **THEN** Q-0001's row shows `Answered by an agent with its recommendation: Lockfile. Acknowledge it or answer differently.` and the buttons `Answer differently` and `Acknowledge`, and no `Send back…` button
- **AND** the aside's "Recently cleared" list has no `You answered` entry for Q-0001

### S-012.6.4 · The Review item for a feature still sends back {edge}
- **GIVEN** an index whose inbox holds a `review-auto` item for feature F-005
- **WHEN** the Inbox screen renders
- **THEN** F-005's row has the buttons `Send back…` and `Acknowledge`, and no `Answer differently` button

### S-012.6.5 · Recent activity says an agent answered {edge}
- **GIVEN** an index whose Q-0001 is answered `by: agent` at `2026-10-20T09:00:00Z`
- **WHEN** `recentActivity` lists the index
- **THEN** the line for that answer has `lead: "Agent answered"`, `id: "Q-0001"` and `at: "2026-10-20T09:00:00Z"`
