# CLI reference

`azimuth` reads and changes the project in the nearest folder containing `.azimuth/config.yaml`
(walking up from the current directory, or from `--root <dir>`). Every command accepts `--help`;
`azimuth --version` prints the version.

| Exit code | Meaning                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Success                                                                                                                                                                                       |
| `1`       | Refused: a gate failed, a policy forbade it, the move isn't allowed, a required `--reason` is missing, the ID doesn't exist, the target changed, the project is busy, or `check` found errors |
| `2`       | Usage error: unknown command, missing or invalid arguments, no project found, or an unknown ID in `show` or `next`                                                                            |
| `3`       | Internal error, or the launcher could not find Node 20+ or the built CLI                                                                                                                      |

Read commands, write commands, `init` and `view --detach` accept `--json`. Who is acting comes from `AZIMUTH_ACTOR` (`agent` or
`you`; Claude Code sessions set `agent`), else `CLAUDECODE=1` means an agent, else you. The
current session comes from `AZIMUTH_SESSION`, or from the Azimuth session of this Claude Code
session, which its sidecar (`cache/live/<claude-session>.meta.json`) keeps while that Azimuth
session is open, so a resumed conversation continues it. After it is closed, `session note` and
`session handoff` still write to it and `session start` opens a new one.

## Set up

### `azimuth init [--refresh]`

Creates `.azimuth/` in the current directory: `config.yaml` with the detected stack and commands
(package.json scripts and lockfiles, pyproject/uv, Cargo, Go), project knowledge stubs,
`PROTOCOL.md` and templates. It also adds an Azimuth block to `CLAUDE.md` (importing the protocol)
and `AGENTS.md`, `.azimuth/cache/` to `.gitignore`, `.azimuth/` to `.prettierignore` when Prettier
is used, and `AZIMUTH_ACTOR=agent` to `.claude/settings.json`. `--refresh` rewrites only the
protocol, templates and the CLAUDE.md/AGENTS.md blocks.

### `azimuth doctor [--print-path]`

Checks Node, the Claude Code plugin, validation errors, the CLAUDE.md import, hook activity, the
viewer and the free space on the project's disk. The disk line reads
`✓ 120.5 GB free on the project's disk (verify.min_free_gb: 10)`. When the free space is below
`verify.min_free_gb` or can't be read, it is a `?` line, which doesn't make doctor exit 1:
`? Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10)` or
`? Could not read the free space on the project's disk: <error>`. With `min_free_gb: 0` it is
left out. Inside Claude Code the hook check is about that session: it fails when Azimuth's hooks
haven't run in it (it started before the plugin was enabled). Records that `azimuth session start`
writes itself never count as hook activity. `--print-path` prints an `ln -s` line that links `azimuth` into `~/.local/bin` (which must
be on your PATH).

## Read

| Command                                     | Output                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azimuth status [--brief \| --json]`        | What needs you, work in flight, open high and critical issues, what's next, problem counts. `--json` prints the whole index. Outside a project, `--brief` says so and exits 0.                                                                                       |
| `azimuth show <ID> [--brief \| --json]`     | One entity. For a feature: its gate checks, tasks with last runs, open questions, unapplied answers, change requests and recent log. For a milestone: its features by status and whether it is ready. For a verify run: its fields and output tail (below).          |
| `azimuth next [F-ID] [--json]`              | The highest-priority unblocked work across the project (critical bugs and debt, then milestones ready for you to release, then feature work by status and priority, then high-severity ones), or a feature's ready tasks; each shows which can run together (below). |
| `azimuth check [ID…] [--warnings] [--json]` | Validation problems (all, or those concerning the given IDs). Every error is listed; without an ID or `--warnings`, warnings are only counted by code on one line. `--json` lists every problem. Exit 1 when there are errors.                                       |
| `azimuth trace [F-ID] [--all] [--json]`     | Scenario → test coverage (below). References that only mention a scenario ID (outside a test name or marker) are hidden and counted on the last line; `--all` shows them, marked `(mention)`, and `--json` keeps them.                                               |
| `azimuth runs <ID> [--limit N] [--json]`    | A task's or feature's verify runs, newest first: when, at which commit, the outcome and how long it took (below).                                                                                                                                                    |
| `azimuth brief <T-ID> [--json]`             | The prompt for a subagent building the task, in Markdown, from the records alone (below). `--json` prints `{task, feature, text}`.                                                                                                                                   |
| `azimuth docs [formats\|concepts\|cli]`     | Prints this reference: the file formats, the concepts, or this page. It is bundled into the CLI, so agents read it instead of Azimuth's code.                                                                                                                        |
| `azimuth index [--out <file>]`              | Writes the index JSON (default `.azimuth/cache/index.json`).                                                                                                                                                                                                         |

`azimuth next <F-ID>` on an in-progress feature with two or more ready tasks ends with one line
per group of them. The tasks of a group list no common file outside `parallel.shared_files`, so
they can run together (see
[Parallel tasks and shared files](concepts.md#parallel-tasks-and-shared-files)); a group of one
prints as `On its own`:

```
T-005.2 azimuth move T-005.2 in-progress
  F-005, covers S-005.2.1
