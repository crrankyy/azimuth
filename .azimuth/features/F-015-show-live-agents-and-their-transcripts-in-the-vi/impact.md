---
files:
  - path: viewer/src/lib/router.ts
    change: modify
    note: Section "agents" after "inbox" in SECTIONS (#/agents, #/agents/<claude-session>[/<agent-id>])
  - path: viewer/src/App.tsx
    change: modify
    note: Screen routes "agents" to AgentsScreen, or AgentTranscriptScreen when the route has an ID
  - path: viewer/src/components/AppShell.tsx
    change: modify
    note: Agents nav item under Inbox with the count of sessions not done; the footer strip uses activeSessions and the status, and links to Agents
  - path: viewer/src/components/Icon.tsx
    change: modify
    note: The agents icon from the handoff's Sidebar.dc.html
  - path: viewer/src/components/CommandPalette.tsx
    change: modify
    note: SECTION_LABEL.agents ("Agents"); key hints keep coming from GOTO
  - path: viewer/src/lib/keys.ts
    change: modify
    note: GOTO a → agents, t → activity; useScreenKeys for single-key screen shortcuts
  - path: viewer/src/lib/format.ts
    change: modify
    note: elapsed, liveAgo and clockSeconds (shared with F-016)
  - path: viewer/src/lib/status.ts
    change: modify
    note: AgentLook and AGENT_LOOK (shared with F-016)
  - path: viewer/src/components/Status.tsx
    change: modify
    note: AgentStatusMark, a status mark always paired with its label (shared with F-016)
  - path: viewer/src/data/IndexProvider.tsx
    change: modify
    note: pageToken() reads the page's token (readBoot uses it); the live event handling is unchanged
  - path: viewer/src/data/agents.ts
    change: create
    note: AgentRow, agentRows, activeSessions, labels, sessionEnd, agentDuration, IDLE_REASON, isPermissionWait, actionLabel (shared with F-016)
  - path: viewer/src/data/transcript.ts
    change: create
    note: TranscriptState, transcriptUrl, fetchTranscript (token header), applyTranscript (append, complete earlier calls) and useTranscript
  - path: viewer/src/screens/Agents.tsx
    change: create
    note: AgentsScreen with the header counts, the filter, the groups, list keys and the empty states
  - path: viewer/src/screens/agents/model.ts
    change: create
    note: Groups, filter counts, header and right-now counts, files being edited and conflicts, planned overlaps, needs you, finished summaries, working on
  - path: viewer/src/screens/agents/AgentCard.tsx
    change: create
    note: AgentCard (status, meta, goal, working on, action or wait, Transcript link, subagent tree) and FinishedRow
  - path: viewer/src/screens/agents/AgentsAside.tsx
    change: create
    note: Right now, Files being edited, Planned overlaps, Needs you
  - path: viewer/src/screens/agents/agents.css
    change: create
    note: Agents layout, cards, tree rows, finished rows and the side panel (stacks below 1280 px)
  - path: viewer/src/screens/agents/transcript.ts
    change: create
    note: Tab stepping, TRANSCRIPT_KEYS, tool-call count, touched files, default expansion, the now line and diff line classes
  - path: viewer/src/screens/agents/AgentTranscript.tsx
    change: create
    note: AgentTranscriptScreen (empty states, useTranscript, keys, follow and show-all state, scrolling) and AgentTranscript (header, tabs, entries, side panel, follow pill)
  - path: viewer/src/screens/agents/TranscriptEntries.tsx
    change: create
    note: Timestamped messages, tool rows with diffs, output tails and running state, spawn cards, the now line
  - path: viewer/src/screens/agents/TranscriptAside.tsx
    change: create
    note: Agents in this session, Covers, Files, Commits
  - path: viewer/src/screens/agents/transcript.css
    change: create
    note: Transcript layout, entry rows, diff colours, spawn cards and the follow pill
  - path: viewer/src/screens/Inbox.tsx
    change: modify
    note: agentLine names the first session that isn't done, working or waiting for you
  - path: viewer/src/styles/azimuth.css
    change: modify
    note: The handoff's new rules (az-pulse, .az-run, .az-wait, .az-stripe, .az-tree, .az-twig, reduced motion), appended verbatim
  - path: viewer/src/styles/base.css
    change: modify
    note: .agent-status tones and the sidebar's live count
  - path: docs/viewer.md
    change: modify
    note: Agents and transcript routes in Screens; g a, g t, [, ], f and Esc in Keyboard
  - path: docs/getting-started.md
    change: modify
    note: Watch agents on the Agents screen and their live transcripts
  - path: src/core/types.ts
    change: read
    note: F-014's live and transcript types (AgentStatus, LiveActivity, LiveSession, TranscriptEntry, TranscriptPage) and Project.shared_files
  - path: src/core/glob.ts
    change: read
    note: globToRegExp and matchesAny for project.shared_files (no Node imports)
  - path: src/server/server.ts
    change: read
    note: F-014's GET /api/transcript route and the live push the viewer relies on
  - path: viewer/src/data/selectors.ts
    change: read
    note: taskById, featureById, scenarioById, sessionById
  - path: viewer/src/components/primitives.tsx
    change: read
    note: Segmented, EmptyState, FlagBadge, Tag, Kbd
  - path: viewer/src/components/IdChip.tsx
    change: read
    note: ID chips with hover cards in cards, headers and the side panels
  - path: viewer/src/components/CodeBlock.tsx
    change: read
    note: OutputTail for output tails; copyText for Copy session ID
  - path: viewer/src/lib/markdown.tsx
    change: read
    note: Markdown renders message text as React elements
  - path: viewer/src/screens/activity/LiveStrip.tsx
    change: read
    note: Left to F-016 (its 120-second rule stays)
  - path: viewer/src/screens/activity/feed.ts
    change: read
    note: activeLive and the 120-second window stay for F-016
  - path: test/helpers/demo-repo.ts
    change: read
    note: createDemoRepo for the live check
  - path: test/fixtures/live/agents.ts
    change: test
    note: Live sessions shaped by F-014's types and two transcript pages (contract.md, Test fixture)
  - path: viewer/src/lib/format.test.ts
    change: test
    note: elapsed, liveAgo and clockSeconds
  - path: viewer/src/components/Status.test.tsx
    change: test
    note: AgentStatusMark markup and hidden labels
  - path: viewer/src/data/agents.test.ts
    change: test
    note: agentRows, labels and action labels
  - path: viewer/src/lib/keys.test.ts
    change: test
    note: g a and g t
  - path: viewer/src/components/AppShell.test.tsx
    change: test
    note: The Agents nav item and count, and the footer strip by status
  - path: viewer/src/components/CommandPalette.test.tsx
    change: test
    note: Agents and Activity with their go-to keys
  - path: viewer/src/screens/agents/model.test.ts
    change: test
    note: Filters, conflicts, shared files, overlaps and permission waits
  - path: viewer/src/screens/Agents.test.tsx
    change: test
    note: The Agents screen and its side panel, rendered from the fixture
  - path: viewer/src/data/transcript.test.ts
    change: test
    note: Requests with the token and offset, merging pages, failures
  - path: viewer/src/screens/agents/transcript.test.ts
    change: test
    note: Tab stepping, keys and the now line
  - path: viewer/src/screens/agents/AgentTranscript.test.tsx
    change: test
    note: The transcript page, its side panel, follow and show-all states, and the empty states through Screen
  - path: viewer/src/screens/Inbox.test.tsx
    change: test
    note: The empty Inbox's line by session status
---
# F-015: Impact map

Viewer only. The data comes from F-014: live sessions in the index (pushed by the `live` event)
and `GET /api/transcript`. `data/agents.ts` flattens a live session into agent rows and labels
(shared with F-016), `screens/agents/model.ts` derives the Agents screen's groups, counts and
side panel from the index, and `data/transcript.ts` fetches and merges transcript pages with the
page's token. The new screens render from those; the sidebar, keys, palette and the Inbox's line
switch to the agent status. Nothing outside `viewer/` and `docs/` changes.

The visual targets are the handoff's `screens/Agents.html` and `screens/AgentTranscript.html`
(markup in `canvas-source/Agents.dc.html`, `AgentTranscript.dc.html` and `Sidebar.dc.html`; CSS
in `canvas-source/azimuth.css`), all in the gitignored `azimuth-viewer-handoff/`.
