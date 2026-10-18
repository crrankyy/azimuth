# Concepts

Azimuth manages a software project the way an agent-first team works: agents specify, build and
verify features; you set direction, answer questions and review what the agents decided. All
state lives in the repository under `.azimuth/`; the CLI validates it and moves it through gated
lifecycles; the viewer shows it live.

- [Entities](#entities)
- [Feature lifecycle and gates](#feature-lifecycle-and-gates)
- [Autonomy](#autonomy)
- [Derived values](#derived-values)
- [The inbox](#the-inbox)
- [Traceability](#traceability)
- [Sessions and live activity](#sessions-and-live-activity)
- [Problems](#problems)

## Entities

| Entity           | ID                                   | What it is                                                                                                          |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Feature          | `F-005`                              | The unit of work: a spec (context, impact map, stories, contract, plan), a log and, at the end, an as-built record. |
| Story / scenario | `ST-005.1` / `S-005.1.2`             | Acceptance criteria as GIVEN / WHEN / THEN, each `happy`, `negative` or `edge`.                                     |
| Task             | `T-005.4`                            | A step in a feature's plan. Tasks form a graph (`after`), cover scenarios and carry a verify command.               |
| Milestone        | `M-02`                               | A release grouping with a target date.                                                                              |
| Decision         | `ADR-0003`                           | An architecture decision record.                                                                                    |
| Question         | `Q-0003`                             | Something an agent couldn't safely decide, with options and a recommendation.                                       |
| Issue            | `BUG-0001`, `DEBT-0001`, `RISK-0001` | Bugs and tech debt (with severity) and risks (with likelihood and impact).                                          |
| Session          | `SES-20261018-1100`                  | One unit of agent work (usually one skill run) with a summary and a handoff.                                        |
| Verify run       | `R-0142`                             | The recorded result of running a task's verify command.                                                             |

The [file format reference](file-format.md) describes every field.

## Feature lifecycle and gates

```
idea → draft → approved → in-progress → verifying → done
side states: deferred · cancelled · superseded
```

Every status change goes through `azimuth move` (or a viewer action), which checks the lifecycle
table, who is acting, and the gate for forward moves. A gate is a list of checks; all must pass.

| Move                    | Gate checks                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idea → draft            | Spec files written: impact, stories, contract and plan exist, with at least one story and one task.                                                                                                                                                                                                                                                             |
| draft → approved        | No errors in the feature · every story has a happy and a negative or edge scenario · every scenario has GIVEN, WHEN and THEN · every scenario is covered by a task · every task has a verify command · the spec is committed · no open blocking question · dependencies exist and form no cycle · size is not XL. (With `autonomy.strict`: no warnings either.) |
| approved → in-progress  | The spec is unchanged since approval · every dependency is done (you may override this one with a reason).                                                                                                                                                                                                                                                      |
| in-progress → verifying | Every task is done or skipped with a note · no open blocking question.                                                                                                                                                                                                                                                                                          |
| verifying → done        | The latest verify run of every task passed at HEAD · every scenario has a passing test · `as-built.md` exists · `architecture.md` was reconciled after the feature's last commit. Commits that only change `.azimuth/` (the as-built, the reconciliation, recorded decisions) don't count for either commit check.                                              |

Moves that undo or park work (back to draft, deferred, cancelled, verifying → in-progress) need a
reason, which goes into the feature's log. Approval records the spec hash and the commit it was
made at; if the spec changes later, the feature is flagged **modified since approval** and needs
re-approval (`azimuth reapprove`) before it can start.

Other lifecycles: tasks `todo → in-progress → done` (plus `blocked`/`skipped` with a note; a task
moves to in-progress or done only while its feature is in progress);
questions `open → answered` (or `obsolete`); decisions `proposed → accepted | rejected`, accepted
→ `superseded`, rejected → `proposed` (you, or an agent for a decision an agent rejected) and
accepted → `proposed` (you only, for a decision an agent accepted); milestones `planned → active → released`; issues `open → in-progress → resolved |
wontfix`.

## Autonomy

Azimuth is agent-first. In `config.yaml`:

```yaml
autonomy:
  approve_specs: auto # agents approve a spec once every gate check passes
  accept_adrs: auto # agents accept their own decisions
  strict: false # true: automatic approval also requires zero warnings
```

With `auto`, an agent that finishes a spec approves it and moves on to building; the gates still
apply. Every automatic approval of a spec and acceptance or rejection of a decision appears in your inbox as
**Review** until you acknowledge it or send it back (a spec to draft, a decision to proposed). Guardrails hold in every mode:

- Only you answer questions, release milestones and override gates.
- An agent can't accept a decision that resolves a question you haven't answered, or one that
  replaces a decision you accepted.
- The viewer always acts as you.

The CLI decides who is acting from `AZIMUTH_ACTOR` (`agent` or `you`), which the Claude Code
plugin sets for agent sessions; otherwise `CLAUDECODE=1` means an agent. Set `manual` to keep
approvals and acceptances for yourself.

## Derived values

The index (what the viewer and `azimuth status --json` read) adds values nobody writes:

| Value                   | Meaning                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| progress                | Tasks done or skipped out of all tasks.                                                                                    |
| coverage                | Per scenario: `passing`, `failing`, `not-run` (a test references it but no run has) or `untested` (no test references it). |
| blocks / blocked_by     | Reverse dependencies; open blocking questions; unfinished dependencies of approved or in-progress features.                |
| modified since approval | The spec's hash no longer matches the approved hash.                                                                       |
| stale                   | In progress with no activity for `stale_after_days`.                                                                       |
| file conflicts          | Two active features creating or modifying the same file.                                                                   |
| next gate               | The checks for the next forward move, each passing or failing with a detail.                                               |

## The inbox

What needs you, grouped by urgency:

- **High:** blocking questions, failing verify runs, specs changed since approval.
- **Normal:** non-blocking questions, specs ready for your approval and proposed decisions (both
  only in manual mode), validation errors.
- **Low:** stale work, and features or decisions an agent approved or accepted on its own, to
  acknowledge or send back.

## Traceability

- **Scenario → test:** test names start with the scenario ID (`it("S-005.1.2 …")`), or use
  `@pytest.mark.scenario("S-005.1.2")` or a `// scenario: S-005.1.2` comment. `azimuth trace`
  shows the matrix.
- **Verify run → scenarios:** a run records each covered scenario as passing or failing, from
  the scenario IDs and marked tests' function names its output shows (see
  [`azimuth verify`](cli.md#verify)); a JUnit report written to `$AZIMUTH_JUNIT` makes that exact
  per test.
- **Task → commit:** commits carry a `Refs: T-005.2` trailer.
- **Question → decision → feature:** a resolved question points at the ADR or feature that
  applied it.

## Sessions and live activity

Agents record each unit of work as a session: `azimuth session start`, progress notes with
`azimuth log`, a handoff with `azimuth session handoff`, and `azimuth session close`, which
collects the commits made meanwhile. The next session starts from the last handoff.

Independently, the Claude Code hooks record every tool call to a live log, so the viewer shows
what each agent is doing right now, and tell a running agent when you answer, review or move its
work. See [Claude Code integration](claude-code.md).

## Problems

`azimuth check` reports errors (the data is wrong: bad YAML, schema violations, broken links,
cycles, status edited by hand) and warnings (worth fixing: vague THEN clauses, paths outside the
architecture's modules, file conflicts, stale architecture). Entities with schema errors are left
out of the index until fixed. Agents run `check` after every edit; the plugin also reports to
Claude, right after the edit, any edit that leaves an `.azimuth/` file invalid.
