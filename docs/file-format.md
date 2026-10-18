# File format reference

Everything Azimuth knows about a project lives in `.azimuth/` at the repository root. Files are
Markdown with YAML frontmatter (between `---` lines at the top), plus `config.yaml` and a
gitignored `cache/` directory. This page is the authoritative description of every file;
`azimuth check` enforces it.

- [Conventions](#conventions)
- [Layout](#layout)
- [`config.yaml`](#configyaml)
- [Project knowledge](#project-knowledge)
- [Milestones](#milestones)
- [Features](#features)
- [Decisions](#decisions)
- [Questions](#questions)
- [Issues](#issues)
- [Sessions](#sessions)
- [Cache](#cache)

## Conventions

| Topic          | Rule                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Encoding       | UTF-8. LF or CRLF line endings are both preserved on write.                                                                                                        |
| Frontmatter    | YAML between a first line `---` and the next `---`. Keys are snake_case.                                                                                           |
| Dates          | `YYYY-MM-DD` (`ISODate`).                                                                                                                                          |
| Timestamps     | ISO 8601 with an offset or `Z` (`2026-10-18T11:58:00Z`).                                                                                                           |
| Slugs          | kebab-case, at most 48 characters.                                                                                                                                 |
| File names     | `<ID>-<slug>.md`, except questions and sessions, which use the bare ID. Feature folders are `<ID>-<slug>/`.                                                        |
| Links          | Fields named `links`, `depends_on`, `touched`, `raised`, `resolves`, `refs` hold IDs. A bare ID in prose (`F-005`, `S-005.1.2`) is a mention; the viewer links it. |
| H1 headings    | An optional `# …` first heading in a body is a title for humans and is ignored.                                                                                    |
| Sections       | Named body sections are `## <Name>` headings; a section's content runs to the next `##` heading.                                                                   |
| Derived values | Progress, coverage, blocked state, reverse dependencies and inbox items are computed. Writing them into files is an error (`E-DERIVED-FIELD`).                     |
| Status changes | Only through `azimuth move` (or a viewer action). A status that does not match the latest transition in the log is reported as `E-STATUS-DRIFT`.                   |

### IDs

| Entity     | Format                                       | Example             |
| ---------- | -------------------------------------------- | ------------------- |
| Milestone  | `M-NN`                                       | `M-02`              |
| Feature    | `F-NNN`                                      | `F-005`             |
| Story      | `ST-NNN.n`                                   | `ST-005.1`          |
| Scenario   | `S-NNN.n.m`                                  | `S-005.1.2`         |
| Task       | `T-NNN.n`                                    | `T-005.4`           |
| Decision   | `ADR-NNNN`                                   | `ADR-0003`          |
| Question   | `Q-NNNN`                                     | `Q-0002`            |
| Issue      | `BUG-NNNN`, `DEBT-NNNN`, `RISK-NNNN`         | `BUG-0001`          |
| Session    | `SES-YYYYMMDD-HHMM` or `SES-YYYYMMDD-HHMM-n` | `SES-20261018-1100` |
| Verify run | `R-NNNN`                                     | `R-0142`            |

`azimuth new` allocates IDs under a project lock, so parallel agents never receive the same ID.
Story, scenario and task IDs are written by hand inside their feature's files; the `NNN` part
must match the feature.

## Layout

```
.azimuth/
  config.yaml
  PROTOCOL.md                  agent protocol, imported from CLAUDE.md
  project/
    vision.md
    architecture.md
    conventions.md
    glossary.md
  milestones/M-02-reliable-delivery.md
  features/F-005-retry-backoff/
    feature.md  impact.md  stories.md  contract.md  plan.md  log.md  as-built.md
  decisions/ADR-0003-full-jitter-backoff.md
  questions/Q-0002.md
  issues/BUG-0001-double-send-on-busy.md
  sessions/SES-20261018-1100.md
  templates/                   copies of the templates `azimuth new` uses
  cache/                       gitignored; see Cache
```

## `config.yaml`

```yaml
schema: 1
project:
  name: Hookline
  description: Self-hosted webhook delivery service.
  mode: brownfield # greenfield | brownfield
stack:
  languages: [typescript]
  package_manager: pnpm
  test_runner: vitest
  display: [TypeScript, Node 22, Fastify, SQLite] # shown in the viewer; defaults to languages
commands: # shown in the viewer; tasks carry their own verify commands
  build: pnpm build
  typecheck: pnpm tsc --noEmit
  test: pnpm vitest run
  lint: pnpm eslint .
tests:
  globs: ["src/**/*.test.ts", "test/**/*.test.ts", "!test/fixtures/**"] # ! excludes
git:
  log_depth: 500 # commits read for the index
  agent_pattern: Claude # Co-Authored-By text that marks a commit as agent-made
  arch_stale_after_commits: 10
autonomy:
  approve_specs: auto # auto | manual
  accept_adrs: auto # auto | manual
  strict: false # true: auto-approval also requires zero warnings
stale_after_days: 5
verify:
  timeout_seconds: 600
  output_tail_lines: 40
viewer:
  port: 4319
  autostart: true
  editor_url: null # e.g. "vscode://file/{abs}:{line}"; schemes: vscode, cursor, zed, idea, file
```

Every key except `project.name` has a default. Unknown keys produce `W-UNKNOWN-KEY`.

## Project knowledge

| File                      | Frontmatter                           | Body                                                                                               |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `project/vision.md`       | `updated`                             | Free Markdown. Suggested sections: Problem, Users, Goals, Non-goals, Success metrics, Constraints. |
| `project/architecture.md` | `updated`, `reconciled_at`, `modules` | Free Markdown.                                                                                     |
| `project/conventions.md`  | `updated`                             | Free Markdown.                                                                                     |
| `project/glossary.md`     | `updated`, `terms`                    | Optional prose.                                                                                    |

```yaml
# architecture.md
updated: 2026-09-27
reconciled_at: 4b7d0a2 # commit up to which this document describes the code
modules:
  - name: worker
    path: src/worker
    responsibility: Lease due deliveries, send them, record attempts
    depends_on: [store, signing]
```

```yaml
# glossary.md
updated: 2026-09-02
terms:
  - term: Lease
    definition: A time-bounded claim a worker holds on an in-flight delivery
    aliases: [lease_until]
```

## Milestones

`milestones/M-NN-<slug>.md`

```yaml
id: M-02
title: Reliable delivery
status: active # planned | active | released
target: 2026-11-15 # or null
released_at: null # set when released
goal: No event is silently lost.
```

The body is optional (scope notes, release notes). Features join a milestone through their own
`milestone` field.

## Features

A feature is a folder, `features/F-NNN-<slug>/`. An `idea` needs only `feature.md`; the other
spec files are required from `draft` on.

### `feature.md`

```yaml
id: F-005
title: Retry with exponential backoff
summary: Retry failed deliveries with exponential backoff until they succeed or give up.
status: in-progress # idea | draft | approved | in-progress | verifying | done | deferred | cancelled | superseded
priority: P0 # P0 | P1 | P2 | P3
size: M # S | M | L | XL, or null while an idea
mode: brownfield # greenfield | brownfield
milestone: M-02 # or null
depends_on: [F-003]
superseded_by: null # required when status is superseded
tags: [delivery, reliability]
created: 2026-10-02
updated: 2026-10-18
# Written by the approve transition only:
approved_at: 2026-10-09
approved_by: you # you | agent
approved_hash: sha256:9c1e… # spec hash at approval
approved_commit: c81e0d4 # HEAD at approval
review_ack_at: null # set when you acknowledge an automatic approval
overrides: [] # [{gate, reason, at}], written by `move --override`
```

Body sections, each mapped to the feature context:

```markdown
# F-005: Retry with exponential backoff

## Objective

## Out of scope

## Integration points

## Invariants

## Assumptions
```

Size guidance: S has at most 3 tasks, M 4–8, L 9–15. XL must be split before approval.

### `impact.md`

```yaml
files:
  - path: src/retry/policy.ts
    change: create # create | modify | read | test
    note: decideRetry(), computeDelay()
    symbols: [decideRetry, computeDelay] # optional
```

The body is optional narrative. A `modify` or `read` path that doesn't exist produces
`W-IMPACT-MISSING`. A path outside every architecture module produces `W-PATH`, except `test` paths and files at
the repository root (`package.json`, `tsconfig.json`), which configure the whole project. Two active features creating or modifying the same
file produce `W-FILE-CONFLICT`.

### `stories.md`

Stories and scenarios are parsed from headings. No frontmatter is required.

```markdown
## ST-005.1 · Schedule a retry after a failed attempt

**Intent:** As the delivery worker, I want each failed attempt turned into a scheduled retry so that transient receiver failures don't lose events.

### S-005.1.1 · Retries a 503 with exponential backoff {happy}

- **GIVEN** Delivery d1 is in_flight with attempt_count 2
- **AND** jitter is seeded to return its upper bound
- **WHEN** The receiver responds 503
- **THEN** d1.state = scheduled_retry, attempt_count = 3, next_attempt_at = now + 8 s
```

| Element          | Rule                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Story heading    | `## ST-NNN.n · <title>`. The separator may be `·`, `-`, `—` or `:`.                                                                                    |
| Intent           | A paragraph starting with `**Intent:**`.                                                                                                               |
| Scenario heading | `### S-NNN.n.m · <title> {kind}`, where kind is `happy`, `negative` or `edge`. The scenario ID must start with its story's number.                     |
| Clauses          | List items `**GIVEN**`, `**WHEN**`, `**THEN**`, each exactly once, in that order. `**AND**` items extend the clause before them (joined with " and "). |
| Vague THEN       | A THEN that says "is handled", "works correctly", "appropriate", "as expected" or "gracefully" produces `W-VAGUE`.                                     |

Every story needs at least one `happy` scenario and at least one `negative` or `edge`
scenario before approval.

### `contract.md`

Optional frontmatter `language: typescript` (otherwise the first fenced code block's language
is used). Each `## <title>` section becomes a contract section; the usual ones are
`Data structures`, `Public signatures`, `Errors` and `State transitions`. Write signatures and
types only, no implementation bodies. A `mermaid` block with `stateDiagram-v2` is rendered as a
diagram.

### `plan.md`

```yaml
tasks:
  - id: T-005.4
    title: Exhaustion & policy validation (red → green)
    status: in-progress # todo | in-progress | done | blocked | skipped
    after: [T-005.2] # tasks in this feature that must finish first
    covers: [S-005.2.1, S-005.2.2] # scenarios this task makes pass
    files: [src/retry/policy.ts, src/retry/policy.test.ts]
    verify: pnpm vitest run src/retry/policy.test.ts # exits 0 on success
    note: null # required when blocked or skipped
```

The body is optional free text for people and agents; Azimuth doesn't parse it or show it in the
viewer. The `after` graph must be acyclic, and every scenario must be covered by at least one task.

### `log.md`

Append-only. Each entry is a header line and a Markdown body:

```markdown
## 2026-10-09T08:40:00Z · you · transition

draft → approved

## 2026-10-18T11:58:00Z · agent · note · SES-20261018-1100

T-005.2 and T-005.3 done. T-005.4 is red as expected.

## 2026-10-19T09:00:00Z · agent · transition · SES-20261019-0900 · auto

draft → approved
```

| Part            | Values                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header          | `## <timestamp> · <actor> · <type>[ · <session>][ · auto]`                                                                                                                                                                     |
| actor           | `you` or `agent`                                                                                                                                                                                                               |
| type            | `note`, `transition` (written by `move`), `review` (your "request changes" comment), `override` (accepted when reading; Azimuth itself records an override in `feature.md` `overrides` and its reason in the transition entry) |
| auto            | Marks an automatic decision (autonomy `auto`).                                                                                                                                                                                 |
| Transition body | The first line starts with `<from> → <to>`; anything after it on that line or below is commentary.                                                                                                                             |

### `as-built.md`

Written at close-out.

```yaml
completed_at: 2026-10-20
files_changed:
  - { path: src/retry/policy.ts, change: create }
deviations:
  - { path: src/retry/jitter.ts, kind: unplanned-create, reason: Split out for testability }
follow_ups: [DEBT-0002]
```

Body sections: `## Summary`, `## Deviations`, `## Follow-ups`.

### Spec hash

`approved_hash` is `sha256:` plus the hex SHA-256 of the feature's spec content:
the `feature.md` body (not its frontmatter), then `impact.md`, `stories.md` and `contract.md`
in full. Each part is normalized (CRLF to LF, trailing whitespace removed from every line,
leading and trailing blank lines removed) and the parts are joined with a line containing only
`\u0000`. `plan.md` and `log.md` are not part of the hash, because task statuses and log
entries change during a build.

## Decisions

`decisions/ADR-NNNN-<slug>.md`

```yaml
id: ADR-0003
title: Per-delivery next_attempt_at with full-jitter exponential backoff
status: accepted # proposed | accepted | rejected | superseded
date: 2026-10-07
supersedes: ADR-0002 # or null
superseded_by: null # set on the older ADR when superseded
resolves: [Q-0001]
links: [F-005, F-004]
decided_by: you # you | agent, set when accepted or rejected
decided_at: 2026-10-07T12:35:00Z
decision_note: null # optional note from whoever accepted or rejected it; cleared when it goes back to proposed
review_ack_at: null
```

Body sections: `## Context`, `## Options`, `## Decision`, `## Consequences`. When you accept or
reject an ADR with a note, running agents get the note with your next prompt.

## Questions

`questions/Q-NNNN.md`

```yaml
id: Q-0003
title: Re-sign replayed payloads with the current or the original secret?
status: open # open | answered | obsolete
feature: F-008 # the feature this blocks when blocking; null for project-level questions
blocking: true
raised_by: SES-20261018-0930 # session ID or "you"
raised_at: 2026-10-18T10:12:00Z
links: [F-002] # related items, context only
options:
  - key: current
    label: Sign with the endpoint's current secret
    detail: Works after rotation.
    recommended: true
answer: null # {option, text, answered_at}; written by the answer action
resolution: null # {kind: assumption | adr, ref}; written by the agent that applies the answer
```

Body section: `## Context` (why the agent could not decide). Exactly one option should be
recommended.

## Issues

`issues/<ID>-<slug>.md`, for bugs, tech debt and risks.

```yaml
id: RISK-0001
type: risk # bug | debt | risk, matching the ID prefix
title: SQLite write contention above ~200 deliveries/s
status: open # open | in-progress | resolved | wontfix
severity: null # bug and debt: low | medium | high | critical
likelihood: medium # risk only: low | medium | high
impact: high # risk only: low | medium | high
links: [ADR-0001]
files: [src/store/db.ts]
found_by: you # session ID or "you"
created: 2026-10-15
resolved_at: null
```

Suggested body sections: bug `Repro`, `Expected`, `Actual`; debt `Problem`, `Proposed fix`;
risk `Scenario`, `Mitigation`. When a move is given a reason (required for `wontfix`), `azimuth
move` adds it to a `Status notes` section, created at the end of the body:

```markdown
## Status notes

- 2026-10-18T16:20:00Z · you · resolved → open: Still fails offline
```

## Sessions

`sessions/SES-YYYYMMDD-HHMM.md`, one per unit of agent work (usually one skill run).

```yaml
id: SES-20261018-1100
agent: claude-code
skill: build # or null
started_at: 2026-10-18T11:00:00Z
ended_at: 2026-10-18T11:58:00Z # set by `azimuth session close`
goal: Build F-005 tasks T-005.2 to T-005.4
touched: [F-005, T-005.2, T-005.3, T-005.4]
commits: [a41f2b9, 6c0e3d8, 9f3c2e1] # filled by `session close`
raised: [Q-0002, ADR-0004]
```

Body sections: `## Summary` and `## Handoff` (next steps for whoever continues).

## Cache

`.azimuth/cache/` is local state and is gitignored. In a linked git worktree, the write lock, ID
marks, live logs, viewer files and hook log are kept in the main worktree's `.azimuth/cache/`, so
every worktree of a repository shares them; live logs untouched for 24 hours are deleted.

| Path                          | Contents                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `index.json`                  | The last built index.                                                                       |
| `runs/R-NNNN.json`            | One verify run (see below).                                                                 |
| `live/<claude-session>.jsonl` | Live agent activity recorded by the Claude Code hooks, one JSON event per line.             |
| `ids.json`                    | High-water marks for allocated IDs, so deleted IDs are never reissued.                      |
| `viewer.json`                 | The running viewer server: `pid`, `port`, `instance`, `version`, `root`.                    |
| `write.lock`                  | Held while a command writes files.                                                          |
| `viewer.lock`                 | Held briefly while a session starts the viewer.                                             |
| `hooks.log`                   | Errors from Claude Code hooks (hooks never block a session; `azimuth doctor` reports them). |

A verify run (`scenarios` comes from a JUnit report the command wrote to `$AZIMUTH_JUNIT`, or else from the run's outcome):

```json
{
  "id": "R-0142",
  "target": "T-005.4",
  "command": "pnpm vitest run src/retry/policy.test.ts",
  "ok": false,
  "exit_code": 1,
  "duration_ms": 2140,
  "at": "2026-10-18T11:56:00Z",
  "commit": "9f3c2e1",
  "output_tail": "FAIL src/retry/policy.test.ts > S-005.2.1 …",
  "scenarios": [{ "id": "S-005.2.1", "status": "failing" }],
  "junit": { "tests": 3, "failures": 1, "errors": 0, "skipped": 0 }
}
```
