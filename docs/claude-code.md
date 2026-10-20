# Claude Code integration

Azimuth ships as a Claude Code plugin: skills that drive the workflow, hooks that keep the project
state and the viewer current, and the `azimuth` command on the Bash tool's PATH. The repository is
also the plugin's marketplace (`.claude-plugin/marketplace.json` → `./plugin`).

- [Install](#install)
- [What happens in a session](#what-happens-in-a-session)
- [Skills](#skills)
- [Hooks](#hooks)
- [Without the plugin](#without-the-plugin)
- [Status line](#status-line)
- [Troubleshooting](#troubleshooting)

## Install

From a clone of this repository (v0.3 is installed locally; the build output isn't committed):

```sh
pnpm install && pnpm build
claude plugin marketplace add /path/to/azimuth
claude plugin install azimuth@azimuth
```

A plugin from a marketplace added by local path loads in place, so a new `pnpm build` takes effect
when the next session starts, or in a running session after `/reload-plugins`. The same goes for
installing or enabling the plugin: a session that was already running has no Azimuth hooks until
you run `/reload-plugins` or start a new one, and `azimuth session start` and `azimuth doctor` say
so when they run in such a session. Then, in a repository you want to manage, run `/azimuth:init` in Claude Code (or
`azimuth init` in a terminal). To use `azimuth` in your own terminal, run `azimuth doctor
--print-path` and follow it.

The launcher (`plugin/bin/azimuth`) finds Node 20+ even when it isn't on the PATH Claude Code
passes to hooks: `$AZIMUTH_NODE`, then the path it remembered last time
(`${XDG_CACHE_HOME:-~/.cache}/azimuth/node-path`), then `node` on PATH, Homebrew kegs,
`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, nvm, volta, fnm and asdf.

## What happens in a session

1. **Session start.** The hook exports `AZIMUTH_ACTOR=agent` and the Claude session ID to the
   session's environment, records Claude Code's process ID (`CLAUDE_PID`) so the viewer stays up
   while the session is open, makes sure this project's viewer is running (unless
   `viewer.autostart` is `false` or `AZIMUTH_NO_VIEWER=1` is set), and gives Claude the project status (with your answers and change requests not yet applied), the last
   handoff and the viewer URL. It also records the Claude Code session's start time and transcript
   path in a sidecar next to the live log (`azimuth session start` adds the Azimuth session to
   it). After a compaction it gives a short re-grounding note instead (current session, feature and
   task).
2. **Work.** Every tool call is appended to `.azimuth/cache/live/<session>.jsonl`, with the lines
   each edit added and removed and the error of a call that failed, and so is every permission
   prompt Claude Code shows you; the viewer shows what each agent is doing, and whether it waits
   on you, within about a second. Edits to `.azimuth/` files are validated immediately, and an
   edit that leaves a file invalid is reported back to Claude.
3. **You act in the viewer.** When you answer a question, request changes on or move the feature
   the agent is working on, the agent is told right after its next tool call. Everything else you
   did, including decisions on ADRs, and anything that happened while the agent was idle or the
   session was closed (it continues from your previous prompt when a session is resumed), is
   passed to Claude with your next prompt, worded as your decisions. Answers not yet applied are
   also listed in every session's start context. Each prompt also restarts the viewer if it stopped, without
   waiting for it.
4. **Turn end.** If the session left validation errors in `.azimuth/` files it edited, Claude is
   asked to fix them before stopping (once; never in a loop).
5. **Session end.** The live log records the end, and the hook closes the Claude Code session's
   Azimuth session (setting `ended_at` and collecting its commits), so skills never run
   `azimuth session close`. Claude Code gives SessionEnd hooks 1.5 seconds; a session the hook
   couldn't close in time stays open until `azimuth session close --stale`.

## Skills

| Skill                       | Use it to                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/azimuth:init`             | Set up `.azimuth/` and describe the project (architecture, conventions, glossary from the code; vision from you).         |
| `/azimuth:idea "<title>"`   | Capture a feature idea.                                                                                                   |
| `/azimuth:spec F-NNN`       | Write the full spec, raise questions for decisions it can't make, move it to draft and, when autonomy allows, approve it. |
| `/azimuth:build F-NNN`      | Implement an approved feature task by task, test-first, with verify runs and progress notes.                              |
| `/azimuth:verify F-NNN`     | Close a feature out: verify at HEAD, as-built, architecture reconciliation, done.                                         |
| `/azimuth:ship "<request>"` | All of the above end to end, stopping only for blocking questions or refusals.                                            |
| `/azimuth:adr "<title>"`    | Record an architecture decision.                                                                                          |
| `/azimuth:bug "<title>"`    | File a bug, tech debt or a risk.                                                                                          |
| `/azimuth:next`             | Pick the next piece of work.                                                                                              |
| `/azimuth:view`             | Open the viewer.                                                                                                          |

The `azimuth` skill (model-invoked) teaches Claude the CLI whenever it works in a repository with
`.azimuth/`. The `azimuth` and `spec` skills inject the current status into their prompt and `next`
injects `azimuth next`; the workflow skills start by reading the feature with
`azimuth show F-NNN --brief`. Every skill pre-approves `azimuth` commands, so routine moves don't
ask for permission.

## Hooks

Defined in `plugin/hooks/hooks.json`; each runs `plugin/bin/azimuth hook <event>`, which exits
immediately (before starting Node) in repositories without `.azimuth/`.

| Event                                | Mode                   | What it does                                                                             |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------- |
| SessionStart                         | sync                   | Environment exports, live log and sidecar, viewer autostart, status and handoff context. |
| PreToolUse (Agent)                   | sync                   | Records what a subagent is asked to do and the task or feature it names.                 |
| PostToolUse (all tools)              | async, can wake Claude | Records the tool call; wakes Claude when you act on a feature it or a subagent works on. |
| PostToolUse (Edit, Write, MultiEdit) | sync                   | Validates edited `.azimuth/` files and reports errors to Claude.                         |
| PostToolUseFailure (all tools)       | async                  | Records the failed tool call with the first line of its error.                           |
| PermissionRequest                    | sync                   | Records that an agent waits on you for a permission prompt.                              |
| Notification                         | async                  | Records a `permission_prompt` notification as a wait; ignores the other types.           |
| UserPromptSubmit                     | sync                   | Adds what you did in the viewer since Claude's last turn; restarts a stopped viewer.     |
| SubagentStart, SubagentStop          | sync, async            | Records each subagent starting and finishing, and where its transcript is.               |
| Stop                                 | sync                   | Asks Claude to fix errors it left in `.azimuth/` files (once).                           |
| SessionEnd                           | sync                   | Records the end of the session and closes its Azimuth session.                           |

Subagents run inside their parent's Claude Code session, so their steps land in the same live log.
The Agent tool's hooks record which task each subagent was given: exactly once the Agent tool
returns (right away for a background subagent, when it finishes for a foreground one), and by
launch order until then. The viewer shows each subagent's lane with its task and every feature the
session has in flight.

The PermissionRequest, Notification and PostToolUseFailure hooks only observe: each appends at
most one live record, prints nothing and exits 0, so they never allow, deny or answer anything,
and Claude Code asks you exactly as it would without them. From the live log, each agent gets a
status: running, waiting on you, or done (see
[Sessions and live activity](concepts.md#sessions-and-live-activity)). In non-interactive mode
(`claude -p`), PermissionRequest also fires for a call that is denied without asking: its wait is
recorded but closes at once and leaves no wait span.

A hook that fails never blocks Claude: the error is logged to `.azimuth/cache/hooks.log` and
`azimuth doctor` reports it.

### Transcripts

Claude Code keeps each session's transcript as a JSONL file under its `projects` folder.
SessionStart records the main agent's transcript path in the live log's sidecar, and SubagentStop
records each subagent's. The hooks never read transcripts; only the live viewer's server does,
through a token-guarded route (see [HTTP API](viewer.md#http-api)). It reads only a recorded path,
or a subagent's file next to the recorded main transcript (`<session>/subagents/agent-<id>.jsonl`),
and only when that path, after symlinks are resolved, is a regular `.jsonl` file under
`$CLAUDE_CONFIG_DIR/projects` (when set) or `~/.claude/projects`. Transcripts can hold secrets
(file contents, command output, anything pasted into a prompt), so they stay on your machine: the
index, the CLI and exports never carry a transcript or its path, only whether one exists.
The format is Claude Code's own and undocumented (Azimuth reads it as of Claude Code 2.1.304);
lines it doesn't recognise are skipped.

## Without the plugin

`azimuth init` adds `@.azimuth/PROTOCOL.md` to `CLAUDE.md` (and a pointer in `AGENTS.md` for other
agents), so any session knows the protocol: read state with the CLI, change status only with
`azimuth move`, run `azimuth check` after edits, record sessions and handoffs. Without the plugin
there is no live activity, autostart or edit validation, and if `azimuth` isn't installed the
protocol tells the agent to stop and ask rather than edit statuses by hand. `init` also sets
`AZIMUTH_ACTOR=agent` in `.claude/settings.json`, so the CLI treats Claude as an agent either way.

## Status line

`azimuth statusline` prints one line for Claude Code's status line. Add it to
`~/.claude/settings.json` (it isn't installed automatically):

```json
{
  "statusLine": { "type": "command", "command": "azimuth statusline" }
}
```

## Troubleshooting

| Symptom                                                   | Check                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `azimuth: Node.js 20 or newer is required`                | Install Node 20+, or set `AZIMUTH_NODE=/path/to/node`; delete `~/.cache/azimuth/node-path` after moving Node.  |
| `plugin/dist/cli.mjs is missing`                          | Run `pnpm build` in the Azimuth clone.                                                                         |
| No live activity in the viewer                            | `azimuth doctor` (is the plugin installed and enabled; any hook errors?).                                      |
| `Azimuth's hooks haven't run in this Claude Code session` | The session started before the plugin was installed or enabled: run `/reload-plugins`, or start a new session. |
| The viewer didn't start                                   | `azimuth view` in a terminal shows the error; `viewer.autostart` may be `false` or `AZIMUTH_NO_VIEWER=1` set.  |
| An agent can't approve                                    | `autonomy.approve_specs` is `manual`, or a gate check fails (`azimuth show F-NNN --brief`).                    |
