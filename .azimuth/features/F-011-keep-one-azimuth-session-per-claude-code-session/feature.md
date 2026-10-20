---
id: F-011
title: Keep one Azimuth session per Claude Code session
summary: Inside one Claude Code session, session start reuses the open Azimuth session and adds its goal, session note appends progress, SessionEnd closes it, and a sidecar keeps the session, start time and transcript path of long sessions.
status: done
priority: P2
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:bdc1804aa5b2464227748f93d93cf445c89177df3f911df93218f71402a2924d
approved_commit: d5937e4
review_ack_at: 2026-10-20T11:04:33Z
---
# F-011: Keep one Azimuth session per Claude Code session

## Objective
One Azimuth session per Claude Code session. Inside a Claude Code session that already has an
open Azimuth session, `azimuth session start` reuses it instead of creating another: it prints
the same ID, adds a dated bullet `<HH:MM> · <skill> · <goal>` to the session's `## Goals`
section and merges `--touch`. `azimuth session note "<text>"` appends running progress to
`## Notes`, `session handoff` keeps replacing the handoff, and the SessionEnd hook closes the
session, so skills stop calling `session close`. A sidecar `live/<claude-session>.meta.json`
keeps the Claude Code session's start time, Azimuth session and transcript path, so the current
session and a live session's start time survive once the live log's 64 KB tail has rolled past
them. W-SESSION-OPEN and `session close --stale` leave a long session alone while its Claude Code
session is still active. Today an orchestrator interleaving build, verify and spec creates 80
sessions a day with three calls each (experience report §4.7 and §5.8).

## Out of scope
- Reading the transcript: F-014 reads `transcript_path` from the sidecar. The index's
  `LiveSession` and the live view don't change.
- `azimuth show SES-… --brief` (`src/core/brief.ts`): it keeps printing the goal and handoff.
- Reuse across Claude Code sessions (after `/clear` Claude Code starts a new session, which gets a
  new Azimuth session) and reuse driven by `AZIMUTH_SESSION`.
- Without a Claude Code session ID (a terminal), nothing changes: each start creates a session
  and only `session close` or `close --stale` closes it.
- Merging or rewriting sessions recorded before this feature.
- Making the 12-hour and 1-hour limits configurable.
- `plugin/hooks/hooks.json`: Claude Code gives SessionEnd hooks 1.5 s, and a plugin hook's
  `timeout` doesn't raise that budget, so the SessionEnd entry stays as it is.
- This repository's own `.azimuth/PROTOCOL.md`: the feature changes the template in
  `src/core/protocol.ts`; the file follows on the next `azimuth init --refresh`.

## Integration points
- `src/core/live.ts`: the sidecar (`LiveMeta`, `liveMetaFile`, `readLiveMeta`, `updateLiveMeta`)
  next to the live log, with the same sanitized name as `liveFile`; `summarizeLive` takes the
  sidecar and prefers its `ses` and `started_at`; `readLiveSessions` passes each log's sidecar;
  `sessionsLastSeen` maps each sidecar's `ses` to its live log's modification time.
  `pruneLive` already deletes every file in `live/` untouched for 24 hours, sidecars included;
  `readLiveSessions`, `anySessionOpen` and `pruneLive` skip files not ending in `.jsonl` as today.
- `src/core/session.ts`: `sessionOfClaude` (sidecar, then the tail), `currentSession`,
  `startSession` (reuse, Goals bullet, `--touch` merge, sidecar `ses`), `appendNote`,
  `closeSession` reading only the session file, the config and one `readCommits`, and the stale
  rule (`sessionStale`) shared by `closeStaleSessions` and validation.
- `src/core/facts.ts` and `src/core/build-index.ts`: `Facts.sesLastSeen`, filled by
  `analyzeProject` from `sessionsLastSeen`; `test/helpers/project.ts` (`makeFacts`) defaults it.
- `src/core/validate.ts`: `sessionProblems` (W-SESSION-OPEN) uses `sessionStale`.
- `src/core/types.ts` and `src/core/parse/records.ts`: `Session.goals` and `Session.notes` from
  the `## Goals` and `## Notes` body sections; `test/fixtures/hookline/expected-index.ts` gains
  `"goals": ""` and `"notes": ""` on its six sessions.
- `src/cli/commands/work.ts`: the `note` action, the usage line and the unknown-action message.
- `src/hooks/handlers.ts`: `HookInput.transcript_path`; `sessionStart` writes the sidecar and
  passes it to `summarizeLive` for the compaction note; `postToolUse` passes it too;
  `sessionEnd` closes the Claude Code session's open Azimuth session after appending `end`.
