# Concepts

Azimuth manages a software project the way an agent-first team works: agents specify, build and
verify features; you set direction, answer questions and review what the agents decided. All
state lives in the repository under `.azimuth/`; the CLI validates it and moves it through gated
lifecycles; the viewer shows it live.

- [Entities](#entities)
- [Feature lifecycle and gates](#feature-lifecycle-and-gates)
- [Notes and placeholders](#notes-and-placeholders)
- [Autonomy](#autonomy)
- [Derived values](#derived-values)
- [Parallel tasks and shared files](#parallel-tasks-and-shared-files)
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
| Session          | `SES-20261018-1100`                  | The agent work of one Claude Code session: its goals, progress notes, summary and handoff.                          |
| Verify run       | `R-0142`                             | The recorded result of running a task's verify command.                                                             |

The [file format reference](file-format.md) describes every field.

## Feature lifecycle and gates

```
idea → draft → approved → in-progress → verifying → done
side states: deferred · cancelled · superseded
```

Every status change goes through `azimuth move` (or a viewer action), which checks the lifecycle
table, who is acting, and the gate for forward moves. A gate is a list of checks; all must pass.

| Move                    | Gate checks                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idea → draft            | Spec files written: impact, stories, contract and plan exist, with at least one story and one task.                                                                                                                                                                                                                                                               |
| draft → approved        | No errors in the feature · every story has a happy and a negative or edge scenario · every scenario has GIVEN, WHEN and THEN · every scenario is covered by a task · every task has a verify command · the spec is committed · no open blocking question · dependencies exist and form no cycle · size is not XL. (With `autonomy.strict`: no warnings either.)   |
| approved → in-progress  | The spec is unchanged since approval · every dependency is done (you may override this one with a reason).                                                                                                                                                                                                                                                        |
| in-progress → verifying | Every task is done or skipped with a note · no open blocking question.                                                                                                                                                                                                                                                                                            |
| verifying → done        | The latest verify run of every task passed at HEAD · every scenario has a passing test · no `{?}` placeholder is left in `stories.md` · `as-built.md` exists · `architecture.md` was reconciled after the feature's last commit. Commits that only change `.azimuth/` (the as-built, the reconciliation, recorded decisions) don't count for either commit check. |

For the done gate, a passing verify run stays current until a later commit changes a path the run
depends on: the task's `files`, the feature's impact paths with change create, modify or test
(each with everything under it), the paths of the modules that the modules holding the feature's
create and modify entries depend on (directly), and the files `verify.shared_paths` matches (root
build manifests such as `package.json` or `Cargo.lock` by default). Paths under `.azimuth/` never
count, and neither do the files `verify.ignore_paths` matches, even among the paths above. A task
without `files` in a feature without create, modify or test entries has no such paths, so any
later code commit outside those ignored files makes its run stale. A run is also stale after a later commit
whose changed files aren't known, and when its commit is older than the history the index reads
(`git.log_depth`). The check names the commit and the path that made a run stale, so close-out
reruns only those runs: `T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts`.

Moves that undo or park work (back to draft, deferred, cancelled, verifying → in-progress) need a
reason, which goes into the feature's log. Approval records the spec hash and the commit it was
made at; if the spec changes later, the feature is flagged **modified since approval** and needs
re-approval (`azimuth reapprove`) before it can start.

Other lifecycles: tasks `todo → in-progress → done` (plus `blocked`/`skipped` with a note; a task
moves to in-progress or done only while its feature is in progress);
questions `open → answered` (or `obsolete`; you can replace an agent's answer with yours); decisions `proposed → accepted | rejected`, accepted
→ `superseded`, rejected → `proposed` (you, or an agent for a decision an agent rejected) and
accepted → `proposed` (you only, for a decision an agent accepted); milestones `planned → active → released`; issues `open → in-progress → resolved |
wontfix`.

An agent builds each task in a loop: `azimuth move <T-ID> in-progress`, the tests and the code
(written by the agent itself, or by a subagent whose prompt is `azimuth brief <T-ID>`, built
from the records), then `azimuth task finish <T-ID> --commit "<message>"`. Finish commits the
task's changed files and the feature's changed records with a `Refs: <T-ID>` trailer, runs the
task's verify command and moves the task to done when the run passes; after a failed run the
commit stays and the task stays in progress (see [Finish a task](cli.md#finish-a-task)).

## Notes and placeholders

A build learns things the spec couldn't know. Two records keep them out of the approval, so
neither needs re-approval:

- **Notes.** `azimuth note <T-ID | F-ID> "<text>"` adds what a task taught to the feature's
  `notes.md`, which isn't part of the spec hash. The viewer shows notes in the As-built tab.
  Lessons go there rather than into `feature.md`, whose body is hashed.
- **Placeholders.** A THEN or AND line may write a value only the code can measure (a byte
  offset, a count) as `{?}`: the first passing test settles it. `azimuth settle <S-ID> "<value>"`
  turns the scenario's first `{?}` into `{=<value>}` and logs it. The hash reads every settled
  value as `{?}`, so settling changes nothing the approval covers. The done gate waits until no
  `{?}` is left, and the viewer marks settled and open values in the Stories tab.

Every other spec edit, such as correcting a THEN the code proved wrong, still makes the approval
stale.
Values an agent settles reach your inbox for review, whoever approved the spec (see
[The inbox](#the-inbox)).

## Autonomy

Azimuth is agent-first. In `config.yaml`:

```yaml
autonomy:
  approve_specs: auto # agents approve a spec once every gate check passes
  accept_adrs: auto # agents accept their own decisions
  questions: ask # proceed: agents take their own recommendation on non-blocking questions
  strict: false # true: automatic approval also requires zero warnings
```

With `auto`, an agent that finishes a spec approves it and moves on to building; the gates still
apply. Every automatic approval of a spec and acceptance or rejection of a decision appears in your inbox as
**Review** until you acknowledge it or send it back (a spec to draft, a decision to proposed).

With `questions: proceed`, a question an agent raises is answered with its recommendation as soon
as `azimuth new question` creates it, when it is not blocking and exactly one option is
recommended. The answer is marked as the agent's (`answer.by: agent`), the log of the feature
the question names notes it as an automatic decision, and the agent applies it and records it
with `azimuth resolve` like any answer. It is never reported to agents as your decision. It appears in your inbox as **Review**
until you acknowledge it or answer differently; your answer replaces the agent's, clears its
resolution and reaches the agent like any answer of yours. Blocking questions, questions you
raise and questions without one recommended option wait for you. Under `ask`, the default, every
question does.

Guardrails hold in every mode:

- Only you answer questions, release milestones and override gates. Under `questions: proceed`
  the project answers an agent's new question with the agent's own recommendation, but no agent
  can answer an open question or change an answer.
- An agent can't accept a decision that resolves an open question, or one that replaces a
  decision you accepted.
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
| file conflicts          | Two active features creating or modifying the same file, unless it is a shared file (below).                               |
| next gate               | The checks for the next forward move, each passing or failing with a detail.                                               |

## Parallel tasks and shared files

Ready tasks of one feature can be built at the same time, for example by subagents, when they
change different files. Some files grow with nearly every task: an enum and its dispatch, a
keymap, a list of commands. List them as globs in `config.yaml`:

```yaml
parallel:
  shared_files: [src/editor/input.rs, src/editor/action.rs, "keymaps/*.toml"]
```

A shared file is never a file conflict: `W-FILE-CONFLICT` and the index's file conflicts skip it.
Tasks that list it may run in parallel, each adding one complete insertion (a whole enum variant,
match arm or registry entry) and leaving the others' insertions alone. Azimuth doesn't check that
the edits are additive. The index carries the globs as `project.shared_files`.

For an in-progress feature, `azimuth next <F-ID>` groups the ready tasks that can run together
(see [Read](cli.md#read)). It takes them in its own order (in-progress tasks first, then todo
tasks, each in plan order) and adds each task to the first group in which no task lists one of
its files outside the shared list; otherwise the task starts a new group. Two tasks that list the
same unshared file never share a group. A task without `files` gets a group of its own, since
nothing says what it changes. Paths compare as written in `plan.md`.

When the whole group has reported, the agent finishes its tasks one at a time with
`azimuth task finish`. Each commits only its own task's files and the feature's records. A shared
file is staged whole: the first task finished that lists it commits it with every task's
insertions, and the next task's commit no longer sees it changed.

## The inbox

What needs you, grouped by urgency:

- **High:** blocking questions, failing verify runs, specs changed since approval.
- **Normal:** non-blocking questions, specs ready for your approval and proposed decisions (both
  only in manual mode), validation errors.
- **Low:** stale work; features or decisions an agent approved or accepted on its own, to
  acknowledge or send back; values an agent settled in a feature's scenarios since you last
  acknowledged the feature, whoever approved it, to acknowledge or send back (an automatic
  approval you haven't acknowledged lists them in its own item); and questions an agent answered
  with its recommendation, to acknowledge or answer differently.

## Traceability

- **Scenario → test:** test names start with the scenario ID (`it("S-005.1.2 …")`), or use
  `@pytest.mark.scenario("S-005.1.2")` or a `// scenario: S-005.1.2` comment. `azimuth trace`
  shows the matrix.
- **Verify run → scenarios:** a run records each covered scenario as passing or failing, from
  the scenario IDs and marked tests' function names its output shows (see
  [`azimuth verify`](cli.md#verify)); a JUnit report written to `$AZIMUTH_JUNIT` makes that exact
  per test.
- **Task → commit:** commits carry a `Refs: T-005.2` trailer, which `azimuth task finish` adds;
  a commit without one is linked by the IDs in its Conventional Commits scope
  (`feat(F-005): …`).
- **Question → decision → feature:** a resolved question points at the ADR or feature that
  applied it.

## Sessions and live activity

Agents record their work as sessions, one per Claude Code session. The first
`azimuth session start` creates it; each later start in the same Claude Code session (the next
skill, or an orchestrator moving from spec to build to verify) continues it and adds its goal.
Progress goes into `azimuth session note` (and `azimuth log` on the work items), and
`azimuth session handoff` writes the handoff, replacing the previous one. When the Claude Code
session ends (an exit, `/clear`, a resume of another session, a logout), the plugin closes the
Azimuth session and collects the commits made meanwhile; without the plugin,
`azimuth session close` does. The next session starts from the last handoff. Outside Claude Code,
each `session start` creates a session.

A session still open 12 hours after its start is reported as `W-SESSION-OPEN` and closed by
`azimuth session close --stale`, unless its Claude Code session wrote to its live log in the last
hour: a long session that is still working is left alone.

Independently, the Claude Code hooks record every tool call to a live log, so the viewer shows
what each agent is doing right now, and tell a running agent when you answer, review or move its
work. See [Claude Code integration](claude-code.md). Live logs are kept for 72 hours.

From its live log, each Claude Code session, its main agent and each subagent get a status. An
agent's is the first that applies:

| Status    | When                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `done`    | The session ended, or the subagent stopped.                                                                      |
| `waiting` | A permission prompt for one of its tool calls is open. It never expires.                                         |
| `done`    | No record for 30 minutes (idle, crashed or abandoned): the session's for the main agent, its own for a subagent. |
| `waiting` | The main agent only: its turn ended and it waits for your next prompt.                                           |
| `running` | Otherwise.                                                                                                       |

A permission prompt opens when Claude Code asks you to allow a call, and closes at the agent's
next tool call (a failed one too), for the main agent also at your next prompt or its turn end,
for a subagent at its stop, and for every agent when the session ends or restarts. A waiting
agent carries what it waits for and since when: `Permission prompt: Bash pnpm vitest run`, or
`Waiting for your next prompt`. The session is `waiting` when any agent has a permission prompt
open (the earliest is shown), else `running` when any agent runs, else `waiting` when the main
agent waits for your next prompt, else `done`. Each agent also carries its current action, its
start and end, its last five edits with the lines they added and removed, and its last 20 wait
spans. Statuses are worked out when the index is built; since an agent turns `done` by time
alone, the viewer's server works them out again every minute while a page is open.

## Problems

`azimuth check` reports errors (the data is wrong: bad YAML, schema violations, broken links,
cycles, status edited by hand) and warnings (worth fixing: vague THEN clauses, paths outside the
architecture's modules, file conflicts, stale architecture). Entities with schema errors are left
out of the index until fixed. Agents run `check` after every edit; the plugin also reports to
Claude, right after the edit, any edit that leaves an `.azimuth/` file invalid.