T-005.3 azimuth move T-005.3 in-progress
  F-005, covers S-005.3.1
T-005.4 azimuth move T-005.4 in-progress
  F-005, covers S-005.4.1
Can run together: T-005.2, T-005.3 (shared: src/registry.ts)
On its own: T-005.4
```

`(shared: …)` names the shared files that two or more of the group's tasks list, and is left out
when there are none. With an F-ID, `--json` prints `{items, groups}`: `items` is the list the
command prints, and `groups` a list of `{tasks, shared}`, `[]` unless the feature is in progress.
Without an ID, `--json` prints the array of items.

Without an ID, when at least two in-progress features have ready tasks, the output ends with a
line `Across <F-IDs>:` and the groups of all their ready tasks together, in the form above, so
tasks of different features can run side by side. A feature held by an open blocking question is
left out, as it is from the list. The features come by priority, then ID, and each one's tasks
in progress first, then in plan order. At most six group lines are printed, then
`… and <n> more`; `--json` leaves the groups out. Here T-002.2 lists a file T-001.1 lists:

```
T-001.1 azimuth move T-001.1 in-progress
  F-001
T-002.1 azimuth move T-002.1 in-progress
  F-002
T-002.2 azimuth move T-002.2 in-progress
  F-002
Across F-001, F-002:
Can run together: T-001.1, T-002.1
On its own: T-002.2
```

`azimuth trace` marks a test `(uncommitted)` when it is only in the working tree: its file is
modified, staged or untracked, and HEAD's copy of the file has no test with the same scenario ID
and name. A test whose body changed still counts as committed; one whose name changed doesn't
until the change is committed. The done gate doesn't count an uncommitted test (see
[Traceability](concepts.md#traceability)), so commit its file first. A mention shown with `--all`
can carry both marks: `(mention) (uncommitted)`. Without git, every test counts as committed.

```
$ azimuth trace F-001
S-001.1.1 passing Scenario
    test/keymap.test.ts: S-001.1.1 opens the palette
S-001.1.2 passing Scenario
    test/keymap.test.ts: S-001.1.2 lists keys in every preset (uncommitted)
```

`--json` prints one row per scenario (`feature`, `scenario`, `title`, `status`, `tests`), and
every test carries `committed`, `false` for one marked `(uncommitted)`.

`azimuth runs <T-ID|F-ID>` lists the verify runs of a task, or of a feature (its tasks, tasks
since removed from the plan, and the feature itself), newest first. Each line gives the run's
`at`, its commit (`no commit` when there was none), the outcome and duration as `verify` prints
them, the wait for another verify (rounded up, when there was one) and the prebuild that served
it. For a feature, the run's target follows its ID. It prints at most 20 runs unless `--limit N`
(a whole number of at least 1) says otherwise, then `… and <n> older`. A known task or feature
without runs prints `No verify runs for T-005.4 yet.` and exits 0. An ID of another kind, an
unknown ID, or a feature with no tasks and no runs exits 1. `--json` prints the array of run
records, newest first and cut to the limit, without their `output_tail`.

```
$ azimuth runs T-005.4
R-0142 2026-10-18T11:56:00Z 9f3c2e1 failed (exit 1) in 2.1s, prebuild passed in 41.2s
R-0137 2026-10-18T10:02:00Z no commit passed in 1.9s, waited 41s
```

`azimuth show R-NNNN` prints the run's result line as `verify` printed it, then `At:`, `Commit:`,
`Command:`, `Waited:` and `Session:` (when the run file has them), `Prebuild:`, `JUnit:` (when
there was a report), `Scenarios:` (when it lists any), and `Output:` with the output tail indented
four spaces. `--brief` prints the run's `runs` line with its target, and `--json` the whole record.
An unknown run exits 2. Both commands read every run file, not the index, which keeps only the
newest runs, so an old run is found however many runs came after it.

`azimuth show M-NN` prints the milestone's page. The header gives its ID and title, its status
(with the release date once released, and the target when set), its goal and its progress. Its
features follow, grouped by status: in progress, verifying, approved, draft, idea, deferred, done,
then cancelled and superseded, marked `not counted`. Each group lists ID, priority and title, by
priority then ID. For a planned or active milestone, the last section names the counted features
that aren't done (deferred ones included), says it is ready for you to release, or says no
feature counts yet. A planned milestone with work started adds the `azimuth move M-NN active`
line. `--brief` prints the one-line summary and `--json` the milestone. An unknown milestone
exits 2.

```
$ azimuth show M-01
M-01 First
Status: active, target 2026-11-15
Goal: Ship the login flow.
Progress: 1/5 done

