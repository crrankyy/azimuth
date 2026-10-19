---
files:
  - path: src/core/live.ts
    change: modify
    note: LiveMeta sidecar (liveMetaFile, readLiveMeta, updateLiveMeta); summarizeLive takes it; readLiveSessions passes it; sessionsLastSeen
  - path: src/core/session.ts
    change: modify
    note: sessionOfClaude, currentSession from the sidecar, startSession reuse with Goals bullets, appendNote, closeSession without loadProject, sessionStale, closeStaleSessions
  - path: src/core/facts.ts
    change: modify
    note: Facts.sesLastSeen (session ID → its Claude Code session's last live write)
  - path: src/core/build-index.ts
    change: modify
    note: analyzeProject fills facts.sesLastSeen from sessionsLastSeen
  - path: src/core/validate.ts
    change: modify
    note: W-SESSION-OPEN uses sessionStale, skipping sessions whose Claude Code session is active
  - path: src/core/types.ts
    change: modify
    note: Session.goals and Session.notes
  - path: src/core/parse/records.ts
    change: modify
    note: parseSession reads the Goals and Notes sections
  - path: src/cli/commands/work.ts
    change: modify
    note: session note, the usage line and the unknown-action message
  - path: src/hooks/handlers.ts
    change: modify
    note: HookInput.transcript_path; SessionStart writes the sidecar; compaction and wake-ups read it; SessionEnd closes the session
  - path: viewer/src/components/SessionCard.tsx
    change: modify
    note: Goals and Notes sections in the expanded card
  - path: viewer/src/components/session-card.css
    change: modify
    note: Styles for the Goals and Notes sections
  - path: src/core/protocol.ts
    change: modify
    note: Sessions section of the protocol template (reuse, notes, handoff; the plugin closes)
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: No session close; subagents share the session
  - path: plugin/skills/spec/SKILL.md
    change: modify
    note: No session close
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Hand off without closing
  - path: plugin/skills/ship/SKILL.md
    change: modify
    note: Stages share the Claude Code session's Azimuth session
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: Reference table lists session note and drops close
  - path: src/core/allocate.ts
    change: read
    note: sessionIdFor allocates SES-YYYYMMDD-HHMM[-n] for new sessions
  - path: src/core/templates.ts
    change: read
    note: The session.md template stays as it is (Summary and Handoff)
  - path: src/core/lock.ts
    change: read
    note: withLock and writeFileAtomic for the session file and the sidecar
  - path: src/core/git.ts
    change: read
    note: readCommits collects the commits closeSession records
  - path: src/core/sections.ts
    change: read
    note: splitSections and sectionBody read the new sections
  - path: src/cli/io.ts
    change: read
    note: runtime() takes the current session from currentSession
  - path: src/cli/commands/harness.ts
    change: read
    note: The hook runner logs a failing hook to hooks.log and exits 0
  - path: test/helpers/project.ts
    change: modify
    note: makeFacts defaults sesLastSeen to an empty map
  - path: test/fixtures/hookline/expected-index.ts
    change: modify
    note: Each session gains "goals" and "notes" (empty)
  - path: test/core/session.test.ts
    change: test
    note: Parsing Goals and Notes, reuse, the current session, notes, closing and the stale rule
  - path: test/core/live.test.ts
    change: test
    note: The sidecar, live summaries from it, and sessionsLastSeen
  - path: test/cli/session.test.ts
    change: test
    note: session start reuse and session note through the CLI
  - path: test/hooks/hooks.test.ts
    change: test
    note: SessionStart fills the sidecar; the compaction note; SessionEnd closes the session
  - path: viewer/src/components/SessionCard.test.tsx
    change: test
    note: Goals and Notes in the expanded card
  - path: test/golden/index.test.ts
    change: test
    note: The Hookline index with the two new session fields
  - path: docs/cli.md
    change: modify
    note: session start reuse, session note, current session from the sidecar
  - path: docs/concepts.md
    change: modify
    note: One session per Claude Code session; notes, handoff, closing at SessionEnd; the stale rule
  - path: docs/file-format.md
    change: modify
    note: Goals and Notes sections; live/<claude-session>.meta.json in the cache table
  - path: docs/claude-code.md
    change: modify
    note: SessionStart writes the sidecar; SessionEnd closes the Azimuth session
  - path: docs/viewer.md
    change: modify
    note: Session cards show goals and notes
---
# F-011: Impact map

The sidecar lives in `live.ts` next to the live log. `session.ts` uses it to find the Claude Code
session's Azimuth session (to reuse it at `session start` and to answer `currentSession`) and
records the session there. The hooks write the sidecar at SessionStart and close the session at
SessionEnd. Validation learns from `Facts.sesLastSeen` which sessions are still active. The
viewer reads the two new `Session` fields from the index; nothing else in the index changes.
