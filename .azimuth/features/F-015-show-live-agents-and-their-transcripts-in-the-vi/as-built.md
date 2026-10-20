---
completed_at: 2026-10-20
files_changed:
  - { path: viewer/src/lib/router.ts, change: modify }
  - { path: viewer/src/App.tsx, change: modify }
  - { path: viewer/src/components/AppShell.tsx, change: modify }
  - { path: viewer/src/components/Icon.tsx, change: modify }
  - { path: viewer/src/components/CommandPalette.tsx, change: modify }
  - { path: viewer/src/lib/keys.ts, change: modify }
  - { path: viewer/src/lib/format.ts, change: modify }
  - { path: viewer/src/lib/status.ts, change: modify }
  - { path: viewer/src/components/Status.tsx, change: modify }
  - { path: viewer/src/data/IndexProvider.tsx, change: modify }
  - { path: viewer/src/data/agents.ts, change: create }
  - { path: viewer/src/data/transcript.ts, change: create }
  - { path: viewer/src/screens/Agents.tsx, change: create }
  - { path: viewer/src/screens/agents/model.ts, change: create }
  - { path: viewer/src/screens/agents/AgentCard.tsx, change: create }
  - { path: viewer/src/screens/agents/AgentsAside.tsx, change: create }
  - { path: viewer/src/screens/agents/agents.css, change: create }
  - { path: viewer/src/screens/agents/transcript.ts, change: create }
  - { path: viewer/src/screens/agents/AgentTranscript.tsx, change: create }
  - { path: viewer/src/screens/agents/TranscriptEntries.tsx, change: create }
  - { path: viewer/src/screens/agents/TranscriptAside.tsx, change: create }
  - { path: viewer/src/screens/agents/transcript.css, change: create }
  - { path: viewer/src/screens/Inbox.tsx, change: modify }
  - { path: viewer/src/styles/azimuth.css, change: modify }
  - { path: viewer/src/styles/base.css, change: modify }
  - { path: test/fixtures/live/agents.ts, change: create }
  - { path: viewer/src/lib/format.test.ts, change: modify }
  - { path: viewer/src/components/Status.test.tsx, change: create }
  - { path: viewer/src/data/agents.test.ts, change: create }
  - { path: viewer/src/lib/keys.test.ts, change: modify }
  - { path: viewer/src/components/AppShell.test.tsx, change: create }
  - { path: viewer/src/components/CommandPalette.test.tsx, change: create }
  - { path: viewer/src/screens/agents/model.test.ts, change: create }
  - { path: viewer/src/screens/Agents.test.tsx, change: create }
  - { path: viewer/src/data/transcript.test.ts, change: create }
  - { path: viewer/src/screens/agents/transcript.test.ts, change: create }
  - { path: viewer/src/screens/agents/AgentTranscript.test.tsx, change: create }
  - { path: viewer/src/screens/Inbox.test.tsx, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: docs/getting-started.md, change: modify }
