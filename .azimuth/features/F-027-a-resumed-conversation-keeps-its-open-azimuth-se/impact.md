---
files:
  - path: src/core/session.ts
    change: modify
    note: LinkState, LinkedSession, linkedSession (currentSession plus the state of the session's own file) and linkOpen
    symbols: [LinkState, LinkedSession, linkedSession, linkOpen]
  - path: src/core/live.ts
    change: modify
    note: pruneLive takes an optional keep check for old live logs and sidecars
    symbols: [pruneLive]
  - path: src/hooks/handlers.ts
    change: modify
    note: sessionStart prunes with linkOpen and adds the session lines on resume, clear and compact; HookEnv gains AZIMUTH_SESSION
    symbols: [sessionStart, HookEnv]
  - path: src/core/parse/records.ts
    change: read
    note: parseSession returns no entity only when the frontmatter doesn't parse (the invalid state)
  - path: src/core/lock.ts
    change: read
    note: sharedCacheDir, where liveDir puts the live files
  - path: src/cli/io.ts
    change: read
    note: runtime() takes the current session from currentSession(root, process.env)
  - path: src/cli/commands/work.ts
    change: read
    note: session note, handoff and close use rt.session unless --id is given; unchanged
  - path: src/cli/commands/harness.ts
    change: read
    note: The hook command passes process.env as ctx.env
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG for temp projects
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process with the env a test gives it
  - path: test/core/session.test.ts
    change: test
    note: linkedSession in each state, AZIMUTH_SESSION first, and linkOpen
  - path: test/core/live.test.ts
    change: test
    note: pruneLive with linkOpen keeps an open link's files, deletes closed, missing and unlinked ones, and deletes them once closed
  - path: test/hooks/hooks.test.ts
    change: test
    note: The BUG-0085 replay, the session lines for each state on resume, clear and compact, startup unchanged; S-011.7.3's sidecar session gets a file
  - path: docs/file-format.md
    change: modify
    note: The Cache paragraph says an open session's live log and sidecar are kept past 72 hours
  - path: docs/concepts.md
    change: modify
    note: The live logs sentence in Sessions and live activity, and what a resumed conversation continues
  - path: docs/cli.md
    change: modify
    note: The current-session paragraph says the link is kept while the session is open
  - path: docs/claude-code.md
    change: modify
    note: Step 1 (Session start) lists the session lines on resume, clear and compaction
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: The session row says a resumed conversation continues its open session, as the start context says
---
# F-027: Impact map

Three source files change. `session.ts` gains the lookup with its state, `live.ts` gains the
`keep` check, and `handlers.ts` wires both into SessionStart. No CLI file changes: the CLI keeps
`currentSession`, and the hook now uses it too.

The tests extend the three existing suites. In `hooks.test.ts`, S-011.7.3's test gets an open
session file for the session its sidecar names (see feature.md, Assumptions). The docs and the
azimuth skill change in the last task, each only in the passage named above, since other 0.3.1
features edit the same files.
