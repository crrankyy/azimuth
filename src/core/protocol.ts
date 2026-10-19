/** `.azimuth/PROTOCOL.md`: how agents work in an Azimuth project. Policy-free on purpose. */
export const PROTOCOL = `# Azimuth protocol

This repository is managed with Azimuth. Project state (features with their specs and plans,
decisions, questions, issues and work sessions) lives in \`.azimuth/\` and is shown live in the
Azimuth viewer. Follow this protocol whenever you work in this repository.

## Ground rules

- Read state through the CLI instead of scanning files: \`azimuth status --brief\` for the
  project, \`azimuth show <ID> --brief\` for one item, \`azimuth next\` for what to do.
- File formats, rules and commands are in \`azimuth docs formats\`, \`azimuth docs concepts\`
  and \`azimuth docs cli\`. Read them there, never in Azimuth's own code.
- Change a status only with \`azimuth move <ID> <status>\`. Never edit \`status\`, approval
  fields or other values the CLI writes. When a move is refused, read the reason, fix the cause
  or ask the user; never work around a gate.
- After every edit under \`.azimuth/\`, run \`azimuth check\` and fix every error it reports.
- If the \`azimuth\` command is missing, stop and ask the user to install the Azimuth plugin.
  Don't edit \`.azimuth/\` by hand to compensate.
- Only the user answers questions, releases milestones and overrides gates. You may approve
  specs and accept decisions only when the project's autonomy settings allow it; the CLI
  enforces this.
- When \`azimuth status --brief\` shows \`questions proceed\`, the user has let the CLI answer a
  non-blocking question you raise with \`--recommend\` with that recommendation, and
  \`azimuth new question\` says so. Proceed with it and record it (\`azimuth resolve Q-…\`).
  The user can answer differently later; that answer reaches you like any other. Under
  \`questions ask\`, and for blocking questions, every question waits for the user.
- The user's answers and change requests from the viewer reach you in Azimuth's session-start
  and prompt context ("Decided by the user…"). Apply each one, then record it
  (\`azimuth resolve Q-…\`), before approving or building on the spec it affects.

## Sessions and progress

- Start each unit of work with \`azimuth session start --skill <skill> --goal "<goal>"\`. Inside
  one Claude Code session every start continues the same Azimuth session and adds its goal, so
  start again whenever you take up a new skill or goal.
- Record progress as you go with \`azimuth session note "<progress>"\`, and end each unit of work
  with \`azimuth session handoff "<what the next session should do>"\`, which replaces the
  previous handoff.
- The Azimuth plugin closes the session when the Claude Code session ends. Without the plugin,
  finish with \`azimuth session close\`.
- Keep the viewer current during long work: move a task to \`in-progress\` when you start it,
  and add \`azimuth log <ID> "<progress>"\` notes at meaningful points.
- Finish each task with \`azimuth task finish <T-ID> --commit "<message>"\`: it commits the
  task's files and the feature's records with a \`Refs: <T-ID>\` trailer, runs the task's verify
  command and moves the task to \`done\` when it passes.
- \`azimuth brief <T-ID>\` prints the prompt for a subagent building a task, from the records.
- Commit with Conventional Commits and a \`Refs:\` trailer naming the task or feature
  (\`Refs: T-005.2\`). Commit pending \`.azimuth/\` changes as well
  (\`chore(azimuth): record decisions\`).

## Specs

Features move idea → draft → approved → in-progress → verifying → done. A feature's spec
lives in \`.azimuth/features/F-NNN-<slug>/\`; \`.azimuth/templates/\` shows each file's format.

- feature.md: objective, out of scope, integration points, invariants, assumptions.
- impact.md: every file to create, modify, read or test.
- stories.md: stories with BDD scenarios. Every story needs a happy scenario and a negative or
  edge scenario; every THEN names an exact value, state, error or status code. A value only the
  code can measure (a byte offset, a count) may be written \`{?}\` in a THEN or AND line, never
  for undecided behaviour. When a test proves it, \`azimuth settle <S-ID> "<value>"\` fills it
  in; the feature can't be done while a \`{?}\` is left.
- contract.md: types, signatures and errors in the target language, without bodies.
- plan.md: a task graph (\`after\`) in test-first order. Every scenario is covered by a task and
  every task has a verify command that exits 0 on success.
- notes.md: what a task taught, written with \`azimuth note <T-ID> "<text>"\`, never in
  feature.md. Notes and settled values never make the approval stale, so they need no
  \`azimuth reapprove\`; every other spec edit, a corrected THEN included, does.
- When a decision is ambiguous and costly to reverse, raise a question with options and a
  recommendation (\`azimuth new question "<question>" --feature F-NNN --blocking\`) instead of
  guessing. Record smaller assumptions in feature.md.

## Tests

- Start each test name with the scenario it covers: \`it("S-005.1.2 rejects an expired token", …)\`
  (pytest: \`@pytest.mark.scenario("S-005.1.2")\`; other languages: a \`// scenario: S-005.1.2\`
  comment above the test).
- \`azimuth task finish\` runs the task's verify command after committing it; the result
  appears in the viewer.
`;

// The blank line after the start marker is what Prettier expects, so formatters leave the block alone.
export const CLAUDE_BLOCK = `<!-- azimuth:start -->

## Azimuth

This project is managed with Azimuth. Follow its protocol:

@.azimuth/PROTOCOL.md
<!-- azimuth:end -->`;

export const AGENTS_BLOCK = `<!-- azimuth:start -->

## Azimuth

This project is managed with Azimuth. Read \`.azimuth/PROTOCOL.md\` before working and follow it.
<!-- azimuth:end -->`;