deviations:
  - { path: test/fixtures/live/agents.ts, kind: clarification, reason: "Fills in what contract.md's fixture table leaves open: each session's last_seen_at and events, the time of a2's Grep (12:01:40), the summaries of file events (Edited <path>, Read <path>), the waiting main agent's open wait span from 12:00, and done subagents stopped, ended and last seen at their end. Sessions come from builder functions rather than shared constants, so a test that changes a session's waiting doesn't also change its main agent's" }
  - { path: viewer/src/screens/agents/AgentCard.tsx, kind: scope-addition, reason: "Exports finishedHref (the session in Activity when it has an SES, else its transcript), which contract.md doesn't list, so a Finished today row's link and Enter on that row open the same page" }
  - { path: viewer/src/screens/agents/AgentsAside.tsx, kind: scope-addition, reason: "A text contract.md doesn't list: each conflict is flagged as <editors> are editing <path>, the editors' labels joined with commas and and (…1201 and …1202 code-reviewer are editing src/retry/policy.ts)" }
  - { path: viewer/src/screens/Agents.tsx, kind: scope-addition, reason: "The export empty state has a body, the transcript page's snapshot text (This is a read-only snapshot. Run azimuth view to follow agents live.); feature.md and contract.md give the Agents screen only its title, Agents are only shown in the live viewer" }
  - { path: viewer/src/screens/agents/AgentsAside.tsx, kind: markup-change, reason: "Each Needs you item starts with the waiting status mark, its label hidden (Waiting on you for screen readers), before <session label> · <time waiting>, where the design draws its diamond; feature.md lists only the item's texts" }
  - { path: viewer/src/screens/agents/model.ts, kind: follow-up-fix, reason: "After the build, a card's subagent tree lists running, then waiting, then done subagents, each status in first-seen order, as the design does (treeOrder, which contract.md doesn't list; 29862aa). agentRows, the transcript's tabs and its Agents in this session panel keep agents order" }
  - { path: viewer/src/screens/Agents.test.tsx, kind: test-change, reason: "S-015.2.5's test also renders a session whose subagents were first seen done, waiting, done and running, and expects the tree as running, waiting, done, done (a1, a8, a2, a9); the scenario's THEN names only the fixture's two subagents" }
  - { path: viewer/src/screens/agents/AgentTranscript.tsx, kind: design-change, reason: "The follow pill (Live · new output appears at the bottom with Pause, or Paused with Resume) sticks to the bottom of the window (position: sticky in transcript.css), so it stays in reach while the entries scroll; the design puts it at the end of the page, after the entries and the side panel. Neither feature.md nor contract.md places it, and it is the user's call whether it stays" }
  - { path: viewer/src/screens/agents/TranscriptEntries.tsx, kind: scope-addition, reason: "A tool row's head has the call's summary (a Bash command's description) as its hover title, because the design's rows show only the command" }
  - { path: viewer/src/screens/agents/TranscriptEntries.tsx, kind: clarification, reason: "A spawn entry with status error and no matching live subagent shows a failing glyph and Failed, since an agent status has no failed; feature.md takes the card's status from the entry without saying how an error reads" }
  - { path: viewer/src/screens/agents/TranscriptEntries.tsx, kind: scope-addition, reason: "Output the server capped (truncated: true) shows a … line where it was cut: before an output tail, after a diff or a spawn's output" }
  - { path: viewer/src/screens/agents/TranscriptAside.tsx, kind: clarification, reason: "Files reads None yet when the loaded entries touch no file, a text feature.md doesn't give, and Covers draws each scenario as an ID chip with its coverage glyph and label (impact.md plans ID chips in the side panels; feature.md says only with their coverage labels)" }
  - { path: viewer/src/data/transcript.ts, kind: clarification, reason: "fetchTranscript treats a body that isn't JSON (a proxy's error page, say) as no body, so the failure keeps its HTTP status. A failure whose body has neither message nor error, or a 200 whose body isn't a transcript page, reads The server sent no transcript page., a message contract.md doesn't list" }
  - { path: viewer/src/data/transcript.ts, kind: clarification, reason: "useTranscript returns EMPTY_TRANSCRIPT whenever it is disabled, even for a view it loaded earlier, and ignores an answer that arrives after the view or enabled changed; enabled again, it starts over from the first page" }
  - { path: viewer/src/data/transcript.ts, kind: omission, reason: "useTranscript's queueing (one request in flight, at most one more queued, answers for a view no longer shown ignored) has no unit test: effects don't run under renderToStaticMarkup and the viewer tests have no DOM. The live check covered it" }
follow_ups: [DEBT-0010, BUG-0077]
---
# F-015: As built

