---
id: F-027
title: A resumed conversation keeps its open Azimuth session
summary: Pruning keeps the live log and sidecar of a Claude Code session whose Azimuth session is still open, and the start hook on resume, clear and compact names the session the CLI will use, from the CLI's own lookup (BUG-0085).
status: verifying
priority: P1
size: M
mode: brownfield
milestone: M-03
depends_on: []
superseded_by: null
tags: []
created: 2026-10-31
updated: 2026-10-31
approved_at: 2026-10-31
approved_by: agent
approved_hash: sha256:18a645a67d0f2e1c343ac89bff5dd6c63dc60b59e7c3fdda4ff66520bc08f7b4
approved_commit: 0935b31
review_ack_at: null
---
# F-027: A resumed conversation keeps its open Azimuth session

## Objective
In ZenithMD, Claude Code session b7f1a9ae opened SES-20261020-1343 on 2026-10-20 and added a goal
to it on 2026-10-21 at 09:04 UTC. Its process then ended without SessionEnd, so the session stayed
open. On 2026-10-24 at 15:46 UTC another Claude Code session started, and its SessionStart hook ran
`pruneLive`, which deletes every live file untouched for 72 hours. b7f1a9ae's sidecar went with
them, and the sidecar held the link (`ses`). When the user resumed b7f1a9ae, `azimuth session note`
and `handoff` failed with "No current session", the agent opened SES-20261024-1601, and the goal
line written to SES-20261020-1343 was left uncommitted. The resume hook printed only "Last handoff
(SES-20261020-1343 …)", which didn't say which session the CLI would use (BUG-0085).

This feature makes a resumed conversation continue its session, and makes the hook say so:

- **The link of an open session is never pruned.** `pruneLive` takes a `keep` check. The
  SessionStart hook passes `linkOpen`: a Claude Code session whose link (`sessionOfClaude`, the
  sidecar's `ses`, else the live log's last `session` record) names an Azimuth session whose own
  file says `ended_at: null`. For such a session both files are kept, the live log and its
  sidecar, whatever their age. Once that Azimuth session is closed (by SessionEnd, by
  `session close`, or by `session close --stale`), the next prune deletes both by the usual
  72-hour rule.
- **The hook names the session the CLI will use.** A new `linkedSession(root, env)` in
  `src/core/session.ts` calls `currentSession`, the lookup every CLI command uses, and adds the
  state of that session's file: `open`, `closed`, `missing` or `invalid`. On a SessionStart with
  source `resume`, `clear` or `compact`, the hook prints two lines for that state (see
  Assumptions), so the hook and the CLI can't disagree.
- **The old session's goal line.** With the link kept, a resumed conversation is still in its
  session: `azimuth session note`, `handoff` and `start` write to SES-20261020-1343, and its
  `session start` adds the new goal there instead of opening a new session. The goal line added
  three days earlier simply belongs to the continued session, and it is committed with the next
  commit of `.azimuth/` records, like any other session change.

## Out of scope
- A SessionEnd hook that never ran (the process died or was killed): the session stays open until
  the conversation is resumed and ends normally, or until `azimuth session close --stale` closes
  it, as today.
- Repairing projects where the link is already gone, such as ZenithMD's b7f1a9ae: F-027 prevents
  the loss but doesn't restore a deleted sidecar. That session's goal line is committed by hand.
- Any change to the CLI's session commands. `note`, `handoff` and `close` keep writing to a
  closed session, and `start` keeps opening a new session instead of reopening a closed one.
- The startup context (source `startup`, or no source): a new conversation has no link, so it
  prints nothing new.
- The viewer's live sessions (`readLiveSessions` still skips logs untouched for 72 hours),
  `sessionsLastSeen`, `anySessionOpen`, `W-SESSION-OPEN`, `closeStaleSessions` and SessionEnd's
  own lookup.
- A size cap on a kept live log.

## Integration points
- `src/core/session.ts`: new `LinkState`, `LinkedSession`, `linkedSession(root, env)` (built on
  `currentSession` and the module's `readSession`) and `linkOpen(root, claudeSession)` (built on
  `linkedSession`). `currentSession`, `sessionOfClaude`, `startSession`, `openSessionOf`,
  `requireSession`, `appendNote`, `writeHandoff` and `closeSession` are unchanged.
- `src/core/live.ts`: `pruneLive(root, now, keep)` gains an optional `keep` check, asked for each
  live log (`<c>.jsonl`) and sidecar (`<c>.meta.json`) older than 72 hours, with the Claude Code
  session name taken from the file name. live.ts doesn't import session.ts (session.ts imports
  live.ts), so the check is passed in.
- `src/hooks/handlers.ts`: `sessionStart` calls `pruneLive(root, now, (c) => linkOpen(root, c))`;
  for `resume`, `clear` and `compact` it adds the session lines from
  `linkedSession(root, { AZIMUTH_SESSION: ctx.env.AZIMUTH_SESSION, AZIMUTH_CLAUDE_SESSION: id })`.
  The compaction note's `- You are in Azimuth session …` line is replaced by those lines.
  `HookEnv` gains `AZIMUTH_SESSION`. The hook command passes `process.env` as `ctx.env`
  (`src/cli/commands/harness.ts`), the environment Claude Code gives its hooks.