in-progress (2)
  F-006 P0 Reset password
  F-001 P1 Login
approved (1)
  F-002 P2 Logout
deferred (1)
  F-004 P3 Export
done (1)
  F-003 P2 Signup
cancelled (1, not counted)
  F-005 P2 Import

Keeping it from being ready: F-006, F-001, F-002, F-004
```

`azimuth brief <T-ID>` prints, in this order: the task's title, its feature and the status of its
`after` tasks; the lines of each scenario it covers, as written in `stories.md`, with settled
values filled in and `{?}` kept; `contract.md`, its headings one level deeper; the feature's
invariants; the files it may change; its verify command; the feature's `notes.md`; the project's
`conventions.md`, its headings one level deeper (left out while it is missing, empty or still the
template `init` wrote; above 1,500 words, one line pointing to the file); and the rules (the
test-naming form for the project's `stack.languages`, tests first, only the listed files, no `git`
or `azimuth` and nothing under `.azimuth/`; for each listed file that matches
`parallel.shared_files`, one complete insertion to it (a whole enum variant, match arm, registry
entry or module line), no edit or reordering of another task's insertion and no formatter over a
shared file or its package; what `{?}` means when a covered scenario holds one; and last, what to
report: the files changed, the verify result, what the task taught that later tasks should know,
each file changed outside "Files you may change" and why, and, when a covered scenario holds a
`{?}`, the value each `{?}` took in a passing test, as `<scenario ID>: <value>`). A part with
nothing to show is left out, except the files, the verify command and the rules. It writes nothing
and runs no git, and the same records give the same text. An unknown feature or task exits 1.

## Create

`azimuth new <kind> "<title>" [options]` allocates the next ID under a lock and writes the file
from the project's templates. In a session, new features (and `new spec`) are added to the
session's `touched` list, and new questions, ADRs and issues to its `raised` list.

`new` prints only the new ID on stdout, so `id=$(azimuth new question "…")` captures it, and the
files it wrote on stderr (`created <path>, <path>`, or `nothing new` when `new spec` had nothing to
add). The ID is printed as soon as its files exist: if recording it in the session fails afterwards,
the command reports the error and exits 1, but the ID and its file stay. `--json` prints
`{id, files}` instead.

Under `autonomy.questions: proceed`, `new question` run by an agent answers the question with its
recommendation right after creating it, when it isn't `--blocking` and exactly one option is
recommended (see [Autonomy](concepts.md#autonomy)). stdout is still the ID alone; stderr adds two
lines after the files:

```
Q-0001: answered automatically with its recommendation (a: Lockfile)
Proceed with it and record it with azimuth resolve Q-0001. The user can overrule it in the viewer.
```

For a question, `--json` prints `{id, files, answered}`, where `answered` is that answer's result
(`{ref, from, to, changed, auto, message}`) or `null` when the question stays open for you.

| Kind          | Options                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature`     | `--summary "…"`, `--priority P0–P3` (default P2), `--milestone M-NN`                                                                                                                                                  |
| `spec <F-ID>` | Scaffolds the missing spec files (impact, stories, contract, plan) of a feature.                                                                                                                                      |
| `milestone`   | `--summary "<goal>"`                                                                                                                                                                                                  |
| `adr`         | `--links <IDs>`                                                                                                                                                                                                       |
| `question`    | `--feature F-NNN`, `--blocking`, `--context "…"`, `--option key="Label: detail"` (repeatable; commas are fine, and the label ends at the first `: ` outside brackets or quotes), `--recommend <key>`, `--links <IDs>` |
| `issue`       | `--type bug\|debt\|risk` (default bug), `--severity low\|medium\|high\|critical`, `--files <paths>`, `--links <IDs>`                                                                                                  |

## Change

