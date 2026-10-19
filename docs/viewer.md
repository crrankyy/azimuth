# Viewer

The viewer is a local web app showing one project's full state: what needs you, features and
their specs, the roadmap, decisions, questions, issues, agent activity, verification and project
knowledge. It works offline (no web fonts, CDNs or network requests) and is dark-themed.

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
it again. A newer build replaces an older running viewer automatically.

## Staying current

The server watches `.azimuth/` (including the live activity logs) and git's HEAD and refs, with a
stat poll every 2 seconds as a fallback. It pushes over Server-Sent Events:

- `live`: agent activity only, at most once a second, without rebuilding anything;
- `index`: the full index, only when its content changes (`rev`);
- `hello`: on connect; a page connected to an older server instance reloads itself.

While an agent is active, the index is also rebuilt every 10 seconds to pick up source changes the
index reports (planned files appearing, uncommitted changes). Changed items flash briefly. If the
connection drops, a banner says so, actions are disabled, and the page reconnects on its own.

## Screens

| Screen       | Route                          | Shows                                                                                                                                                                                                   |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbox        | `#/inbox`                      | What needs you, grouped by urgency, with the action inline (answer, approve, re-approve, review, open run, show problems, acknowledge).                                                                 |
| Overview     | `#/overview`                   | Status across features, the active milestone, coverage, questions, issues, verify runs, architecture freshness, recent activity.                                                                        |
| Roadmap      | `#/roadmap`, `#/roadmap/graph` | Milestones on a timeline; the feature dependency graph.                                                                                                                                                 |
| Features     | `#/features`                   | Table (filter, group, sort) or board by lifecycle.                                                                                                                                                      |
| Feature      | `#/features/F-005/<tab>`       | Header, lifecycle and next gate with actions, and tabs: Context, Impact, Stories, Contract, Plan (task graph, runs; `plan/T-005.4` selects a task), Activity, As-built.                                 |
| Decisions    | `#/decisions/ADR-0004`         | ADRs with supersession chains; accept or reject proposed ones.                                                                                                                                          |
| Questions    | `#/questions/Q-0003`           | Open (blocking first) and answered questions; answer with an option and/or text. An agent's answer is labelled "Answered by an agent with its recommendation", with "Answer differently" to give yours. |
| Issues       | `#/issues/BUG-0001`            | Bugs, debt and risks; risk matrix; triage severity and status. A row, its ID or title, Enter or the preview's "Open full page" opens the issue's page.                                                  |
| Issue        | `#/issues/BUG-0001/page`       | One issue: header with its age, Triage card, description, related work and history (both derived from the index), facts, linked features, files with the changes planned for them, and its source file. |
| Activity     | `#/activity/SES-…`             | Live agents (a lane per subagent with its task, and every feature in flight), then sessions with handoffs, commits and verify runs by day.                                                              |
| Verification | `#/verification/R-0142`        | Scenario coverage matrix and verify runs with output.                                                                                                                                                   |
| Knowledge    | `#/knowledge/architecture`     | Vision, architecture with the module map, conventions, glossary.                                                                                                                                        |

Hovering any ID shows a summary card. The problems panel lists `azimuth check` results with
"Copy path" and, when `viewer.editor_url` is set (schemes `vscode:`, `cursor:`, `zed:`, `idea:`,
`file:`), "Open in editor".

Times are shown in your machine's time zone, and "Today" and "Yesterday" in Activity are local
days; files store UTC. Dates without a time (created, due, released) are shown as written. Layouts are designed at 1440 pixels wide, hold up from 1280 to 1920 and stay usable
down to 1024, where side panels move under the main content.

## Keyboard

| Keys                                             | Action                                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| ⌘K / Ctrl-K                                      | Command palette: jump to any ID or title, run what needs you, copy CLI commands (↑↓, ↵, ⌘C copies the ID)                  |
| `g` then `i` `o` `r` `f` `d` `q` `s` `a` `v` `k` | Inbox, Overview, Roadmap, Features, Decisions, Questions, Issues (`s`), Activity, Verification, Knowledge                  |
| `g p`                                            | Problems panel                                                                                                             |
| `j` / `k`                                        | Next / previous item in lists (features on a feature page, tasks on its Plan tab, issues in list order on an issue's page) |
| `Enter`                                          | Open the selected item (in Issues, the issue's page)                                                                       |
| `a`                                              | The selected Inbox item's primary action                                                                                   |
| ⌘↵                                               | Send an answer                                                                                                             |
| `Esc`                                            | Close dialogs, the palette and the problems panel; on an issue's page, go back to the list                                 |

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
| Release                                     | Roadmap                                                             | Releases a milestone.                                                                                                                                              |

Status changes (approve, re-approve, answer, decide, revert, move) send the status you saw; if it
changed in the meantime the action is refused rather than applied to something you didn't see. Writes change frontmatter fields or append log entries;
Markdown bodies are never rewritten.

## HTTP API

| Request                                                | Response                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                                | The app, with this launch's write token embedded                                                                                                                              |
| `GET /api/health`                                      | `{ok, instance, version, build, root}`; `build` (version + bundle time) decides when a rebuilt viewer replaces a running one                                                  |
| `GET /api/index`                                       | The index (ETag: its `rev`)                                                                                                                                                   |
| `GET /api/events`                                      | SSE stream (`hello`, `live`, `index`, pings)                                                                                                                                  |
| `GET /api/features/<F-ID>/approval-diff`               | Diffs of the spec files changed since approval                                                                                                                                |
| `POST /api/actions` `{action, ref, payload?, expect?}` | `200 {ok, index, changed, message}`, `409 {error: "gate", gate}`, `409 {error: "conflict" \| "busy"}`, `403 {error: "token" \| "origin" \| "host" \| "policy"}`, `404`, `400` |

Actions: `approve`, `reapprove`, `request-changes` `{comment}`, `answer` `{option, text}`,
`decide` `{decision, note?}`, `acknowledge`, `revert` `{reason}`, `move` `{to, reason, by}`,
`set` `{field, value}`.

## Security

- The server binds `127.0.0.1` only and rejects requests whose `Host` isn't its own address (which
  stops DNS-rebinding pages from reading it).
- Writes need the per-launch token embedded in the page, sent as the `X-Azimuth-Token` header, and
  a request that carries an `Origin` must come from the viewer's own address. The token lives only
  in memory and in the served page; exports never contain it or absolute paths.
- No HTTP endpoint runs commands (`verify` is CLI-only).
- Markdown is rendered to React elements, never HTML strings, and links are limited to
  `http(s)`, `mailto` and in-app routes.

These protect against other web pages, not against programs running as you on the same machine.