- The CLI reads the current session through `runtime()` (`src/cli/io.ts`, `currentSession` with
  `process.env`); `session note`, `handoff` and `close` use it unless `--id` is given
  (`src/cli/commands/work.ts`). Neither file changes.
- Docs and skills: `docs/file-format.md` (the Cache paragraph's pruning sentence),
  `docs/concepts.md` (the live logs sentence of "Sessions and live activity"), `docs/cli.md` (the
  paragraph on the current session), `docs/claude-code.md` (step 1, Session start) and
  `plugin/skills/azimuth/SKILL.md` (the session row). Each is shared with other 0.3.1 features;
  F-027 changes only these passages.

## Invariants
- `pruneLive(root, now)` without `keep` deletes what it deletes today (S-014.7.3 passes
  unchanged).
- A kept file is not written, renamed or touched: its modification time stays, so
  `sessionsLastSeen` and `session close --stale` still see the session's real last activity.
- A live file older than 72 hours whose Claude Code session has no open link is deleted, as
  today, in the same call that keeps another session's files.
- The hook's session lines come from `linkedSession`, which calls `currentSession`; there is no
  second lookup. For any environment, the ID the hook names is the ID `session note` and
  `handoff` use without `--id`.
- The CLI's output, exit codes and files written are unchanged for every command.
- The startup context is unchanged, and every hook still prints exactly one JSON document or
  nothing.

## Assumptions
- Both files of an open link are kept, not only the sidecar. The sidecar alone would restore
  `currentSession`, but the live log carries the prompt cursor, so the user's decisions made while
  the conversation was closed still reach its first prompt after a resume (BUG-0012's behaviour),
  and it is the link itself for a session recorded before sidecars existed.
- `linkOpen(root, c)` is `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: c })?.state === "open"`:
  it ignores `AZIMUTH_SESSION`, because pruning is about one Claude Code session's own link.
- The states: `open` when the session's file parses and `ended_at` is null; `closed` when it is
  set (`ended_at` carries the value); `missing` when `.azimuth/sessions/<ID>.md` doesn't exist;
  `invalid` when the file's frontmatter doesn't parse (`parseSession` returns no entity).
  `ended_at` is null for every state but `closed`.
- What the CLI does in each state, which the hook's lines state: `open`, note and handoff write to
  the session and start adds its goal; `closed` and `invalid`, start opens a new session while
  note and handoff still write to the linked one (`requireSession` checks only that the file
  exists); `missing`, start opens a new session and note and handoff fail with
  `SES-… does not exist.`; no link, note and handoff fail with "No current session".
- The lines, with `<ID>` and `<ended_at>` filled in:
  - open: `You are in Azimuth session <ID>.` and
    `` `azimuth session note` and `azimuth session handoff` write to it, and `azimuth session start` adds its goal to it.``
  - closed: `This conversation's Azimuth session <ID> was closed at <ended_at>.` and
    `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` still write to <ID>.``
  - missing: `This conversation's Azimuth session <ID> has no file in .azimuth/sessions/.` and
    `` `azimuth session start` opens a new one; until then `azimuth session note` and `azimuth session handoff` fail with "<ID> does not exist."``
  - invalid: ``This conversation's Azimuth session <ID> has errors (run `azimuth check`).`` and
    the closed state's second line.
  - no link: `No Azimuth session in this conversation yet.` and
    ``Run `azimuth session start --skill <skill> --goal "<goal>"` before `azimuth session note` or `azimuth session handoff`.``
- The first line of the open state keeps F-011's wording (`You are in Azimuth session <ID>.`), so
  the compaction note keeps the line S-011.7.3 names. S-011.7.3's test gives its sidecar's session
  a file (`SES-20261020-0900`, open): without one the state is `missing`, and the hook now says so
  instead of "You are in". The test changes because the behaviour changed on purpose, not to make
  it pass.
- Resume and clear: the two lines end the context, after a blank line, below the status brief and
  the last handoff. Compaction: they replace the `- You are in Azimuth session …` bullet, each
  prefixed `- `, right after `Azimuth (context restored after compaction):`, and are printed in
  every state (today the bullet is printed only with a link).
- The hook computes the lines after it prunes and records the start, with the Claude Code session
  ID it received, whatever Claude Code does with session IDs on `/clear`. It passes its own
  `AZIMUTH_SESSION`, since Claude Code starts hooks and Bash commands from the environment it was
  started in (not verified against Claude Code's docs). `CLAUDE_ENV_FILE` exports reach only
  Bash commands, and the hook passes the Claude Code session ID itself.
- `keep` is asked only for a file older than 72 hours whose name ends in `.jsonl` or
  `.meta.json`, inside the existing per-file `try`; any other old file is deleted as today. It may
  be asked twice for one Claude Code session (once per file).
- In the BUG-0085 replay, the session's own start and goal happen through `startSession` with
  `claudeSession: "b7f1a9ae"`, and the files' times are set with `utimesSync` to
  2026-10-21T09:04:00Z, 78 h 42 min before the other session's start at 2026-10-24T15:46:00Z.
