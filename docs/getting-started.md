# Getting started

## Requirements

- Node.js 20 or newer, on your PATH to build Azimuth (afterwards the plugin finds it even when
  Claude Code's PATH doesn't include it; see [Claude Code integration](claude-code.md#install))
- pnpm, to build Azimuth
- git, in the repositories you manage
- Claude Code, for the agent workflow (the CLI and viewer also work on their own)

## 1. Build and install

```sh
git clone https://github.com/crrankyy/azimuth.git
cd azimuth
pnpm install
pnpm build
claude plugin marketplace add "$PWD"
claude plugin install azimuth@azimuth
```

`azimuth doctor --print-path` (run it as `plugin/bin/azimuth doctor --print-path` the first time)
prints the line that puts `azimuth` on your terminal's PATH.

## 2. Set up a repository

Open Claude Code in the repository you want to manage and run:

```
/azimuth:init
```

It runs `azimuth init` (creating `.azimuth/`, wiring `CLAUDE.md` and `.gitignore`), confirms the
build and test commands, describes the architecture, conventions and glossary from the code, and
asks you for the project's vision. Review `.azimuth/config.yaml`, especially `autonomy`:

```yaml
autonomy:
  approve_specs: auto # agents approve specs that pass every gate check
  accept_adrs: auto # agents accept their own decisions
```

## 3. Ship a feature

```
/azimuth:ship "Let users reset their password by email"
```

The agent captures the idea, writes the spec (asking you through questions when a decision is
yours), approves it if every check passes, builds it task by task with tests named after the
scenarios, and closes it out. Or run the stages yourself: `/azimuth:idea`, `/azimuth:spec F-001`,
`/azimuth:build F-001`, `/azimuth:verify F-001`.

## 4. Watch and steer

The viewer starts with each Claude Code session (`/azimuth:view` prints its URL). Start in the
Inbox: answer questions, review automatic approvals, look at failing runs. While the agent works,
Activity shows what it's doing; feature pages show tasks, scenario coverage and gates as they
change. Your answers and change requests reach the running agent.

To share a snapshot, run `azimuth export -o status.html`.

## Next

- [Concepts](concepts.md): lifecycles, gates, autonomy, traceability
- [File format](file-format.md): everything in `.azimuth/`
- [CLI reference](cli.md)
- [Viewer](viewer.md)