## Summary
The viewer gains an Agents screen and a live transcript page, rendered from F-014's live sessions
and its transcript route; the index, the server and exports are unchanged. Agents (`#/agents`,
`g a`; Activity moves to `g t`) sits under Inbox in the sidebar with the number of sessions that
aren't done (`activeSessions`). `agentRows` (new `viewer/src/data/agents.ts`) flattens a live
session into its main agent and one row per subagent, beside `sessionLabel`, `shortLabel`,
`sessionEnd`, `agentDuration`, `isPermissionWait`, `actionLabel` and the viewer's own
`IDLE_REASON`. These, `AGENT_LOOK`, `AgentStatusMark` and `elapsed`, `liveAgo` and `clockSeconds`
are the pieces F-016 builds on. `screens/agents/model.ts` derives the groups (running, waiting,
finished on the viewer's local day), the filter, header and Right now counts, the files agents
are editing with conflicts outside `project.shared_files` (`globToRegExp` from
`src/core/glob.ts`), planned overlaps from `derived.file_conflicts` and the open permission waits,
oldest first. `AgentsScreen` shows a card per running or waiting session (`AgentCard`: status,
SES or short ID, skill, start and duration, goal, Working on, the current action with its edit
sizes or the wait with its start, a Transcript link and the subagent tree), a compact row per
session finished today (`FinishedRow`), `j`/`k` and Enter, and the side panel (`AgentsAside`):
Right now, Files being edited, Planned overlaps and Needs you, whose items link to the waiting
agent's transcript and are answered only in the Claude Code terminal.

`#/agents/<claude-session>[/<agent-id>]` (`AgentTranscriptScreen`) checks its empty states in
feature.md's order, then shows the session's header with Copy session ID, a tab per agent (`[`
and `]` through `useScreenKeys`, new in `lib/keys.ts` as contract.md specifies; `Esc` back to
Agents), timestamped messages, tool rows (open with a diff or when not ok, all open with Show all
tool output, toggled by a click), spawn cards that link to the subagent's transcript, the now
line, Following live (`f`) and a side panel with the session's agents, Covers, Files and Commits.
`useTranscript` (new `viewer/src/data/transcript.ts`) requests the first page with the page's
token (`pageToken()`, the `azimuth-token` meta tag, which `readBoot` now uses), then a page from
`next` whenever `index.live` changes, one request at a time. `applyTranscript` folds `result`
entries into their calls and keeps the loaded entries when a request fails. Exports and the Vite
dev server have no token and never request a transcript. The sidebar's footer strip and the
empty Inbox's agent line follow the first session that isn't done and its status instead of
`ended_at` and the 120-second window; the Activity screen's live strip keeps that window for
F-016. The handoff's `az-pulse`, `.az-run`, `.az-wait`, `.az-stripe`, `.az-tree` and `.az-twig`
rules are appended verbatim to `azimuth.css`, and `base.css` gains `.agent-status` and the
sidebar's live count. Both screens' side panels move under the main column below 1280 px.

Against the handoff's screens, what the data doesn't carry is left out: the "claude-code" label,
"paused 5m", and Read line ranges and line numbers after paths. Where the spec and the design
differ, the build follows the spec: Done today also counts the subagents of today's done sessions
("2 sessions · 4 subagents"), a Needs you item reads "<session> · <time>" and the reason rather
than the design's sentence, and Planned overlaps has its own heading instead of a flag under Files
being edited.

Screenshots of the live viewer on the Hookline demo repo are kept in the session scratchpad
(`shots/F-015/`), not the repo: Agents at 1440 px beside the handoff's, the transcript at 1440,
1280 and 1024 px, and a live sequence (following, paused, a subagent's tab). The Agents shot
predates 29862aa, so its tree still lists the done explorer above the running test-runner. At
1024 px the shared top bar's key hints wrap onto two lines.

## Deviations
- The fixture fills in what contract.md's table leaves open: each session's `last_seen_at` and
  `events`, the time of `a2`'s Grep (12:01:40), the summaries of file events (`Edited <path>`,
  `Read <path>`), the waiting main agent's open wait span from 12:00, and done subagents
  stopped, ended and last seen at their end. Sessions come from builder functions rather than
  shared constants, so a test that changes a session's `waiting` doesn't also change its main
  agent's.
- `AgentCard.tsx` exports `finishedHref` (the session in Activity when it has an SES, else its
  transcript), which contract.md doesn't list, so a Finished today row's link and Enter on that
  row open the same page.
- A conflict is flagged as "<editors> are editing <path>", the editors' labels joined with commas
  and "and" ("…1201 and …1202 code-reviewer are editing src/retry/policy.ts"), a text
  contract.md doesn't list.
- The Agents screen's export empty state has a body, the transcript page's snapshot text ("This
  is a read-only snapshot. Run azimuth view to follow agents live."); feature.md and contract.md
  give it only its title.
- Each Needs you item starts with the waiting status mark, its label hidden ("Waiting on you" for
  screen readers), where the design draws its diamond; feature.md lists only the item's texts.
- After the build, a card's subagent tree lists running, then waiting, then done subagents, each
  status in first-seen order, as the design does (`treeOrder` in `model.ts`, which contract.md
  doesn't list; 29862aa). `agentRows`, the transcript's tabs and its Agents in this session panel
  keep `agents` order. S-015.2.5's test also renders subagents first seen done, waiting, done and
  running and expects `a1`, `a8`, `a2`, `a9`; the scenario's THEN names only the fixture's two.
- The follow pill ("Live · new output appears at the bottom" with Pause, or "Paused" with Resume)
  sticks to the bottom of the window (`position: sticky` in `transcript.css`), so it stays in
  reach while the entries scroll. The design puts it at the end of the page, after the entries and
  the side panel; neither feature.md nor contract.md places it, and whether it stays is the
  user's call.
- On the transcript page: a tool row's head has the call's summary (a Bash command's description)
  as its hover title, since the design's rows show only the command; a spawn entry with status
  `error` and no matching live subagent reads "Failed" with a failing glyph; output the server
  capped (`truncated: true`) shows a "…" line where it was cut (before an output tail, after a
  diff or a spawn's output); Files reads "None yet" when the loaded entries touch no file; and
  Covers draws each scenario as an ID chip with its coverage glyph and label.
- `fetchTranscript` treats a body that isn't JSON as no body, so the failure keeps its HTTP
  status. A failure whose body has neither `message` nor `error`, or a 200 whose body isn't a
  transcript page, reads "The server sent no transcript page.", a message contract.md doesn't
  list.
- `useTranscript` returns `EMPTY_TRANSCRIPT` whenever it is disabled, even for a view it loaded
  earlier, and ignores an answer that arrives after the view or `enabled` changed; enabled again,
  it starts over from the first page.
- `useTranscript`'s queueing (one request in flight, at most one more queued, answers for a view
  no longer shown ignored) has no unit test: effects don't run under `renderToStaticMarkup` and
  the viewer tests have no DOM. The live check covered it.

Otherwise the files match `impact.md`. T-015.10 is writing `docs/viewer.md` and
`docs/getting-started.md` while this record is written, so both are listed as `modify`, as
impact.md plans them, ahead of their commit.

## Follow-ups
- DEBT-0010: `useTranscript` and `useScreenKeys` have no tests.
- BUG-0077: the top bar's key hints wrap at 1024 px.
