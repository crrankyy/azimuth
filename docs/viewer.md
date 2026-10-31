# Viewer

The viewer is a local web app showing one project's full state: what needs you, what agents are
doing right now, features and their specs, the roadmap, decisions, questions, issues, agent
activity, verification and project knowledge. It works offline (no web fonts, CDNs or network
requests) and is dark-themed.

- [Live and export modes](#live-and-export-modes)
- [Staying current](#staying-current)
- [Screens](#screens)
- [Keyboard](#keyboard)
- [Write actions](#write-actions)
- [HTTP API](#http-api)
- [Security](#security)

## Live and export modes

| Mode   | How                                                                                                                                     | Writes                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Live   | `azimuth view` (or automatically by the Claude Code plugin), served on `127.0.0.1` from port 4319 (`viewer.port`) or the next free port | Yes, as you                                           |
| Export | `azimuth export -o file.html`: one self-contained HTML file with the index embedded                                                     | No; actions are shown disabled with the snapshot time |

One viewer runs per project. `azimuth view` reuses it; `azimuth view --stop` stops it. It keeps
running while any Claude Code session in the project is open (its Claude Code process runs and
it hasn't ended), and otherwise exits by itself after two idle hours with no open page and no
requests, or when `.azimuth/` disappears. If it stops during a session, your next prompt starts
it again. A newer build replaces an older running viewer automatically, on the same port, so open
pages reconnect: autostart waits up to a second for the old viewer to exit, and the replacement
takes the next free port only if that one is still taken. A viewer that stopped without removing
its record (a crash, a reboot) also comes back on the port it had. When `viewer.port` in
config.yaml has changed since that viewer started, or its record is from an older build that
didn't note it, the replacement starts at `viewer.port` (or the next free port) instead.

## Staying current

The server watches `.azimuth/` (including the live activity logs) and git's HEAD and refs, with a
stat poll every 2 seconds as a fallback. It pushes over Server-Sent Events:

- `live`: agent activity only, at most once a second, without rebuilding anything;
- `index`: the full index, only when its content changes (`rev`);
- `hello`: on connect; a page connected to an older server instance reloads itself.

While an agent is active, the index is also rebuilt every 10 seconds to pick up source changes the
index reports (planned files appearing, uncommitted changes). While a page is open, agent statuses
are also worked out again every minute, and `live` is pushed when one changed: an agent quiet for
30 minutes turns done without writing anything. Changed items flash briefly. If the
connection drops, a banner says so, actions are disabled, and the page reconnects on its own.

## Screens

| Screen           | Route                                  | Shows                                                                                                                                                                                                          |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbox            | `#/inbox`                              | What needs you, grouped by urgency, with the action inline (answer, approve, re-approve, review, open run, show problems, acknowledge).                                                                        |
| Agents           | `#/agents`                             | Live sessions and their subagents: running and waiting ones as cards, those finished today as rows; files being edited, planned overlaps and the permission prompts waiting on you.                            |
| Agent transcript | `#/agents/<claude-session>/<agent-id>` | One agent's live transcript: a tab per agent, messages, tool calls with diffs and output, subagent cards; the session's agents, covered scenarios, files and commits. Without `/<agent-id>`, the main agent's. |
| Overview         | `#/overview`                           | Status across features, the active milestone, coverage, questions, issues, verify runs, architecture freshness, recent activity.                                                                               |
| Roadmap          | `#/roadmap`, `#/roadmap/graph`         | Milestones on a timeline with their release and the commits naming them; the feature dependency graph.                                                                                                         |
| Features         | `#/features`                           | Table (filter, group, sort) or board by lifecycle.                                                                                                                                                             |
| Feature          | `#/features/F-005/<tab>`               | Header, lifecycle and next gate with actions, and tabs: Context, Impact, Stories, Contract, Plan (task graph, runs; `plan/T-005.4` selects a task), Activity, As-built.                                        |
| Decisions        | `#/decisions/ADR-0004`                 | ADRs with supersession chains; accept or reject proposed ones.                                                                                                                                                 |
| Questions        | `#/questions/Q-0003`                   | Open (blocking first) and answered questions; answer with an option and/or text. An agent's answer is labelled "Answered by an agent with its recommendation", with "Answer differently" to give yours.        |
| Issues           | `#/issues/BUG-0001`                    | Bugs, debt and risks; risk matrix; triage severity and status. A row, its ID or title, Enter or the preview's "Open full page" opens the issue's page.                                                         |
| Issue            | `#/issues/BUG-0001/page`               | One issue: header with its age, Triage card, description, related work and history (both derived from the index), facts, linked features, files with the changes planned for them, and its source file.        |
| Activity         | `#/activity/SES-…`                     | Agent timeline of sessions and subagents (waits on you striped; commits, runs, raised questions and ADRs marked), cards for sessions running or waiting on you, then threads by Today, Yesterday, Earlier.     |
| Verification     | `#/verification/R-0142`                | Scenario coverage matrix and verify runs with output.                                                                                                                                                          |
| Knowledge        | `#/knowledge/architecture`             | Vision, architecture with the module map, conventions, glossary.                                                                                                                                               |

Agents shows the project's live Claude Code sessions. A session that is running or waiting on you
gets a card: its status, its SES ID (else the first 8 characters of its Claude Code session ID),
skill, start and duration, goal, the feature and task it works on, what it's doing (its latest
tool and file, the lines added and removed, how long ago) or what it's waiting for, a Transcript
link, and a tree of its subagents. Sessions that finished today follow as rows that open the
session in Activity (or its transcript when it has no SES). The filters are Active (the default:
all of these), Running, Waiting on you and Finished today. `j` / `k` select a session and `Enter`
opens it. The side panel counts what is running, waiting and done today, lists the files agents
are editing (and flags a file two agents edit unless it matches `project.shared_files`), the
planned overlaps between features in flight, and the permission prompts waiting on you, oldest
first. Answer those in the Claude Code terminal running the session: the viewer never answers,
allows or denies them.

A transcript (from a card's Transcript link, a subagent row, or a waiting prompt) follows one
agent's messages, tool calls and subagents as they happen, under the session's header ("Copy
session ID" copies the ID `claude --resume` takes). A tab per agent switches between the main
agent and its subagents (`[` and `]`). Each tool call is a row (an edit with its diff and the
lines added and removed, a command with the tail of its output); rows with a diff, a failure or a
call still running start open, a click toggles one, and "Show all tool output" opens them all. A
subagent's card links to its own transcript, and a "now" line says what the agent is doing or
waiting for.
New entries are fetched whenever agent activity changes (`live`) and appear at the bottom without
a reload. "Following live", on when the page opens, keeps the newest in view; Pause or `f` stops
the scrolling, not the fetching, and Resume or `f` turns it back on. The view starts in the
transcript's last 512 KiB and says so when earlier entries are left out. The side panel lists the
session's agents, the scenarios the agent's task covers with their coverage, the files the loaded
entries edited or read, and the session's commits.

Agents and transcripts appear only in the live viewer. An export shows "Agents are only shown in
the live viewer" and "Transcripts are only available in the live viewer" instead and never
contains a transcript; the page keeps transcripts in memory only, never in browser storage.

The sidebar's Agents item counts the sessions that aren't done, which includes one waiting for
your next prompt. While there is one, the strip at the foot of the sidebar shows the most recently
active one: its status mark, its task (else feature), and what it's doing or waiting for; it opens
Agents. When nothing needs you, the Inbox says the same in a line ("An agent is working on
T-005.2: …", "An agent on T-005.2 is waiting for you: …"), or, without such a session, when the
last one ended.

On a feature's Stories tab, a value settled with `azimuth settle` carries a ✓ titled "settled by
test", and an open `{?}` reads "to be settled". A test that is only in the working tree is tagged
`uncommitted` there and in the Verification table's Test column. The As-built tab shows the
feature's notes after the close-out record, and opens as soon as the feature has notes.

Activity opens with the agent timeline: a row per session in the range (Last 75 min, the
default, Today or 3 days) and an indented row per subagent, each saying its status in words. Spans
are running, waiting on you (striped), finished, or open when a session has no live data, and
markers sit at the time of each commit (a ring), verify run (a square, with ✕ when it failed) and
question or ADR the session raised (a diamond); every span and marker names itself in its title.
A "now" line marks the current time, the legend names every colour and shape, and "Earlier today"
lists today's sessions that ended before the range. A session row opens the session below (or the
transcript of one still at work), and a subagent row opens its transcript. The header counts the
sessions active. Under Today come a card per session running or waiting on you (how long, its
goal, features, task and subagents, and its latest action or what it waits for; it opens the
transcript), then the finished sessions by Today, Yesterday and Earlier. Collapsed, a session
shows its times (with the date in Earlier), commits, runs with the failed ones counted and what it
raised; expanded, its handoff and the session that picked it up, its summary, what it touched and
its thread: its subagents, commits, verify runs and the questions, ADRs and issues it raised, in
time order. Commits and runs that belong to no listed session, and your own actions, are rows of
their own, so each appears once. The chips (Sessions, Subagents, Commits, Verify runs, Your
actions) and the feature filter apply to the timeline, the cards and the feed, and
`#/activity/SES-…` expands and scrolls to that session. An export shows persisted sessions on the
timeline and no cards.

An expanded session card lists, after its handoff and summary, the goals later skills added to
the session and its progress notes, with their times in local time like the rest of the card.

Hovering any ID shows a summary card. The problems panel lists `azimuth check` results with
"Copy path" and, when `viewer.editor_url` is set (schemes `vscode:`, `cursor:`, `zed:`, `idea:`,
`file:`), "Open in editor".

Times are shown in your machine's time zone, and "Today" and "Yesterday" in Activity and
"Finished today" in Agents are local days; files store UTC. Dates without a time (created, due, released) are shown as written. Layouts are designed at 1440 pixels wide, hold up from 1280 to 1920 and stay usable
down to 1024, where side panels move under the main content.

## Keyboard

| Keys                                                 | Action                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ⌘K / Ctrl-K                                          | Command palette: jump to any ID or title, run what needs you, copy CLI commands (↑↓, ↵, ⌘C copies the ID)                     |
| `g` then `i` `a` `o` `r` `f` `d` `q` `s` `t` `v` `k` | Inbox, Agents, Overview, Roadmap, Features, Decisions, Questions, Issues (`s`), Activity (`t`), Verification, Knowledge       |
| `g p`                                                | Problems panel                                                                                                                |
| `j` / `k`                                            | Next / previous item in lists (features on a feature page, tasks on its Plan tab, issues in list order on an issue's page)    |
| `Enter`                                              | Open the selected item (in Issues, the issue's page)                                                                          |
| `a`                                                  | The selected Inbox item's primary action                                                                                      |
| ⌘↵                                                   | Send an answer                                                                                                                |
| `[` / `]`                                            | In a transcript, the previous / next agent's tab (main agent first, then the subagents; stops at the ends)                    |
| `f`                                                  | In a transcript, turn "Following live" off or on                                                                              |
| `Esc`                                                | Close dialogs, the palette and the problems panel; on an issue's page, go back to the list; from a transcript, back to Agents |

## Write actions

Every action goes through the same gated transitions as the CLI and is recorded as yours.

| Action                                      | Where                                                               | Effect                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approve / re-approve spec                   | Feature, Inbox (approve also from the palette)                      | Moves to approved (re-approve keeps the status), recording the spec hash and commit. A failing gate shows its checks.                                              |
| Request changes                             | Feature                                                             | Adds a review note the agent must address.                                                                                                                         |
| Defer, cancel, resume                       | Feature                                                             | Moves the feature (defer and cancel need a reason).                                                                                                                |
| Answer                                      | Questions, Inbox                                                    | Writes your answer; the agent applies it. "Answer differently" replaces an agent's answer with yours.                                                              |
| Accept / reject                             | Decisions (the Inbox's Review opens it)                             | Decides a proposed ADR, with an optional note for the agent.                                                                                                       |
| Acknowledge / send back                     | Inbox, Decisions; Feature (acknowledge only)                        | Reviews an automatic approval, acceptance, rejection or answer. The Inbox's Review item for an agent's answer offers "Answer differently" instead of "Send back…". |
| Priority, milestone, severity, issue status | Feature header, Features table (`p` / `m`), Issues, an issue's page | Sets the field.                                                                                                                                                    |
| Release                                     | Roadmap                                                             | Releases a milestone whose counted features are done, recording the date and the current commit (below).                                                           |

The Inbox's Review item for values an agent settled in a feature offers the same two actions:
"Acknowledge" accepts them all, "Send back…" returns the spec to draft.

Release… shows on every active milestone, disabled with `<n> features not done` while a counted
feature isn't done. It shows on a planned milestone once all its features are done, but not on
an empty one (`azimuth release` can release that). It releases as `azimuth release` does, without
a tag: a planned milestone becomes active and released in one step, and the dialog says so first.
A released milestone's row reads `Released <Mon D>`, then ` · <tag>` and ` · <sha>` when they were
recorded. An expanded row lists the newest 5 commits naming the milestone (`<sha> <subject>`),
then `and <n> more`; a collapsed row lists none.

Status changes (approve, re-approve, answer, decide, revert, move, release) send the status you
saw; if it changed in the meantime the action is refused rather than applied to something you
didn't see. Writes change frontmatter fields or append log entries; Markdown bodies are never
rewritten.

## HTTP API

| Request                                                | Response                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                                | The app, with this launch's write token embedded                                                                                                                              |
| `GET /api/health`                                      | `{ok, instance, version, build, root}`; `build` (version + bundle time) decides when a rebuilt viewer replaces a running one                                                  |
| `GET /api/index`                                       | The index (ETag: its `rev`)                                                                                                                                                   |
| `GET /api/events`                                      | SSE stream (`hello`, `live`, `index`, pings)                                                                                                                                  |
| `GET /api/features/<F-ID>/approval-diff`               | Diffs of the spec files changed since approval                                                                                                                                |
| `GET /api/transcript/<claude-session>`                 | Needs the token: `200 {ok, claude_session, agent, entries, next, skipped}`, `403 {error: "token" \| "forbidden"}`, `404`, `400`                                               |
| `POST /api/actions` `{action, ref, payload?, expect?}` | `200 {ok, index, changed, message}`, `409 {error: "gate", gate}`, `409 {error: "conflict" \| "busy"}`, `403 {error: "token" \| "origin" \| "host" \| "policy"}`, `404`, `400` |

Actions: `approve`, `reapprove`, `request-changes` `{comment}`, `answer` `{option, text}`,
`decide` `{decision, note?}`, `acknowledge`, `revert` `{reason}`, `move` `{to, reason, by}`,
`release` (a milestone, no payload), `set` `{field, value}`.

`GET /api/transcript/<claude-session>[?agent=<id>][&after=<offset>]` serves a page of a live
session's Claude Code transcript: the main agent's, or with `agent` a subagent's. Its `entries`
are messages, tool calls with their status, a diff (at most 80 lines) and an output tail (40
lines), subagent cards with the start of what the subagent returned, and results whose call is on
an earlier page. Each request reads at most a 512 KiB window: without `after`, the complete lines
in the file's last 512 KiB; with `after` (a byte offset: the previous page's `next`), the complete
lines from there. `skipped` is true when content before the first line returned was left out,
such as a line longer than the window. The route exists only in the live viewer; see
[Transcripts](claude-code.md#transcripts) for which files it may read.

## Security

- The server binds `127.0.0.1` only and rejects requests whose `Host` isn't its own address (which
  stops DNS-rebinding pages from reading it).
- Writes need the per-launch token embedded in the page, sent as the `X-Azimuth-Token` header, and
  a request that carries an `Origin` must come from the viewer's own address. The token lives only
  in memory and in the served page; exports never contain it or absolute paths.
- Transcripts can hold secrets (file contents, command output, anything pasted into a prompt), so
  `GET /api/transcript` needs the token as well. It reads only a transcript path the hooks
  recorded (or a subagent's file next to the recorded main transcript), and only when its real
  path, after symlinks are resolved, is a regular `.jsonl` file under Claude Code's `projects`
  folders (`$CLAUDE_CONFIG_DIR/projects` when set, and `~/.claude/projects`); a path that fails
  this check is refused (`403 forbidden`). It reads at most a 512 KiB window per request. The
  index, the CLI and exports never contain a transcript or its path.
- No HTTP endpoint runs commands (`verify` is CLI-only).
- Markdown is rendered to React elements, never HTML strings, and links are limited to
  `http(s)`, `mailto` and in-app routes.

These protect against other web pages, not against programs running as you on the same machine.