- `viewer/src/components/SessionCard.tsx` and `session-card.css`: Goals and Notes sections.
- Agent instructions: `plugin/skills/{build,spec,verify,ship,azimuth}/SKILL.md` and the Sessions
  section of `src/core/protocol.ts`. Docs: `docs/cli.md`, `docs/concepts.md`,
  `docs/file-format.md`, `docs/claude-code.md`, `docs/viewer.md`.
- Files shared with features in flight, so the build should run after them: F-012
  (`src/core/types.ts`, `src/core/parse/records.ts`, `src/core/protocol.ts`, the spec and
  azimuth skills, `docs/cli.md`, `docs/concepts.md`, `docs/file-format.md`, `docs/viewer.md`,
  and the golden `test/fixtures/hookline/expected-index.ts`); F-010 (`types.ts`,
  `build-index.ts`, `validate.ts`, `expected-index.ts`, the build and spec skills); F-008
  (`types.ts`, `build-index.ts`, `protocol.ts`, the build, spec and azimuth skills); F-007
  (`src/cli/commands/work.ts`, the build and verify skills); F-006 (`test/helpers/project.ts`,
  the verify skill).

## Invariants
- Without a Claude Code session ID, `session start`, `handoff` and `close` behave exactly as
  today.
- `session start` never reopens a closed session (`ended_at` set) and never changes a reused
  session's `skill`, `goal` or `started_at`.
- Session files keep today's frontmatter keys: Goals and Notes are body sections, so
  `parseSession` flags nothing new, and existing sessions parse with `goals` and `notes` `""`.
- Live logs stay append-only. The sidecar is the only file in `live/` that is rewritten, always
  whole and atomically (`writeFileAtomic`); its `started_at`, once set, never changes.
- `AZIMUTH_SESSION` still wins over the Claude Code session in `currentSession`; `--id` still
  wins over both.
- The SessionEnd hook appends `end` before anything else, exits 0 with no output, and closes
  without `loadProject`: it reads the sidecar (or the tail), the session file, the config and one
  `git log`. A failure while closing is logged to `hooks.log` like any hook error and leaves the
  session for `close --stale`.
- W-SESSION-OPEN's code and message don't change, and a session whose Claude Code session is
  unknown keeps today's 12-hour rule.
- The Hookline golden index changes only by the two empty fields on each session.

## Assumptions
- Goals lists the goals added after the first: the first stays in the frontmatter `goal`, which
  the session card already shows, so the first `session start` writes no Goals section. A start
  without `--skill` writes `<HH:MM> · <goal>`.
- Bullet times are `HH:MM` in UTC, like every time Azimuth writes to files. Newlines and runs of
  whitespace in a goal or note collapse to single spaces, so each is one bullet.
- A missing Goals or Notes section is appended at the end of the body; later bullets go at the
  end of their section. Section order doesn't matter to the parser.
- Reuse finds the Claude Code session's Azimuth session through the sidecar's `ses`, then the
  last `session` record in the live log's tail, and reuses it only when its file exists and
  `ended_at` is null. Both a new and a reused start append a `session` live record and set the
  sidecar's `ses`, so readers of the tail stay right too.
- `session start` prints only the ID (and `--json` keeps `{ "id": … }`), so scripts that capture
  it work unchanged.
- The sidecar is written without the project lock: its writers (SessionStart and
  `session start`) don't run at the same time in one Claude Code session, and the atomic rename
  keeps readers from seeing a partial file. A sidecar that is missing, isn't JSON or isn't an
  object reads as `null`; a field that isn't a string reads as `null`. When `session start` runs
  before any SessionStart (plugin not installed), it creates the sidecar with `started_at` null.
- `updateLiveMeta` ignores keys that are `undefined`, so a SessionStart input without
  `transcript_path` keeps the known path.
- Stale rule: an open session is stale when it started more than 12 hours ago and its Claude Code
  session's live log hasn't been written to in the last hour (or no sidecar names it).
  W-SESSION-OPEN and `close --stale` use the same rule. `close --stale` ends a stale session at
  the later of 12 hours after its start and its Claude Code session's last write, but never
  after now, so a long session that crashed keeps its later commits.
- "Last seen" is the live log's modification time: every hook appends to it, and reading one
  `stat` per sidecar keeps validation cheap. Sessions started before this feature have no
  sidecar and keep today's rule.
- The SessionEnd budget comes from Claude Code's hooks documentation (default 1.5 s;
  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` raises it; timeouts on plugin hooks don't), read on
  2026-10-20. If the project lock stays busy past it, Claude Code ends the hook and the session
  stays open until `close --stale`.
- SessionEnd closes the session for every end reason (`clear`, `resume`, `logout`,
  `prompt_input_exit`, `other`): each ends that Claude Code session.
