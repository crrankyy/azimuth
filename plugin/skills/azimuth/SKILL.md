---
name: azimuth
description: Use whenever you work in a repository that has an .azimuth/ folder, or the user mentions features, specs, tasks, ADRs, questions or the Azimuth viewer. Explains how to read project state, record progress and move work through Azimuth's gates with the `azimuth` CLI.
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# Working in an Azimuth project

Current state:

!`${CLAUDE_PLUGIN_ROOT}/bin/azimuth status --brief`

Azimuth keeps the project's features, specs, task plans, decisions, questions, issues and work
sessions in `.azimuth/`, validates them and shows them live in a local viewer. Follow
`.azimuth/PROTOCOL.md`. The essentials:

- **Read state with the CLI**, not by scanning files: `azimuth status --brief`,
  `azimuth show <ID> --brief`, `azimuth next`, `azimuth check`.
- **Change status only with `azimuth move <ID> <status>`.** A refused move explains which gate
  check failed; fix that, or ask the user. Never edit `status` or approval fields by hand.
- **Keep the viewer current** on long work: move tasks to `in-progress`/`done` as you go and add
  `azimuth log <ID> "<progress>"` notes at meaningful points.
- **Commit** with Conventional Commits and a `Refs: <T-ID or F-ID>` trailer.
- **Only the user** answers questions, releases milestones and overrides gates. When the
  Autonomy line above says `questions proceed`, a non-blocking question you raise with
  `--recommend` is answered with your recommendation at once (`azimuth new question` says so):
  proceed with it and record it with `azimuth resolve`. The user can answer differently later.
  Blocking questions, and every question under `questions ask`, wait for the user.

## Workflow skills

| Skill                       | Use it to                                   |
| --------------------------- | ------------------------------------------- |
| `/azimuth:init`             | Set up `.azimuth/` and describe the project |
| `/azimuth:idea "<title>"`   | Capture a feature idea                      |
| `/azimuth:spec F-NNN`       | Write a feature's spec and get it approved  |
| `/azimuth:build F-NNN`      | Implement an approved feature task by task  |
| `/azimuth:verify F-NNN`     | Close a feature out                         |
| `/azimuth:ship "<request>"` | Do all of the above end to end              |
| `/azimuth:adr "<title>"`    | Record an architecture decision             |
| `/azimuth:bug "<title>"`    | File a bug, tech debt or risk               |
| `/azimuth:next`             | Pick the next piece of work                 |
| `/azimuth:view`             | Open the live viewer                        |

## CLI reference

| Command                                                                                                         | Purpose                                                                |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `azimuth status --brief`                                                                                        | Project summary: what needs the user, work in flight, what's next      |
| `azimuth show <ID> --brief`                                                                                     | One item with its gate, tasks, questions and recent log                |
| `azimuth next [F-ID]`                                                                                           | Highest-priority unblocked work, or a feature's ready tasks            |
| `azimuth check [ID…]`                                                                                           | Validate files; exit 1 on errors                                       |
| `azimuth new feature "<title>" [--summary "…"] [--priority P0-P3] [--milestone M-NN]`                           | Capture an idea                                                        |
| `azimuth new spec F-NNN`                                                                                        | Scaffold missing spec files from templates                             |
| `azimuth new question "<question>" --feature F-NNN [--blocking] --option key="Label: detail" … --recommend key` | Ask the user instead of guessing                                       |
| `azimuth new adr "<title>" [--links IDs]` · `azimuth new issue "<title>" --type bug\|debt\|risk`                | Record decisions and issues                                            |
| `azimuth move <ID> <status> [--reason "…"] [--note "…"] [--by <ID>]`                                            | Gated status change for features, tasks, decisions, milestones, issues |
| `azimuth reapprove F-NNN`                                                                                       | Approve a spec again after it changed                                  |
| `azimuth resolve Q-NNNN --adr ADR-NNNN \| --assumption F-NNN`                                                   | Record how an answer was applied                                       |
| `azimuth log <ID> "<message>"`                                                                                  | Progress note in the feature's log                                     |
| `azimuth note <T-ID\|F-ID> "<text>"`                                                                            | What a task taught, in the feature's notes.md (no reapproval)          |
| `azimuth settle <S-ID> "<value>"`                                                                               | Fill a scenario's first `{?}` with the value a passing test proved     |
| `azimuth verify <T-ID\|F-ID>`                                                                                   | Run verify commands and record the result                              |
| `azimuth task finish <T-ID> --commit "<message>" [--note "<text>"]`                                             | Commit a task's files with `Refs:`, verify it and move it to done      |
| `azimuth brief <T-ID>`                                                                                          | The prompt for a subagent building a task, from the records            |
| `azimuth trace [F-ID]`                                                                                          | Scenario → test coverage                                               |
| `azimuth session start --skill <name> --goal "…"` · `session note "…"` · `session handoff "<next steps>"`       | Record work: one session per Claude Code session, closed by the plugin |
