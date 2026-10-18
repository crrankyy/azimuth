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

| Command                                 | Output                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `azimuth status [--brief \| --json]`    | What needs you, work in flight, what's next, problem counts. `--json` prints the whole index. Outside a project, `--brief` says so and exits 0. |
| `azimuth show <ID> [--brief \| --json]` | One entity. For a feature: its gate checks, tasks with last runs, open questions, unapplied answers, change requests and recent log.            |
| `azimuth next [F-ID] [--json]`          | The highest-priority unblocked work across the project, or a feature's ready tasks.                                                             |
| `azimuth check [ID…] [--json]`          | Validation problems (all, or those concerning the given IDs). Exit 1 when there are errors.                                                     |
| `azimuth trace [F-ID] [--json]`         | Scenario → test coverage.                                                                                                                       |
| `azimuth index [--out <file>]`          | Writes the index JSON (default `.azimuth/cache/index.json`).                                                                                    |

## Create

`azimuth new <kind> "<title>" [options]` allocates the next ID under a lock and writes the file
from the project's templates. In a session, new features (and `new spec`) are added to the
session's `touched` list, and new questions, ADRs and issues to its `raised` list.

| Kind          | Options                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `feature`     | `--summary "…"`, `--priority P0–P3` (default P2), `--milestone M-NN`                                                                |
| `spec <F-ID>` | Scaffolds the missing spec files (impact, stories, contract, plan) of a feature.                                                    |
| `milestone`   | `--summary "<goal>"`                                                                                                                |
| `adr`         | `--links <IDs>`                                                                                                                     |
| `question`    | `--feature F-NNN`, `--blocking`, `--context "…"`, `--option key="Label: detail"` (repeatable), `--recommend <key>`, `--links <IDs>` |
| `issue`       | `--type bug\|debt\|risk` (default bug), `--severity low\|medium\|high\|critical`, `--files <paths>`, `--links <IDs>`                |

## Change

| Command                                                                           | Effect                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azimuth move <ID> <status> [--reason "…"] [--note "…"] [--by <ID>] [--override]` | Gated status change for features, tasks, decisions, milestones, issues and questions (`obsolete`). `--reason` for moves that undo or park work, `--note` for blocked or skipped tasks and for accepting or rejecting an ADR (stored as its `decision_note`), `--by` for superseding, `--override` with `--reason` (you only) to start a feature whose dependencies aren't done. |
| `azimuth reapprove <F-ID>`                                                        | Approves a changed spec again (re-runs the approval gate).                                                                                                                                                                                                                                                                                                                      |
| `azimuth answer <Q-ID> [--option <key>] [--text "…"]`                             | Answers a question. You only.                                                                                                                                                                                                                                                                                                                                                   |
| `azimuth resolve <Q-ID> --adr ADR-NNNN \| --assumption F-NNN`                     | Records how an answer was applied.                                                                                                                                                                                                                                                                                                                                              |
| `azimuth ack <F-ID \| ADR-ID>`                                                    | Acknowledges an automatic approval or acceptance. You only.                                                                                                                                                                                                                                                                                                                     |
| `azimuth set <ID> <field> <value \| none>`                                        | Sets `priority`, `size` or `milestone` on a feature, or `severity` on an issue.                                                                                                                                                                                                                                                                                                 |
| `azimuth log <ID> "<message>" [--review]`                                         | Adds a progress note to the feature's log (for a task, prefixed with its ID). `--review` (you only) records a change request the agent must address.                                                                                                                                                                                                                            |

Refused moves print the failing gate checks and exit 1.

## Verify

`azimuth verify [T-ID | F-ID]` runs verify commands from the project root with `/bin/sh` (default:
every task of in-progress and verifying features), records each run in
`.azimuth/cache/runs/R-NNNN.json` with the output tail, and exits 1 if any failed. A command can
write a JUnit report to the path in `$AZIMUTH_JUNIT` for exact per-scenario results; otherwise a
passing run passes the task's covered scenarios and a failing one fails them unless the output
shows them passing. `$AZIMUTH_TASK` holds the task ID.

## Sessions

| Command                                                               | Effect                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `azimuth session start --skill <name> --goal "…" [--touch IDs]`       | Creates `sessions/SES-YYYYMMDD-HHMM.md` and prints its ID; later commands in the same Claude Code session use it.       |
| `azimuth session handoff "<next steps>" [--summary "…"] [--id SES-…]` | Writes the Handoff (and Summary) section of the current session, or of `--id`.                                          |
| `azimuth session close [--stale] [--id SES-…]`                        | Sets `ended_at` and collects the commits made since the start (`--stale`: closes sessions left open for over 12 hours). |

## Viewer

| Command                                 | Effect                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `azimuth view [--port <n>] [--no-open]` | Opens this project's running viewer, or starts one in the foreground (127.0.0.1, default port 4319 or the next free one). |
| `azimuth view --detach [--open]`        | Makes sure a background viewer is running and prints its URL.                                                             |
| `azimuth view --stop`                   | Stops this project's background viewer.                                                                                   |
| `azimuth export [-o <file>]`            | Writes a self-contained, read-only HTML snapshot (default `azimuth-export.html`).                                         |

## Claude Code

| Command                | Effect                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `azimuth hook <event>` | Entry point for the plugin's hooks (reads the hook JSON on stdin). Not for direct use.                 |
| `azimuth statusline`   | One line for Claude Code's status line, e.g. `◎ F-005 in-progress · T-005.4 in progress · 3 need you`. |