| Command                                                                           | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azimuth move <ID> <status> [--reason "…"] [--note "…"] [--by <ID>] [--override]` | Gated status change for features, tasks, decisions, milestones, issues and questions (`obsolete`). `--reason` for moves that undo or park work (kept in the feature's log, or an issue's `Status notes`), `--note` for blocked or skipped tasks and for accepting or rejecting an ADR (stored as its `decision_note`), `--by` for superseding, `--override` with `--reason` (you only) to start a feature whose dependencies aren't done. |
| `azimuth reapprove <F-ID>`                                                        | Approves a changed spec again (re-runs the approval gate). Only approved and in-progress features: a verifying feature needs none, since the done gate doesn't check the approval.                                                                                                                                                                                                                                                        |
| `azimuth answer <Q-ID> [--option <key>] [--text "…"]`                             | Answers a question, or replaces an agent's answer with yours (clearing its `resolution`). You only.                                                                                                                                                                                                                                                                                                                                       |
| `azimuth resolve <Q-ID> --adr ADR-NNNN \| --assumption F-NNN`                     | Records how an answer was applied.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `azimuth ack <F-ID \| ADR-ID \| Q-ID>`                                            | Acknowledges an automatic approval, acceptance or answer, or the values an agent settled in a feature's scenarios. You only.                                                                                                                                                                                                                                                                                                              |
| `azimuth set <ID> <field> <value \| none>`                                        | Sets `priority`, `size` or `milestone` on a feature, or `severity` on an issue.                                                                                                                                                                                                                                                                                                                                                           |
| `azimuth log <ID> "<message>" [--review]`                                         | Adds a progress note to the feature's log (for a task, prefixed with its ID), or, for an issue (`BUG-`, `DEBT-`, `RISK-`), a bullet `<time> · <actor> · <message>` in its `Status notes`, next to the reasons of its moves. `--review` (you only, features only) records a change request the agent must address.                                                                                                                         |
| `azimuth note <T-ID \| F-ID> "<text>"`                                            | Adds what a task taught to the feature's `notes.md` (below).                                                                                                                                                                                                                                                                                                                                                                              |
| `azimuth settle <S-ID> "<value>"`                                                 | Replaces the scenario's first `{?}` with the value a passing test proved (below).                                                                                                                                                                                                                                                                                                                                                         |
| `azimuth as-built <F-ID> [--json]`                                                | Drafts the feature's `as-built.md` from its commits: the files changed and the deviations from `impact.md` (below).                                                                                                                                                                                                                                                                                                                       |

Refused moves print the failing gate checks and exit 1.

A feature that moves to in-progress also moves its milestone from planned to active, in the same
locked write: `F-001: approved → in-progress (M-01: planned → active)`. Only the milestone's
`status` line changes, and `--json` lists its file in `changed`. An active or released milestone
is left as it is, and a refused move writes neither file.

`note` and `settle` record what a build learned without touching the approved spec (see
[Notes and placeholders](concepts.md#notes-and-placeholders)), so neither makes the approval
stale. `note` takes a feature or a task in its plan and appends a `### <ID> · <date>` section
(UTC date) to the feature's [`notes.md`](file-format.md#notesmd), creating it on the first note.
`settle` turns the first `{?}` in the scenario's lines into `{=<value>}` and adds a log note
`Settled <S-ID>: {=<value>}`, in one locked step. The value is trimmed and can't be empty or hold
`{`, `}` or a line break. It says how many of the scenario's placeholders are left:

```
$ azimuth settle S-005.1.2 17..30
S-005.1.2: settled 17..30 (1 placeholder left)
$ azimuth settle S-005.1.2 30
S-005.1.2: settled 30
```

Both add the IDs to the current session's `touched` list. A refusal exits 1 and writes nothing:
an unknown feature, task or scenario, a blank note, a value that can't be written, or a scenario
with no `{?}` left (`S-005.1.2 has no {?} left to settle.`).

