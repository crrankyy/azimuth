# F-027: Stories

Unless a scenario says otherwise, a project is `MINIMAL_CONFIG` (`test/helpers/tree.ts`) without
git. Its session files are:

- "the open session file": `.azimuth/sessions/SES-20261020-1343.md` holding
  `---\nid: SES-20261020-1343\nagent: claude-code\nskill: spec\nstarted_at: 2026-10-20T13:43:00Z\nended_at: null\ngoal: Spec F-050\ntouched: []\ncommits: []\nraised: []\n---\n## Summary\n\n## Handoff\n`;
- "the closed session file": the same with `ended_at: 2026-10-21T10:00:00Z`;
- "the broken session file": `.azimuth/sessions/SES-20261020-1343.md` holding
  `---\nid: [SES-20261020-1343\n---\n## Summary\n` (its frontmatter doesn't parse).

"c1's sidecar" is written with
`updateLiveMeta(root, "c1", { started_at: "2026-10-20T13:43:00Z", ses: "SES-20261020-1343" })`, and
"c1's live log" holds one record `{ kind: "session", at: "2026-10-20T13:43:00Z", ses: "SES-20261020-1343" }`.
A file is "old" when its access and modification times are set with `utimesSync` to
2026-10-21T09:04:00Z. "The prune" is
`pruneLive(root, new Date("2026-10-24T15:46:00Z"), (c) => linkOpen(root, c))`, 78 h 42 min later.

"The hook" for a Claude Code session `c` with a source `s` at a time `t` is
`sessionStart({ session_id: c, cwd: root, source: s }, { env: { CLAUDE_PROJECT_DIR: root, AZIMUTH_NO_VIEWER: "1" }, now: t, writeEnv: () => undefined })`,
and "its context" is the `hookSpecificOutput.additionalContext` of the JSON it prints. Times are
2026-10-21 unless a scenario names a date.

## ST-027.1 · The CLI's session and its state come from one lookup
**Intent:** As the start hook, I want the session the CLI will use together with the state of its file, from the CLI's own lookup, so that what I tell the agent is what `session note` and `handoff` will do.

### S-027.1.1 · An open linked session {happy}
- **GIVEN** the open session file and c1's sidecar
- **WHEN** `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })` runs
- **THEN** it returns `{ id: "SES-20261020-1343", state: "open", ended_at: null }`
- **AND** `linkOpen(root, "c1")` returns `true`

### S-027.1.2 · A closed linked session {edge}
- **GIVEN** the closed session file and c1's sidecar
- **WHEN** `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })` runs
- **THEN** it returns `{ id: "SES-20261020-1343", state: "closed", ended_at: "2026-10-21T10:00:00Z" }`
- **AND** `linkOpen(root, "c1")` returns `false`

### S-027.1.3 · No link at all {negative}
- **GIVEN** the open session file, and no live log or sidecar for `c9`
- **WHEN** `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c9" })` runs
- **THEN** it returns `null`
- **AND** `linkOpen(root, "c9")` returns `false`, and `linkedSession(root, {})` returns `null`

### S-027.1.4 · A link to a session without a file {edge}
- **GIVEN** c1's sidecar and no file in `.azimuth/sessions/`
- **WHEN** `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })` runs
- **THEN** it returns `{ id: "SES-20261020-1343", state: "missing", ended_at: null }`
- **AND** `linkOpen(root, "c1")` returns `false`

### S-027.1.5 · A link to a session whose file doesn't parse {edge}
- **GIVEN** the broken session file and c1's sidecar
- **WHEN** `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })` runs
- **THEN** it returns `{ id: "SES-20261020-1343", state: "invalid", ended_at: null }`
- **AND** `linkOpen(root, "c1")` returns `false`

### S-027.1.6 · AZIMUTH_SESSION wins, as in the CLI {edge}
- **GIVEN** the open session file, c1's sidecar, and `.azimuth/sessions/SES-20261019-0800.md` holding the closed session file's text with `SES-20261019-0800` for its ID and `ended_at: 2026-10-19T09:00:00Z`
- **WHEN** `linkedSession(root, { AZIMUTH_SESSION: "SES-20261019-0800", AZIMUTH_CLAUDE_SESSION: "c1" })` runs
- **THEN** it returns `{ id: "SES-20261019-0800", state: "closed", ended_at: "2026-10-19T09:00:00Z" }`
- **AND** `linkOpen(root, "c1")` returns `true`

## ST-027.2 · Pruning keeps the live link of an open Azimuth session
**Intent:** As a user who resumes a conversation days later, I want its link to the Azimuth session it opened to survive other sessions' starts while that session is open, so that the resumed conversation continues it.

### S-027.2.1 · An open session's live log and sidecar are kept {happy}
- **GIVEN** the open session file, c1's live log and c1's sidecar, both old, and `c2`'s live log holding one record `{ kind: "start", at: "2026-10-20T08:00:00Z", source: "startup" }`, old, without a sidecar
- **WHEN** the prune runs
- **THEN** `liveFile(root, "c1")` and `liveMetaFile(root, "c1")` exist, each with the modification time 2026-10-21T09:04:00Z
- **AND** `readLiveMeta(root, "c1")` returns `{ started_at: "2026-10-20T13:43:00Z", ses: "SES-20261020-1343", transcript_path: null }`, and `liveFile(root, "c2")` doesn't exist

### S-027.2.2 · A closed session's files are pruned {negative}
- **GIVEN** the closed session file, c1's live log and c1's sidecar, both old
- **WHEN** the prune runs
- **THEN** neither `liveFile(root, "c1")` nor `liveMetaFile(root, "c1")` exists

### S-027.2.3 · A link to a session without a file is pruned {edge}
- **GIVEN** c1's live log and c1's sidecar, both old, and no file in `.azimuth/sessions/`
- **WHEN** the prune runs
- **THEN** neither `liveFile(root, "c1")` nor `liveMetaFile(root, "c1")` exists

### S-027.2.4 · A link kept only in the live log counts too {edge}
- **GIVEN** the open session file and c1's live log, old, without a sidecar
- **WHEN** the prune runs
- **THEN** `liveFile(root, "c1")` exists with the modification time 2026-10-21T09:04:00Z
- **AND** `liveMetaFile(root, "c1")` doesn't exist

### S-027.2.5 · Once the session is closed, the next prune deletes them {edge}
- **GIVEN** the project of S-027.2.1 after the prune, then `closeSession(root, "SES-20261020-1343", new Date("2026-10-24T16:00:00Z"))`
- **WHEN** `pruneLive(root, new Date("2026-10-24T16:05:00Z"), (c) => linkOpen(root, c))` runs
- **THEN** neither `liveFile(root, "c1")` nor `liveMetaFile(root, "c1")` exists

## ST-027.3 · The start hook names the session the CLI will use
**Intent:** As an agent in a resumed, cleared or compacted conversation, I want the start context to name the Azimuth session `azimuth session note` and `handoff` will write to, and its state, so that I continue it instead of opening another one.

### S-027.3.1 · BUG-0085: a conversation resumed after another session's start continues its session {happy}
- **GIVEN** a project where `startSession(root, { skill: "spec", goal: "Spec F-050", claudeSession: "b7f1a9ae", now: new Date("2026-10-20T13:43:00Z") })` returned `SES-20261020-1343`, then `startSession(root, { skill: "release", goal: "Release M-02", claudeSession: "b7f1a9ae", now: new Date("2026-10-21T09:04:00Z") })` ran, and b7f1a9ae's live log and sidecar are old
- **AND** the hook ran for `c2` with source `startup` at 2026-10-24T15:46:00Z
- **WHEN** the hook runs for `b7f1a9ae` with source `resume` at 2026-10-24T16:00:00Z
- **THEN** its context ends with ``\n\nYou are in Azimuth session SES-20261020-1343.\n`azimuth session note` and `azimuth session handoff` write to it, and `azimuth session start` adds its goal to it.``
- **AND** `runCli(root, ["session", "note", "Resumed"], { AZIMUTH_CLAUDE_SESSION: "b7f1a9ae" })` returns code 0 and stdout `Updated .azimuth/sessions/SES-20261020-1343.md\n`, `.azimuth/sessions/` holds only `SES-20261020-1343.md`, and that session's `goals` is `- 09:04 · release · Release M-02`

### S-027.3.2 · A resumed conversation whose session is closed {edge}
- **GIVEN** the closed session file and c1's sidecar
- **WHEN** the hook runs for `c1` with source `resume` at 11:00:00Z
- **THEN** the last two lines of its context are `This conversation's Azimuth session SES-20261020-1343 was closed at 2026-10-21T10:00:00Z.` and `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` still write to SES-20261020-1343.``

### S-027.3.3 · A resumed conversation without a link {negative}
- **GIVEN** the open session file and no live log or sidecar for `c9`
- **WHEN** the hook runs for `c9` with source `resume` at 11:00:00Z
- **THEN** the last two lines of its context are `No Azimuth session in this conversation yet.` and ``Run `azimuth session start --skill <skill> --goal "<goal>"` before `azimuth session note` or `azimuth session handoff`.``

### S-027.3.4 · After /clear, a link to a session without a file {edge}
- **GIVEN** c1's sidecar and no file in `.azimuth/sessions/`
- **WHEN** the hook runs for `c1` with source `clear` at 11:00:00Z
- **THEN** the last two lines of its context are `This conversation's Azimuth session SES-20261020-1343 has no file in .azimuth/sessions/.` and `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` fail with "SES-20261020-1343 does not exist."``

### S-027.3.5 · A resumed conversation whose session file doesn't parse {edge}
- **GIVEN** the broken session file and c1's sidecar
- **WHEN** the hook runs for `c1` with source `resume` at 11:00:00Z
- **THEN** the last two lines of its context are ``This conversation's Azimuth session SES-20261020-1343 has errors (run `azimuth check`).`` and `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` still write to SES-20261020-1343.``

### S-027.3.6 · The compaction note names the open session and what writes to it {happy}
- **GIVEN** the open session file, and c1's live log and sidecar
- **WHEN** the hook runs for `c1` with source `compact` at 11:00:00Z
- **THEN** the first three lines of its context are `Azimuth (context restored after compaction):`, `- You are in Azimuth session SES-20261020-1343.` and ``- `azimuth session note` and `azimuth session handoff` write to it, and `azimuth session start` adds its goal to it.``

### S-027.3.7 · The compaction note doesn't claim a closed session {edge}
- **GIVEN** the closed session file, and c1's live log and sidecar
- **WHEN** the hook runs for `c1` with source `compact` at 11:00:00Z
- **THEN** the second and third lines of its context are `- This conversation's Azimuth session SES-20261020-1343 was closed at 2026-10-21T10:00:00Z.` and ``- `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` still write to SES-20261020-1343.``
- **AND** no line of its context is `- You are in Azimuth session SES-20261020-1343.`

### S-027.3.8 · A startup context has no session lines {edge}
- **GIVEN** the open session file, and c1's live log and sidecar
- **WHEN** the hook runs for `c1` with source `startup` at 11:00:00Z
- **THEN** no line of its context is `You are in Azimuth session SES-20261020-1343.` or `No Azimuth session in this conversation yet.`, and none contains `azimuth session note`

### S-027.3.9 · AZIMUTH_SESSION in the hook's environment wins, as in the CLI {edge}
- **GIVEN** the open session file, c1's sidecar, and the closed `SES-20261019-0800` file of S-027.1.6
- **WHEN** the hook runs for `c1` with source `resume` at 11:00:00Z and `AZIMUTH_SESSION: "SES-20261019-0800"` added to its `env`
- **THEN** the last two lines of its context are `This conversation's Azimuth session SES-20261019-0800 was closed at 2026-10-19T09:00:00Z.` and `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` still write to SES-20261019-0800.``
