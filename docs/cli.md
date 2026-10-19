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
current session comes from `AZIMUTH_SESSION`, or from the last `session start` in this Claude Code
session.

## Set up

### `azimuth init [--refresh]`

Creates `.azimuth/` in the current directory: `config.yaml` with the detected stack and commands
(package.json scripts and lockfiles, pyproject/uv, Cargo, Go), project knowledge stubs,
`PROTOCOL.md` and templates. It also adds an Azimuth block to `CLAUDE.md` (importing the protocol)
and `AGENTS.md`, `.azimuth/cache/` to `.gitignore`, `.azimuth/` to `.prettierignore` when Prettier
is used, and `AZIMUTH_ACTOR=agent` to `.claude/settings.json`. `--refresh` rewrites only the
protocol, templates and the CLAUDE.md/AGENTS.md blocks.

### `azimuth doctor [--print-path]`

Checks Node, the Claude Code plugin, validation errors, the CLAUDE.md import, hook activity and the
viewer. `--print-path` prints an `ln -s` line that links `azimuth` into `~/.local/bin` (which must
be on your PATH).

## Read

| Command                                     | Output                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `azimuth status [--brief \| --json]`        | What needs you, work in flight, open high and critical issues, what's next, problem counts. `--json` prints the whole index. Outside a project, `--brief` says so and exits 0.                                                 |
| `azimuth show <ID> [--brief \| --json]`     | One entity. For a feature: its gate checks, tasks with last runs, open questions, unapplied answers, change requests and recent log.                                                                                           |
| `azimuth next [F-ID] [--json]`              | The highest-priority unblocked work across the project (critical bugs and debt, then feature work by status and priority, then high-severity ones), or a feature's ready tasks.                                                |
| `azimuth check [ID…] [--warnings] [--json]` | Validation problems (all, or those concerning the given IDs). Every error is listed; without an ID or `--warnings`, warnings are only counted by code on one line. `--json` lists every problem. Exit 1 when there are errors. |
| `azimuth trace [F-ID] [--all] [--json]`     | Scenario → test coverage. References that only mention a scenario ID (outside a test name or marker) are hidden and counted on the last line; `--all` shows them, marked `(mention)`, and `--json` keeps them.                 |
| `azimuth docs [formats\|concepts\|cli]`     | Prints this reference: the file formats, the concepts, or this page. It is bundled into the CLI, so agents read it instead of Azimuth's code.                                                                                  |
| `azimuth index [--out <file>]`              | Writes the index JSON (default `.azimuth/cache/index.json`).                                                                                                                                                                   |

## Create

`azimuth new <kind> "<title>" [options]` allocates the next ID under a lock and writes the file
from the project's templates. In a session, new features (and `new spec`) are added to the
session's `touched` list, and new questions, ADRs and issues to its `raised` list.

`new` prints only the new ID on stdout, so `id=$(azimuth new question "…")` captures it, and the
files it wrote on stderr (`created <path>, <path>`, or `nothing new` when `new spec` had nothing to
add). The ID is printed as soon as its files exist: if recording it in the session fails afterwards,
the command reports the error and exits 1, but the ID and its file stay. `--json` prints
`{id, files}` instead.

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
| `azimuth reapprove <F-ID>`                                                        | Approves a changed spec again (re-runs the approval gate).                                                                                                                                                                                                                                                                                                                                                                                |
| `azimuth answer <Q-ID> [--option <key>] [--text "…"]`                             | Answers a question. You only.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `azimuth resolve <Q-ID> --adr ADR-NNNN \| --assumption F-NNN`                     | Records how an answer was applied.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `azimuth ack <F-ID \| ADR-ID>`                                                    | Acknowledges an automatic approval or acceptance. You only.                                                                                                                                                                                                                                                                                                                                                                               |
| `azimuth set <ID> <field> <value \| none>`                                        | Sets `priority`, `size` or `milestone` on a feature, or `severity` on an issue.                                                                                                                                                                                                                                                                                                                                                           |
| `azimuth log <ID> "<message>" [--review]`                                         | Adds a progress note to the feature's log (for a task, prefixed with its ID). `--review` (you only) records a change request the agent must address.                                                                                                                                                                                                                                                                                      |

Refused moves print the failing gate checks and exit 1.

## Verify

`azimuth verify [T-ID | F-ID …] [--no-prebuild] [--summary] [--json]` runs the verify commands of
the tasks and features named, one after another in the order named and each task once (default:
every task of in-progress and verifying features). It records each run in
`.azimuth/cache/runs/R-NNNN.json` with the output tail, and exits 1 if any failed. An unknown ID,
or one with no verify command, exits 1 before anything runs.

When `verify.prebuild` is set, verify runs it once before the first command, under
`verify.build_timeout_seconds`, so a build the commands share doesn't count against each command's
`verify.timeout_seconds`. A prebuild that fails or times out prints its output tail, records no
runs and exits 1. `--no-prebuild` skips it.

One `azimuth verify` runs at a time in a repository and its worktrees: another call waits until
the running one ends, then prints `waited 40s for another verify` and starts. Each run records
that wait in `waited_ms` and the current session in `ses`.

Commands run from the project root with `/bin/sh`. A command that outlasts its timeout is killed
together with every process it started, and its run fails with exit code 124. Ctrl-C or SIGTERM
stops verify the same way: the running command is killed and not recorded, the rest don't run,
and verify exits 130 or 143.

Verify prints each command before running it, the prebuild's too, then a result line:
`prebuild passed in 41.2s`, `R-0142 T-005.4 passed in 1.2s`, or
`R-0142 T-005.4 failed (exit 1) in 2.1s` followed by the output tail. `--summary` leaves out the
commands and a passing prebuild's line, so a batch prints one line per run plus the output of
failures. `--json` prints only the JSON array of runs on stdout (`[]` after a failed prebuild,
whose lines go to stderr).

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

## Sessions

| Command                                                               | Effect                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `azimuth session start --skill <name> --goal "…" [--touch IDs]`       | Creates `sessions/SES-YYYYMMDD-HHMM.md` and prints its ID; later commands in the same Claude Code session use it.       |
| `azimuth session handoff "<next steps>" [--summary "…"] [--id SES-…]` | Writes the Handoff (and Summary) section of the current session, or of `--id`.                                          |
| `azimuth session close [--stale] [--id SES-…]`                        | Sets `ended_at` and collects the commits made since the start (`--stale`: closes sessions left open for over 12 hours). |

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
