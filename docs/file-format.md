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
    feature.md  impact.md  stories.md  contract.md  plan.md  log.md  notes.md  as-built.md
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
  mode: brownfield # greenfield: a new project, the docs describe the plan | brownfield: existing code
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
  arch_stale_after_commits: 10 # W-ARCH-STALE after this many code commits (not .azimuth/-only)
autonomy:
  approve_specs: auto # auto | manual
  accept_adrs: auto # auto | manual
  questions: ask # ask | proceed: agents take their own recommendation on non-blocking questions
  strict: false # true: auto-approval also requires zero warnings (hints aside)
stale_after_days: 5
verify:
  timeout_seconds: 600
  output_tail_lines: 40
  # Files every verify run depends on (globs); replaces the default list, [] turns it off
  shared_paths:
    [package.json, pnpm-lock.yaml, Cargo.toml, Cargo.lock, go.mod, go.sum, pyproject.toml, uv.lock]
  ignore_paths: [] # e.g. [README.md, "docs/guides/**"]
  prebuild: null # e.g. "cargo test --workspace --no-run"; null or blank: none
  build_timeout_seconds: 1800
  prebuild_failure: stop # stop | continue: each task's command still runs after a failed prebuild
  min_free_gb: 10 # verify, task finish and doctor warn below this much free disk (GB); 0: off
parallel:
  # Files tasks extend additively (globs); tasks listing them may run in parallel
  shared_files: [] # e.g. [src/routes/index.ts, "keymaps/*.toml"]
viewer:
  port: 4319
  autostart: true
  editor_url: null # e.g. "vscode://file/{abs}:{line}"; schemes: vscode, cursor, zed, idea, file