`as-built` drafts the close-out record, [`as-built.md`](file-format.md#as-builtmd), of a feature
in `verifying` or `done`. It reads every commit reachable from HEAD that names the feature or one
of its stories, scenarios or tasks (the IDs in its `Refs:` trailer, else those in its Conventional
Commits scope, as the index links commits), over the whole history: `git.log_depth` doesn't limit
it. It writes:

- `completed_at`: today's date (UTC).
- `files_changed`: each path those commits changed outside `.azimuth/`, once: `delete` when its
  last change deleted it, else `create` when its first change added it, else `modify`. A rename
  counts as a delete of the old path and a create of the new one.
- `deviations`: each changed path that no `create`, `modify` or `test` row of `impact.md` names
  or contains, as `unplanned-create`, `unplanned-modify` or `unplanned-delete`, and each such row
  that no commit changed, as `planned-unchanged`. Every reason is empty.

Paths are compared as git prints them, relative to the repository, so the project folder is taken
to be the repository root. A new file takes its body from the as-built template. A rerun, after a
late commit for instance, recomputes the generated deviations and keeps the rest: the reason
already written for the same path and kind, the deviations written by hand with other kinds,
`follow_ups`, the body, and a `done` feature's `completed_at`. It prints the file, what it found
and the deviations that still need a reason (the done gate refuses while one has none):

```
$ azimuth as-built F-005
Wrote .azimuth/features/F-005-counts/as-built.md from 7 commits: 10 files changed, 1 deviation, 1 without a reason.
Needs a reason: src/glob.ts (unplanned-modify)
```

`--json` prints the whole result instead,
`{feature, file, created, commits, files_changed, deviations, unexplained, message}`. It writes
only `as-built.md`, never stages or commits it, and adds the feature to the current session's
`touched` list. A refusal exits 1 and writes nothing: an unknown feature, another status
(`F-005 is in-progress: azimuth as-built takes a feature in verifying or done.`), a folder that
isn't a git repository, an existing `as-built.md` whose frontmatter isn't valid YAML, or a failed
`git log`. A missing ID, or one that isn't a feature's, exits 2.

## Verify

`azimuth verify [T-ID | F-ID …] [--no-prebuild] [--summary] [--json]` runs the verify commands of
the tasks and features named, one after another in the order named and each task once (default:
every task of in-progress and verifying features). It records each run in
`.azimuth/cache/runs/R-NNNN.json` with the output tail, and exits 1 if any failed. An unknown ID,
or one with no verify command, exits 1 before anything runs.

When `verify.prebuild` is set, verify runs it once before the first command, under
`verify.build_timeout_seconds`, so a build the commands share doesn't count against each command's
`verify.timeout_seconds`. By default, a prebuild that fails or times out prints its output tail,
records no runs and exits 1. `--no-prebuild` skips it.

With `verify.prebuild_failure: continue` (the default is `stop`), a prebuild that exits non-zero
no longer stops the call. Each command still runs, under `verify.build_timeout_seconds` plus
`verify.timeout_seconds` since it now builds what the prebuild would have
(`[azimuth] timed out after 2400s` with the defaults), and its run line ends with
` after a failed prebuild`. verify still exits 1, even when every run passed, and the done gate
asks for those runs to be rerun with a working build. A prebuild that times out or is interrupted
records no runs either way. Each run records the prebuild that served it as `prebuild`
(see [Cache](file-format.md#cache)).

One `azimuth verify` runs at a time in a repository and its worktrees: another call waits until
the running one ends, then prints `waited 40s for another verify` and starts. Each run records
that wait in `waited_ms` and the current session in `ses`.

Commands run from the project root with `/bin/sh`. A command that outlasts its timeout is killed
together with every process it started, and its run fails with exit code 124. Ctrl-C or SIGTERM
stops verify the same way: the running command is killed and not recorded, the rest don't run,
and verify exits 130 or 143.

Verify prints each command before running it, the prebuild's too, then a result line:
`prebuild passed in 41.2s`, `R-0142 T-005.4 passed in 1.2s`, or
`R-0142 T-005.4 failed (exit 1) in 2.1s` followed by the output tail. After a failed prebuild
under `continue`, a run line reads `R-0142 T-005.4 passed in 1.2s after a failed prebuild`.
`--summary` leaves out the commands, so a batch prints the prebuild's line, one line per run and
the output of failures. `--json` prints only the JSON array of runs on stdout (`[]` after a
prebuild that stopped the call); a failed prebuild's lines go to stderr.

Before the first command, verify prints a warning on stderr when the project's disk has less free
space than `verify.min_free_gb` (default 10, in GB; 0 turns the check off), `--json` included:
`Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.`
It never stops verify or changes its exit code, and nothing prints when the free space can't be
read.

A command can write a JUnit report to the path in `$AZIMUTH_JUNIT` for exact per-scenario results.
Otherwise verify reads the output. A passing run passes a covered scenario only when the output
shows one of its tests ran (so a typecheck passes nothing):

- the scenario ID appears, as in Vitest or Jest test titles;
- the function name of a test marked with `// scenario:` or `@pytest.mark.scenario` appears on a
  passing line: `test buffer::tests::inserts_text_at_cursor ... ok` (cargo),
  `--- PASS: TestCountsFiles` (`go test -v`), `… PASSED` (`pytest -v`);
- or the name of a test file that references it appears, except for Rust files: cargo lists every
  test binary even when its filter ran none of their tests, and never lists module files.

Where the output names a scenario, only a line showing its test passed counts, since verbose
reporters also list skipped tests. Vitest's default reporter names no tests or files when it isn't
printing to a terminal, so verify commands use `vitest run --reporter=verbose`.

A failing run fails covered scenarios unless the output shows them passing the same way. Function
names are matched without their module path, so give marked tests unique names; `azimuth check`
warns (`W-TEST-NAME`) when marked tests in different files share one. Test runners that
print none of these (`go test` without `-v`) need a JUnit report, whose test cases are matched by
scenario ID or function name too. `$AZIMUTH_TASK` holds the task ID.

## Finish a task

`azimuth task finish <T-ID> --commit "<message>" [--note "<text>"] [--adopt <path,…>] [--json]`
commits a task, verifies it and moves it to done in one call. It runs these steps in order and
stops at the first that fails:

1. **check** reads only: the project is a git repository, the feature and the task exist and are
   both in progress, the task has a verify command, the feature has no errors (counted as
   `azimuth check <F-ID>` counts them; warnings don't stop it), every `--adopt` path can be
   adopted, nothing is already staged outside the paths the stage step would stage, and no
   changed file outside the task's `files` needs a decision (below). A failed check changes
   nothing.
2. **adopt**, with `--adopt` only, adds the paths to the task's `files` in `plan.md` (below), so
   they are staged with the rest.
3. **note**, with `--note` only, adds the text to the feature's `notes.md` as `azimuth note` does,
   so it goes into the commit.
4. **stage** runs `git add` on the changed paths (modified, added, deleted, renamed and untracked;
   never ignored ones) that are one of the task's `files` or lie under one, and on the changed
   records under the feature's folder. Every other changed path is left out and listed as
   `not staged` (below). It fails when there is nothing to stage.
5. **commit** makes one commit of exactly the staged paths. Hooks run; finish never passes
   `--no-verify`, amends, pushes or makes a second commit.
6. **verify** runs `verify.prebuild` and the task's verify command and records the run, as
   `azimuth verify <T-ID>` does, waiting for another running verify first. Its line shows the
   prebuild's time: `R-0142 passed in 1.2s (prebuild 41.2s)`. A failed prebuild fails the step
   (`prebuild failed (exit 2) in 3.1s`), unless `verify.prebuild_failure` is `continue` and the
   prebuild didn't time out: then the task's command still runs and decides the step,
   `R-0142 passed in 1.2s after a failed prebuild (exit 2, 3.1s)`.
7. **done** moves the task to done when the run passed. The move's log entry carries the result:
   `T-005.4: in-progress → done. Committed 1a2b3c4; R-0142 passed.`, or
   `… R-0142 passed after a failed prebuild.` under `continue`.
8. **log**: after a failed run or prebuild, a log note records the result instead:
   `T-005.4: Committed 1a2b3c4; R-0142 failed (exit 1).`

Under `continue`, a lane whose code builds can finish while another lane's code doesn't, and the
done gate asks for a rerun of that task once the workspace builds
(`T-005.4 passed after a failed prebuild`). Before its steps, finish prints the same low disk
space warning on stderr as `azimuth verify`; it never fails a step or changes the exit code.

The move and its log entry are written after the commit and stay uncommitted; the next
`task finish` in the feature commits them with its records, and close-out commits the last ones.
They change only `.azimuth/`, so they never make the run stale.

The check refuses a changed path, untracked ones included, that lies outside the task's `files`
and outside the feature's folder when one of two rules holds:

- **Marker:** it matches `tests.globs`, and its working copy holds a marker for a scenario the
  task covers that HEAD's copy doesn't hold. A marker is a test name starting with the scenario
  ID, a `// scenario:` comment or `@pytest.mark.scenario`; a mere mention of the ID doesn't count.
  A deleted file holds no markers. An untracked file, or the new path of a rename, has no copy at
  HEAD, so all its markers are new.
- **Impact:** it is a `create`, `modify` or `test` path of the feature's `impact.md`, or lies
  under one, and no other in-progress task, of any feature, lists it.

The `✗ check:` line names the files and how to proceed. Its output has one line per file, sorted
by path, with the reason; a file both rules refuse shows the marker reason:

```
$ azimuth task finish T-005.4 --commit "feat(F-005): count files"
✗ check: Changed outside T-005.4's files: src/format.ts, test/cli.test.ts. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.
    src/format.ts: a modify path in F-005's impact.md that no in-progress task lists
    test/cli.test.ts: adds a marker for S-005.4.2, which T-005.4 covers
- stage: not run
- commit: not run
- verify: not run
- done: not run
- log: not run

$ azimuth task finish T-005.4 --commit "feat(F-005): count files" --adopt test/cli.test.ts,src/format.ts
✓ check: F-005 has no errors
✓ adopt: added to T-005.4's files: test/cli.test.ts, src/format.ts
✓ stage: .azimuth/features/F-005-counts/plan.md, src/count.ts, src/format.ts, test/cli.test.ts, test/count.test.ts
✓ commit: 1a2b3c4 feat(F-005): count files
✓ verify: R-0142 passed in 1.2s
✓ done: T-005.4: in-progress → done
✓ log: Committed 1a2b3c4; R-0142 passed.
```

Several new markers read `adds markers for S-005.4.1, S-005.4.2, which T-005.4 covers`. For each
file, find whose lane changed it. When it is this task's, run finish again with `--adopt`. When
it is another task's, finish that task first, with `--adopt` if it doesn't list the file yet, so
that its commit takes the file. Otherwise commit or revert the file yourself. A changed file that
neither rule refuses doesn't stop the check; the stage step leaves it out and lists it as not
staged.

`--adopt` takes one comma-separated list of repository-relative paths, as `git status --porcelain`
prints them; given twice, only the last list counts. Each path is trimmed and loses a leading `./`
and a trailing `/`, and a path given twice counts once. A path that is already the task's (listed,
under a listed directory, or in the feature's folder) is accepted whether or not it changed. Any
other path must be exactly a path `git status` lists, so a directory is refused and can't sweep in
another lane's files. The check refuses an invalid path with one of these sentences, one per path
in the order given:

- `Can't adopt src/other.ts: git status shows no change to it.`
- `Can't adopt src/parse.ts: T-006.1 lists it and is in progress, so it goes in T-006.1's commit.`
  It names the first such task, by feature ID and then plan order.

The adopt step then appends the paths the task doesn't list yet to its `files` in `plan.md`, in
the order given. It never removes or reorders an entry, and never changes another task or field.
`plan.md` isn't part of the [spec hash](file-format.md#spec-hash), so adopting never makes the
approval stale and needs no `reapprove`; the stage step commits `plan.md` with the feature's
records. The step prints `added to T-005.4's files: <paths>`, naming the paths it wrote, or
`already T-005.4's files: <paths>`, naming every adopted path, when it had nothing to write. It
writes no log entry: the commit shows the change.

A file that two tasks list, such as a [shared file](concepts.md#parallel-tasks-and-shared-files),
is staged whole: the first task finished commits it with every task's insertions, and the next
task's commit no longer sees it changed. For a shared file that another in-progress task lists,
finish prints a warning (below).

The message gets a `Refs: <T-ID>` trailer unless a line after its first already starts with
`Refs:` (any case); that message is kept as written. When the message has more than one
paragraph and its last one holds only `Token: value` trailers such as `Co-Authored-By:`, `Refs:`
becomes the first line of that paragraph, so git still reads them all as trailers; otherwise it
is added as a new last paragraph. Trailing whitespace is removed.

finish prints one line per step: `✓` for a step that ran, `✗` for the one that failed, followed
by its output indented four spaces (the feature's errors, the refused files, git's output with
the hooks', or the run's output tail), and `- <step>: not run` for the steps that didn't run.
The changed paths the stage step left out follow it, by owner, each line only when it has paths:

- `not staged:` files no in-progress task lists. Look at each: no task in flight will commit it.
- `not staged, other in-progress tasks:` files another in-progress task lists; its finish
  commits them.
- `not staged, records:` paths under `.azimuth/`, such as another feature's log or a session.

Then comes a `warning:` line for each staged path that matches `parallel.shared_files` and that
another in-progress task also lists: the commit carries that task's unfinished insertion and may
not build on its own. Several tasks read `T-005.3's and T-006.1's`. The warning never fails a step
or changes the exit code.

```
$ azimuth task finish T-005.4 --commit "feat(F-005): count files" --note "Counts the BOM."
✓ check: F-005 has no errors
✓ note: T-005.4: note added
✓ stage: .azimuth/features/F-005-counts/notes.md, src/count.ts, src/registry.ts, test/count.test.ts
  not staged: src/other.ts
  not staged, other in-progress tasks: src/parse.ts
  not staged, records: .azimuth/features/F-006-parse/log.md
  warning: src/registry.ts carries T-006.1's work in progress; this commit may not build on its own.
✓ commit: 1a2b3c4 feat(F-005): count files
✓ verify: R-0142 passed in 1.2s
✓ done: T-005.4: in-progress → done
✓ log: Committed 1a2b3c4; R-0142 passed.

$ azimuth task finish T-005.4 --commit "feat(F-005): count files"
✓ check: F-005 has no errors
✓ stage: src/count.ts
✓ commit: 1a2b3c4 feat(F-005): count files
✗ verify: R-0142 failed (exit 1) in 0.4s
    S-005.4.1 counts files
- done: not run
✓ log: Committed 1a2b3c4; R-0142 failed (exit 1).
```

`--json` prints only the result, whatever the outcome: `{task, feature, ok, steps, staged,
not_staged, commit, run, interrupted, not_staged_outside, not_staged_other_tasks,
not_staged_records, shared}`, where each step is `{step, status, detail, output}` and `status` is
`done`, `failed` or `not-run`. `steps` holds `adopt` only with `--adopt` and `note` only with
`--note`. `not_staged` lists every path left out, and the three `not_staged_…` lists split it as
the three lines do. `shared` holds the warnings as `{path, tasks}`. A failed git step shows the
last `verify.output_tail_lines` lines of git's output. Unless the check failed, the feature and the
task are added to the current session's `touched` list.

It exits 0 when the task is done and 1 when a step failed. Usage errors exit 2 and change nothing:
no `--commit` or a blank one, an ID that isn't a task ID, an action other than `finish`, an
`--adopt` that names no path once split at commas and trimmed
(`task finish --adopt needs a path: --adopt <path,…>.`), or no project. Ctrl-C or SIGTERM during
the verify step kills the running command as in `azimuth verify`: no run is recorded, nothing is
logged, the commit stays and finish exits 130 or 143.

To rerun after a failure, fix what the `✗` line names and run `task finish` again; leave out
`--note` when the note step already ran, since the note stays in `notes.md`. `--adopt` may stay:
once the adopt step ran, the paths are the task's files even when a later step failed, so the
check accepts them and the adopt step writes nothing. After a failed
commit the paths stay staged. After a failed verify the commit stays and the task stays in
progress: the next finish commits the fix with the failure's log entry and verifies again. When
the failure lay outside the task (another lane's broken file) and nothing is left to stage, the
next finish finds the task's commit since it moved to in-progress and skips the commit step
(`✓ commit: skipped: <sha> <subject> already commits T-…`, with the ignored `--commit` message
noted), then verifies and moves the task to done. While another `azimuth verify` holds the
verify lock, the verify step's output starts with `waited Ns for another verify`.

## Sessions

| Command                                                               | Effect                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `azimuth session start --skill <name> --goal "…" [--touch IDs]`       | Creates `sessions/SES-YYYYMMDD-HHMM.md` and prints its ID; later commands in the same Claude Code session use it.    |
| `azimuth session note "<text>" [--id SES-…]`                          | Appends `- HH:MM · <text>` (UTC) to the Notes section of the current session, or of `--id`.                          |
| `azimuth session handoff "<next steps>" [--summary "…"] [--id SES-…]` | Writes the Handoff (and Summary) section of the current session, or of `--id`, replacing what was there.             |
| `azimuth session close [--stale] [--id SES-…]`                        | Sets `ended_at` and collects the commits made since the start (`--stale`: closes the sessions left open, see below). |

Inside a Claude Code session, `session start` keeps one Azimuth session: when the Claude Code
session's Azimuth session is still open, it prints that session's ID again, adds
`- HH:MM · <skill> · <goal>` (UTC) to its Goals section and adds `--touch` to its `touched`. It
never reopens a closed session or changes the first `skill`, `goal` and `started_at`. Outside
Claude Code every `session start` creates a session. The plugin closes the session when the Claude
Code session ends, so agents don't run `session close`. When the plugin's hooks haven't run in the
Claude Code session (it started before the plugin was enabled), `session start` still prints the
ID, then warns on stderr to run `/reload-plugins` or start a new session, and until then to end
the session with `azimuth session close`: without hooks nothing closes the session or records the
work.

`session close --stale` closes each open session that started more than 12 hours ago and whose
Claude Code session hasn't written to its live log in the last hour (or is unknown), ending it at
the later of 12 hours after its start and that last write, but never after now. `azimuth check`
reports the same sessions as `W-SESSION-OPEN`.

## Viewer

| Command                                 | Effect                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azimuth view [--port <n>] [--no-open]` | Opens this project's running viewer, or starts one in the foreground (127.0.0.1, default port 4319 or the next free one).                                                               |
| `azimuth view --detach [--open]`        | Makes sure a background viewer is running and prints its URL.                                                                                                                           |
| `azimuth view --stop`                   | Stops this project's background viewer.                                                                                                                                                 |
| `azimuth export [-o <file>]`            | Writes a self-contained, read-only HTML snapshot (default `azimuth-export.html`) to share: no live agent activity, and project paths relative and the home folder as `~` in every text. |

## Claude Code

| Command                | Effect                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `azimuth hook <event>` | Entry point for the plugin's hooks (reads the hook JSON on stdin). Not for direct use.                 |
| `azimuth statusline`   | One line for Claude Code's status line, e.g. `◎ F-005 in-progress · T-005.4 in progress · 3 need you`. |
