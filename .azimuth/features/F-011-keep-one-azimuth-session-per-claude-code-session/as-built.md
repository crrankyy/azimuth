---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/live.ts, change: modify }
  - { path: src/core/session.ts, change: modify }
  - { path: src/core/facts.ts, change: modify }
  - { path: src/core/build-index.ts, change: modify }
  - { path: src/core/validate.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/parse/records.ts, change: modify }
  - { path: src/cli/commands/work.ts, change: modify }
  - { path: src/hooks/handlers.ts, change: modify }
  - { path: viewer/src/components/SessionCard.tsx, change: modify }
  - { path: viewer/src/components/session-card.css, change: modify }
  - { path: test/helpers/project.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: test/core/session.test.ts, change: create }
  - { path: test/core/live.test.ts, change: modify }
  - { path: test/cli/session.test.ts, change: create }
  - { path: test/hooks/hooks.test.ts, change: modify }
  - { path: viewer/src/components/SessionCard.test.tsx, change: create }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: plugin/skills/spec/SKILL.md, change: modify }
  - { path: plugin/skills/verify/SKILL.md, change: modify }
  - { path: plugin/skills/ship/SKILL.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/core/protocol.ts, change: modify }
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/claude-code.md, change: modify }
  - { path: docs/viewer.md, change: modify }
deviations:
  - { path: src/hooks/handlers.ts, kind: duplicated-code, reason: "SessionEnd checks that the session is still open with sessionIsOpen, a private helper in handlers.ts that parses the session's own file, because readSession and openSessionOf in session.ts, which do the same, aren't exported. The check runs before closeSession takes the project lock, and closeSession doesn't repeat it" }
  - { path: test/core/session.test.ts, kind: test-change, reason: "S-011.2.5's test, whose GIVEN S-011.2.6 shares, writes its 1,000 tool records with one appendFileSync instead of one appendLive call each: appendLive resolves the shared cache directory through git on every call (liveDir runs git rev-parse twice and appendLive calls it twice; about 37 ms per git process), so record-by-record writes would take minutes. The test still asserts that the log is over 64 KB" }
  - { path: viewer/src/components/SessionCard.tsx, kind: follow-up-fix, reason: "After the build, the card shows goal and note times in the viewer's local time, like its header, as BUG-0030 decided for the whole viewer (a993f5a). The session file keeps UTC HH:MM. A bullet has no date, so localBullets puts it on the start's UTC day, or on the next one when its time is earlier than the start's" }
  - { path: viewer/src/components/SessionCard.test.tsx, kind: test-change, reason: "S-011.6.3's THEN names the times as written (10:15, 10:30), which the card now shows only in UTC, so its first test renders with TZ=UTC. Two more S-011.6.3 tests check the local times in Asia/Kolkata and a bullet on the next UTC day across the switch to PST in America/Los_Angeles" }
follow_ups: [BUG-0073, DEBT-0008]
---
# F-011: As built

## Summary
Inside one Claude Code session, `azimuth session start` continues the open Azimuth session.
`startSession` finds it through `sessionOfClaude` (the sidecar's `ses`, else the last `session`
record in the live log's tail) and, while its file exists with `ended_at` null, adds
`- HH:MM · <skill> · <goal>` (UTC; `- HH:MM · <goal>` without a skill) to its `## Goals` section,
merges `--touch` into `touched` and prints the same ID. A closed session is never reused, and the
first `skill`, `goal` and `started_at` stay as written. Either way the start appends a `session`
live record and sets the sidecar's `ses`; without a Claude Code session ID every start still
creates a session. The new `azimuth session note "<text>"` (`appendNote`) appends
`- HH:MM · <text>` to `## Notes`, one line per note. `parseSession` reads both sections into
`Session.goals` and `Session.notes` (`""` when absent), so no frontmatter key changed.

The sidecar `live/<claude-session>.meta.json` (`LiveMeta`, `liveMetaFile`, `readLiveMeta` and
`updateLiveMeta` in `live.ts`) holds `started_at`, `ses` and `transcript_path`. It is rewritten
whole with `writeFileAtomic`, ignores keys that are `undefined` and never changes `started_at`
once set. The SessionStart hook writes the start time and transcript path. `summarizeLive`
prefers the sidecar's `ses` and `started_at`, and `readLiveSessions`, the compaction note and
PostToolUse's wake-ups pass it, so `currentSession` and the live view keep both after the 64 KB
tail has rolled past them. The SessionEnd hook appends `end`, then closes the Claude Code
session's open Azimuth session with `closeSession`, which now reads only that session's file, the
config and one `readCommits`, without `loadProject`.

`sessionStale` (open, started more than 12 hours ago, and its Claude Code session's live log not
written to in the last hour, or unknown) is shared by `W-SESSION-OPEN` in `validate.ts`, through
the new `Facts.sesLastSeen` that `analyzeProject` fills from `sessionsLastSeen`, and by
`closeStaleSessions`, which ends a stale session at the later of 12 hours after its start and its
last live write, but never after now. An expanded `SessionCard` lists Goals and Notes after the
handoff and summary. The build, spec, verify and ship skills no longer close sessions, the
azimuth skill's table lists `session note`, and the protocol template and the CLI, concepts,
file-format, Claude Code and viewer docs describe reuse, notes, the sidecar, the close at
SessionEnd and the stale rule. The Hookline golden index changed only by `"goals": ""` and
`"notes": ""` on its six sessions; `test/golden/index.test.ts` itself needed no change. The
feature screen's Activity tab has its own session card
(`viewer/src/screens/feature/ActivityTab.tsx`), which impact.md doesn't name; it shows no goals
or notes.

## Deviations
- SessionEnd checks that the session is still open with `sessionIsOpen`, a private helper in
  `handlers.ts` that parses the session's own file. `readSession` and `openSessionOf` in
  `session.ts` do the same but aren't exported. The check runs before `closeSession` takes the
  project lock, and `closeSession` doesn't repeat it.
- S-011.2.5's test, whose GIVEN S-011.2.6 shares, writes its 1,000 `tool` records with one
  `appendFileSync` instead of one `appendLive` call each. `appendLive` resolves the shared cache
  directory through git on every call (`liveDir` runs `git rev-parse` twice, and `appendLive`
  calls it twice), at about 37 ms per git process, so record-by-record writes would take minutes.
  The test still asserts that the log is over 64 KB.
- After the build, the card shows goal and note times in the viewer's local time, like its
  header, as BUG-0030 decided for the whole viewer (a993f5a). The session file keeps UTC `HH:MM`.
  A bullet has no date, so `localBullets` puts it on the start's UTC day, or on the next one when
  its time is earlier than the start's.
- S-011.6.3's THEN names the times as written (`10:15`, `10:30`), which the card now shows only in
  UTC, so its first test renders with `TZ=UTC`. Two more S-011.6.3 tests check the local times in
  Asia/Kolkata and a bullet on the next UTC day across the switch to PST in America/Los_Angeles.

Otherwise the files match `impact.md`.

## Follow-ups
- BUG-0073: every live log access runs git twice to find the shared cache directory.
- DEBT-0008: the feature Activity tab's session card doesn't show goals and notes.