```

Every key except `project.name` has a default. Unknown keys produce `W-UNKNOWN-KEY`.

`verify.shared_paths` lists the files outside a task's own paths whose change makes its verify
runs stale for the done gate. The globs use the `tests.globs` syntax without `!` and match
repo-relative paths, so `Cargo.toml` matches the root file only and `crates/*/Cargo.toml` the
manifest of each crate. The example shows the default.

`verify.ignore_paths` lists the files whose change never makes a verify run stale, such as a
README or guides the code doesn't use. It wins over a task's own paths and its feature's impact
paths, and uses the same glob syntax as `verify.shared_paths`. The default is `[]`. Don't list a
docs file the code reads, whether bundled into a build or loaded at runtime: its change can
change what the tests check.

`verify.prebuild` is a command `azimuth verify` runs once per call, from the project root, before
the first task's verify command, so a build every command needs runs once instead of in each.
`verify.build_timeout_seconds` is its timeout; `verify.timeout_seconds` applies to each task's
command alone.

`verify.prebuild_failure` says what a prebuild that exits non-zero does. `stop`, the default,
runs no command and records no run. `continue` runs each task's command anyway, under
`verify.build_timeout_seconds` plus `verify.timeout_seconds`, since it now builds what the
prebuild would have; each run records `"prebuild": { "ok": false, … }`, and the done gate asks
for a rerun with a working build (`T-006.2 passed after a failed prebuild`). A prebuild that times
out or is interrupted records no run under either. Any other value is an `E-SCHEMA` problem
(`verify.prebuild_failure must be stop or continue.`) and keeps `stop`.

`verify.min_free_gb` is the free space, in GB (10^9 bytes), below which `azimuth verify` and
`azimuth task finish` print a warning on stderr before running and `azimuth doctor` shows a `?`
line. It reads the free space an unprivileged user can write on the project root's filesystem,
and never blocks anything or changes an exit code. `0` turns it off, so nothing reads the disk.
It must be a whole number ≥ 0 (`verify.min_free_gb must be a whole number ≥ 0.`); the default is
`10`.

`parallel.shared_files` lists the files that tasks extend with one complete insertion each, such
as an enum and its dispatch or a keymap. The globs use the `tests.globs` syntax without `!` and
match paths as written in `impact.md` and `plan.md`, so `keymaps/*.toml` matches
`keymaps/default.toml` but not `keymaps/vim/extra.toml`. A matching path is never a file conflict (`W-FILE-CONFLICT`, the
index's `file_conflicts`), and tasks listing it may run at the same time (see
[Parallel tasks and shared files](concepts.md#parallel-tasks-and-shared-files)). The index
carries the list as `project.shared_files`. The default is `[]`.

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

A module's `path` covers the path itself, everything under it, and a file named after it with
any extension, so `src/buffer` covers `src/buffer.rs`, `src/buffer.ts` and `src/buffer/gap.rs`.
`depends_on` lists other modules by `name`. Files a feature creates or changes outside every
module produce `W-PATH`, except files at the repository root and tests.

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
tag: null # optional: the tag given to azimuth release --tag
released_commit: null # optional: the 7-character SHA recorded at release
```

The body is optional (scope notes, release notes). Features join a milestone through their own
`milestone` field.

`tag` and `released_commit` are written only by a release (`azimuth release` or the viewer's
Release), which sets both every time and appends them after the other keys when the file lacks
them. `tag` is the `--tag` name, else `null`. `released_commit` is the tag's commit when git has
the tag, else HEAD's, else `null` (outside git or before the first commit). A file without them
reads both as `null`, so a milestone released before 0.3.1 has neither. Both are read as text: a
SHA of digits only is written quoted, and one written without quotes still reads as text.
`azimuth move M-02 released` sets only `status` and `released_at`. Neither key is in the
milestone template, and a 0.3.0 reader warns `W-UNKNOWN-KEY` for both.

A planned or active milestone with at least one feature, every one of them done, produces
`W-MILESTONE-READY` on its file. Cancelled and superseded features don't count; a deferred one
counts and isn't done. `azimuth next` lists such a milestone after critical issues and before
feature work, as `Ask the user to release M-02 in the viewer`: only the user releases a milestone.

A planned milestone that isn't ready but has work started (a counted feature in progress,
verifying or done) produces `W-MILESTONE-PLANNED` on its file, whose message gives
`azimuth move M-02 active`. A milestone gets at most one of the two warnings. Moving a feature to
in-progress moves its planned milestone to active, which rewrites only the milestone's `status`
line.

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
review_ack_at: null # set when you acknowledge an automatic approval or values an agent settled
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
file produce `W-FILE-CONFLICT`, unless the file matches `parallel.shared_files`.

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
| Measured value   | In a draft, a THEN or AND line holding what looks like a measured value produces the hint `W-MEASURED` (see [Placeholders](#placeholders)).            |

Every story needs at least one `happy` scenario and at least one `negative` or `edge`
scenario before approval. `azimuth check` warns about a story without them (`W-NO-NEGATIVE`) as
soon as the feature has stories, while it is still an idea too.

#### Placeholders

A value only the code can measure (a byte offset, a count) may be written `{?}` in a THEN or AND
line: the first passing test settles it. `azimuth settle <S-ID> "<value>"` replaces the
scenario's first `{?}` with `{=<value>}` and changes no other character of the file:

```markdown
### S-005.1.2 · Finds the heading {happy}

- **GIVEN** the text `# Hi` after a BOM
- **WHEN** it is parsed
- **THEN** the heading starts at byte {?}
- **AND** it ends at byte {=30}
```

| Rule        | Detail                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open        | `{?}`.                                                                                                                                                                                                                    |
| Settled     | `{=`, a value of at least one character without `{`, `}` or line breaks, then `}`. `{=}` and other braces are plain text.                                                                                                 |
| Where       | In the lines after a scenario's heading, up to the next `##` or `###` heading, in code spans too. Not in fenced code blocks, and not outside every scenario.                                                              |
| Other files | Only `stories.md` has placeholders; `{?}` in the other spec files is plain text.                                                                                                                                          |
| Done gate   | `done.placeholders-settled` fails while a scenario holds a `{?}` and names those scenarios.                                                                                                                               |
| Hand edits  | The [spec hash](#spec-hash) reads every settled value as `{?}`, so writing or changing a `{=…}` by hand doesn't make the approval stale, and leaves no log entry for you to review. `azimuth settle` is the recorded way. |

While the feature is a draft, `azimuth check` points at values that look measured. A THEN line,
or an AND line after it, that holds a range of digits (`9..12`, `2..=5`), or a name starting with
`offset`, `caret`, `byte`, `column` or `position` in any case, followed by a number or range
(`caret: 24`, `position = 7`, `byte_range: 34..39`, `offset: Some(63)`), produces
`W-MEASURED`, once per line. If only the code can measure the value, write `{?}` instead. Open and
settled placeholders never count, and neither do GIVEN and WHEN lines with the AND lines after
them, `byte-for-byte` or function names such as `byte_to_char(5)`. `W-MEASURED` is a hint (see
[Problems](concepts.md#problems)): `autonomy.strict` doesn't count it, and it goes away at
approval.

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

While the feature is a draft, a task with empty `covers` produces the hint `W-NO-COVERS`, unless
it lists files and every one ends in `.md` (a task that only documents). It is fine to leave on a
task that only scaffolds or wires, and goes away at approval.

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
| auto            | Marks an automatic decision: one made under autonomy `auto`, or a `note` that an agent's question was answered with its recommendation (`questions: proceed`).                                                                 |
| Transition body | The first line starts with `<from> → <to>`; anything after it on that line or below is commentary.                                                                                                                             |
| Settle body     | `azimuth settle` writes a `note` whose body is exactly `Settled <S-ID>: {=<value>}`. An agent's settle entries after `review_ack_at` (all of them while it is `null`) are values for you to review in the inbox.               |

### `notes.md`

Optional. What a build taught, one section per note, written by `azimuth note`:

```markdown
# F-005: Notes

### T-005.2 · 2026-10-20

The heading starts at byte 17: the parser counts the BOM.

### F-005 · 2026-10-21

Split the parser in two.
```

The first note creates the file with its `# <F-ID>: Notes` title. Each note adds a
`### <T-ID or F-ID> · <date>` heading (UTC date) and the text. Azimuth doesn't parse it further,
so you can edit it by hand. It isn't part of the [spec hash](#spec-hash), so notes never make the
approval stale. The index carries it without its first `# ` title line, trimmed, as the feature
detail's `notes`; `null` when the file is missing or holds nothing else.

### `as-built.md`

Written at close-out: [`azimuth as-built <F-ID>`](cli.md#change) drafts it from the feature's
commits and `impact.md`, then the agent writes the reasons, the body and the follow-ups.

```yaml
completed_at: 2026-10-20
files_changed:
  - { path: src/retry/jitter.ts, change: create }
  - { path: src/retry/policy.ts, change: create }
deviations:
  - { path: src/retry/jitter.ts, kind: unplanned-create, reason: Split out for testability }
  - { path: src/retry/policy.ts, kind: clarification, reason: Reads the policy lazily }
follow_ups: [DEBT-0002]
```

`files_changed` lists each path the feature's commits changed outside `.azimuth/`, relative to
the repository root as git prints it, once, sorted by path. Its `change` sums up the path's
changes, oldest first: `delete` when the last one deleted it (a file created and deleted again is
a delete), else `create` when the first one added it, else `modify`. A rename counts as a delete
of the old path and a create of the new one.

`deviations` lists where the build differs from `impact.md`, each with a `reason` that says why.
`azimuth as-built` generates four kinds, sorted by path, against the `create`, `modify` and `test`
rows (a row naming a directory covers every file under it; a `read` row plans no change):

| Kind                | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| `unplanned-create`  | The commits created a path that no row plans            |
| `unplanned-modify`  | The commits modified a path that no row plans           |
| `unplanned-delete`  | The commits deleted a path that no row plans            |
| `planned-unchanged` | No commit changed the row's path, nor any file under it |

Any other kind (`clarification`, `test-change` and the like) is written by hand, for a difference
the files don't show: a changed interface, a corrected test.

A rerun of `azimuth as-built` recomputes `files_changed` and the generated deviations, and keeps
the rest: a generated deviation keeps the reason already written for the same path and kind, one
that no longer applies is dropped with its reason, and the hand-written deviations follow the
generated ones in their order. `follow_ups`, the body, the BOM and the line endings are kept.
`completed_at` becomes the run's date (UTC), except that a `done` feature keeps the one it has.
The frontmatter is written whole, so other keys and comments in it are dropped.

The done gate needs a non-blank `reason` on every deviation, whatever its kind; its detail names
each one without (`No reason for src/retry/jitter.ts (unplanned-create)`). An `as-built.md` that
doesn't parse fails it too (`as-built.md has errors (see azimuth check F-005)`).

Body sections: `## Summary` (what was built and how), `## Deviations`, `## Follow-ups`.

### Spec hash

`approved_hash` is `sha256:` plus the hex SHA-256 of the feature's spec content:
the `feature.md` body (not its frontmatter), then `impact.md`, `stories.md` and `contract.md`
in full. Every settled value (`{=…}`) in `stories.md` is first replaced by `{?}`, so
[settling a placeholder](#placeholders) never changes the hash. Each part is normalized (CRLF to
LF, trailing whitespace removed from every line, leading and trailing blank lines removed) and
the parts are joined with a line containing only `\u0000`. `plan.md`, `log.md` and `notes.md`
are not part of the hash, because task statuses, log entries and notes change during a build.

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
raised_by: SES-20261018-0930 # session ID, or "you" / "agent" outside a session
raised_at: 2026-10-18T10:12:00Z
links: [F-002] # related items, context only
options:
  - key: current
    label: Sign with the endpoint's current secret
    detail: Works after rotation.
    recommended: true
answer: null # {option, text, answered_at, by}; written by the answer action
resolution: null # {kind: assumption | adr, ref}; written by the agent that applies the answer
review_ack_at: null # set when you acknowledge an agent's answer
```

Body section: `## Context` (why the agent could not decide). Exactly one option should be
recommended.

`answer.by` is `you` or `agent`; an answer without `by` (written before Azimuth recorded it) is
yours. Under `autonomy.questions: proceed`, `azimuth new question` run by an agent answers a
non-blocking question with exactly one recommended option at once, with that option and an empty
`text`:

```yaml
status: answered
answer:
  option: a
  text: ""
  answered_at: 2026-10-20T09:00:00Z
  by: agent
review_ack_at: 2026-10-20T10:00:00Z # absent until you acknowledge it
```

When the question names a feature, the feature's log gets a `note` marked `auto`:
`Q-0001 answered with its recommendation: Lockfile`. When you answer such a question
differently, your answer replaces the agent's (`by: you`) and `resolution` goes back to `null`;
`review_ack_at` stays as it was.

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
found_by: you # session ID, or "you" / "agent" outside a session
created: 2026-10-15
resolved_at: null
```

Suggested body sections: bug `Repro`, `Expected`, `Actual`; debt `Problem`, `Proposed fix`;
risk `Scenario`, `Mitigation`. When a move is given a reason (required for `wontfix`), `azimuth
move` adds it to a `Status notes` section, created at the end of the body.
`azimuth log <ID> "<text>"` adds a progress note there too, as `<time> · <actor> · <text>`:

```markdown
## Status notes

- 2026-10-18T16:20:00Z · you · resolved → open: Still fails offline
- 2026-10-18T17:05:00Z · agent · Fails only offline
```

## Sessions

`sessions/SES-YYYYMMDD-HHMM.md`, one per Claude Code session (outside Claude Code, one per
`azimuth session start`).

```yaml
id: SES-20261018-1100
agent: claude-code
skill: build # or null
started_at: 2026-10-18T11:00:00Z
ended_at: 2026-10-18T11:58:00Z # set when the Claude Code session ends, or by `session close`
goal: Build F-005 tasks T-005.2 to T-005.4
touched: [F-005, T-005.2, T-005.3, T-005.4]
commits: [a41f2b9, 6c0e3d8, 9f3c2e1] # filled when the session closes
raised: [Q-0002, ADR-0004]
```

Body sections: `## Summary` and `## Handoff` (next steps for whoever continues), and, once they
have entries, `## Goals` and `## Notes`. Goals holds one `- HH:MM · <skill> · <goal>` bullet
(`- HH:MM · <goal>` without a skill) for each later `session start` that continued the session;
the first goal stays in `goal`. Notes holds one `- HH:MM · <text>` bullet per `session note`.
Bullet times are UTC, and each goal or note is kept to one line.

## Cache

`.azimuth/cache/` is local state and is gitignored. In a linked git worktree, the write and verify
locks, ID marks, live logs, viewer files and hook log are kept in the main worktree's
`.azimuth/cache/`, so every worktree of a repository shares them. When a Claude Code session
starts, live logs and their sidecars untouched for 72 hours are deleted, except those of a Claude
Code session whose Azimuth session (the sidecar's `ses`, else the log's last `session` record) is
still open. Kept files aren't touched, so their age still shows the session's last activity.

| Path                              | Contents                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `index.json`                      | The last built index.                                                                       |
| `runs/R-NNNN.json`                | One verify run (see below).                                                                 |
| `live/<claude-session>.jsonl`     | Live agent activity recorded by the Claude Code hooks, one JSON event per line.             |
| `live/<claude-session>.meta.json` | Its sidecar, rewritten whole: `started_at`, `ses` (the Azimuth session), `transcript_path`. |
| `ids.json`                        | High-water marks for allocated IDs, so deleted IDs are never reissued.                      |
| `viewer.json`                     | The running viewer server: `pid`, `port`, `instance`, `version`, `root`.                    |
| `write.lock`                      | Held while a command writes files.                                                          |
| `verify.lock`                     | Held while `azimuth verify` runs; another verify waits unless the holder has exited.        |
| `viewer.lock`                     | Held briefly while a session starts the viewer.                                             |
| `hooks.log`                       | Errors from Claude Code hooks (hooks never block a session; `azimuth doctor` reports them). |

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
  "junit": { "tests": 3, "failures": 1, "errors": 0, "skipped": 0 },
  "waited_ms": 0,
  "ses": "SES-20261018-1100",
  "prebuild": { "ok": true, "duration_ms": 41200 }
}
```

`waited_ms` is how long the `azimuth verify` call waited for another one before it started, and
`ses` the session current when the run was made (`null` outside a session). Runs recorded before
Azimuth wrote these keys don't have them.

`prebuild` is the `verify.prebuild` that ran before the run in the same call: whether it passed
and how long it took. `ok` is `false` only under `verify.prebuild_failure: continue`. It is `null`
when no prebuild ran (none set, a blank command, `--no-prebuild`). A run file without the key, or
with a value that isn't an object with a boolean `ok` and a number `duration_ms` ≥ 0, reads as
`null`, with no problem.

`azimuth runs <T-ID|F-ID>` lists a task's or feature's run files newest first, and
`azimuth show R-NNNN` prints one of them whole.

A live log is append-only: each line is one record with a `kind` and its time `at` (UTC, whole
seconds). `agent_id` is a subagent's ID, or `null` for the main agent.

| `kind`          | Written by                                            | Other fields                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start`         | SessionStart                                          | `source` (`startup`, `resume`, `clear`, `compact`, or `init` when `azimuth init` ran in the session), `pid` (Claude Code's process ID)                                                                                                                       |
| `prompt`        | UserPromptSubmit                                      | `pid`                                                                                                                                                                                                                                                        |
| `tool`          | PostToolUse, PostToolUseFailure                       | `tool`, `file`, `summary`, `agent_id`, `agent_type`; the Agent tool: `tool_use_id` and `spawned` (the subagent it started); Edit, MultiEdit and Write: `added` and `removed` (lines), when known; a failed call: `failed: true` and `error` (its first line) |
| `wait`          | PermissionRequest, Notification (`permission_prompt`) | `source` (`permission` or `notification`), `reason`, `tool` and `target` (`null` for a notification), `agent_id` (`null` for the main agent, or for a notification whose agent is unknown)                                                                   |
| `launch`        | PreToolUse (Agent)                                    | `tool_use_id`, `description`, `refs` (the task and feature IDs it names)                                                                                                                                                                                     |
| `subagent`      | SubagentStart                                         | `agent_id`, `agent_type`                                                                                                                                                                                                                                     |
| `subagent-stop` | SubagentStop                                          | `agent_id`, `transcript_path` (the subagent's transcript, or `null`)                                                                                                                                                                                         |
| `stop`          | Stop                                                  |                                                                                                                                                                                                                                                              |
| `end`           | SessionEnd                                            | `reason`                                                                                                                                                                                                                                                     |
| `session`       | `azimuth session start`                               | `ses` (the Azimuth session)                                                                                                                                                                                                                                  |
| `cursor`        | PostToolUse, UserPromptSubmit                         | `scope` (`wake` or `prompt`), `keys`: how far your viewer actions have been reported to the agent                                                                                                                                                            |

```json
{"kind":"wait","at":"2026-10-20T10:02:00Z","source":"permission","reason":"Permission prompt: Bash pnpm vitest run","tool":"Bash","target":"pnpm vitest run","agent_id":null}
{"kind":"tool","at":"2026-10-20T10:03:00Z","tool":"Edit","file":"src/a.ts","summary":"Edited src/a.ts","agent_id":"a1","agent_type":"general-purpose","added":2,"removed":1}
{"kind":"tool","at":"2026-10-20T10:04:00Z","tool":"Bash","file":null,"summary":"pnpm build","agent_id":null,"agent_type":null,"failed":true,"error":"Exit code 1"}
{"kind":"subagent-stop","at":"2026-10-20T10:05:00Z","agent_id":"a1","transcript_path":"/Users/me/.claude/projects/-Users-me-shop/c1/subagents/agent-a1.jsonl"}
```

A wait's `reason` is `Permission prompt: <tool> <target>` for PermissionRequest and
`Permission prompt: <message>` for a notification. Records written by older versions lack the
newer fields, and their edits count as unknown sizes. The index derives each agent's status from
these records (see [Sessions and live activity](concepts.md#sessions-and-live-activity)).
