---
tasks:
  - id: T-027.1
    title: The CLI's session with its state (red → green)
    status: done
    after: []
    covers: [S-027.1.1, S-027.1.2, S-027.1.3, S-027.1.4, S-027.1.5, S-027.1.6]
    files: [src/core/session.ts, test/core/session.test.ts]
    verify: pnpm exec vitest run test/core/session.test.ts -t "S-027.1" --reporter=verbose
    note: null
  - id: T-027.2
    title: Pruning keeps an open session's live link (red → green)
    status: done
    after: [T-027.1]
    covers: [S-027.2.1, S-027.2.2, S-027.2.3, S-027.2.4, S-027.2.5]
    files: [src/core/live.ts, test/core/live.test.ts]
    verify: pnpm exec vitest run test/core/live.test.ts -t "S-027.2" --reporter=verbose
    note: null
  - id: T-027.3
    title: The start hook names the session the CLI will use (red → green)
    status: done
    after: [T-027.1, T-027.2]
    covers: [S-027.3.1, S-027.3.2, S-027.3.3, S-027.3.4, S-027.3.5, S-027.3.6, S-027.3.7, S-027.3.8, S-027.3.9]
    files: [src/hooks/handlers.ts, test/hooks/hooks.test.ts]
    verify: pnpm exec vitest run test/hooks/hooks.test.ts -t "S-027.3|S-011.7.3" --reporter=verbose
    note: null
  - id: T-027.4
    title: Docs, skill and full verification
    status: in-progress
    after: [T-027.3]
    covers: []
    files: [docs/file-format.md, docs/concepts.md, docs/cli.md, docs/claude-code.md, plugin/skills/azimuth/SKILL.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-027: Plan

Test-first, in one chain: the lookup with its state (T-027.1) is what pruning (T-027.2) and the
hook (T-027.3) build on, and the hook wires the prune. T-027.2 only needs `linkOpen` for its
tests, so it can start as soon as T-027.1 is done. T-027.4 changes the docs and the skill, then
runs everything.

Notes for builders:

- T-027.1: in `session.ts`, add `LinkState` and `LinkedSession` (contract.md) and
  `linkedSession(root, env)`: `const id = currentSession(root, env)`; null when it is null;
  `missing` when `existsSync(join(root, sessionFile(id)))` is false; else `readSession(root, id)`
  (null means `invalid`), then `open` or `closed` from `session.ended_at`. `linkOpen(root, c)` is
  `linkedSession(root, { AZIMUTH_CLAUDE_SESSION: c })?.state === "open"`. `openSessionOf`,
  `requireSession` and the rest stay as they are. Tests go in a new
  `describe("F-027 the session the CLI uses", …)` in `test/core/session.test.ts`, with its
  `project()` helper and `updateLiveMeta` for c1's sidecar; the session files are the texts in
  stories.md's preamble.
- T-027.2: `pruneLive(root, now = new Date(), keep: (claudeSession: string) => boolean = () => false)`.
  Inside the existing per-file `try`, after the age check, take the Claude Code session from the
  name (`.meta.json` first, then `.jsonl`; `META_SUFFIX` is already there) and skip the
  `unlinkSync` when `keep` returns true. Don't touch a kept file. Tests go in a new
  `describe("F-027 pruning keeps an open session's link", …)` in `test/core/live.test.ts`,
  with `writeTree`, `appendLive`, `updateLiveMeta`, `liveFile`, `liveMetaFile` and `utimesSync`
  (on both files) for the old times, `linkOpen` and `closeSession` from `src/core/session`, and
  `statSync(…).mtime.toISOString()` for the modification time (`2026-10-21T09:04:00.000Z`).
  S-014.7.3 must pass unchanged (no `keep`).
- T-027.3: in `handlers.ts`, import `linkedSession`, `linkOpen` and `LinkedSession` from
  `../core/session`; add `AZIMUTH_SESSION?` to `HookEnv`; pass `(c) => linkOpen(root, c)` to
  `pruneLive`; add the module-private `sessionLines(linked)` with the five pairs of contract.md.
  Compute `linkedSession(root, { AZIMUTH_SESSION: ctx.env.AZIMUTH_SESSION, AZIMUTH_CLAUDE_SESSION: id })`
  after `updateLiveMeta`, only for `resume`, `clear` and `compact`. In the compact branch, the
  two lines (each `- `-prefixed) replace the `if (live?.ses) …` bullet; `live` still gives the
  feature and task. For resume and clear, push `""` and the two lines after the handoff, so they
  end the context. Tests go in a new `describe("F-027 the session named at the start", …)` in
  `test/hooks/hooks.test.ts`, calling `sessionStart` in process like the F-011 block (its
  `ctx` shape, with `env` extended for S-027.3.9) on a `writeTree` project, and parsing
  `additionalContext`; S-027.3.1 also uses `startSession`, `utimesSync` on `liveFile` and
  `liveMetaFile`, `runCli` (`test/helpers/cli.ts`), `readdirSync` and `parseSession`.
  S-011.7.3's test changes on purpose: its project gains the open session file
  `.azimuth/sessions/SES-20261020-0900.md` (`ended_at: null`), since a sidecar naming a session
  without a file now gets the `missing` lines; its assertion on the line
  `- You are in Azimuth session SES-20261020-0900.` stays. The verify runs it with the F-027
  tests. The other session-start tests (`starts a session…`, `re-grounds the agent after
  compaction`, BUG-0012) check with `toContain` and pass unchanged.
- T-027.4 (wording; prettier realigns the tables):
  - `docs/file-format.md`, Cache paragraph: "live logs and their sidecars untouched for 72 hours
    are deleted" becomes "live logs and their sidecars untouched for 72 hours are deleted, except
    those of a Claude Code session whose Azimuth session is still open (`ended_at: null`), which
    are kept until it is closed, so a conversation resumed days later continues it".
  - `docs/concepts.md`, "Sessions and live activity": after "continues it and adds its goal.",
    add "So does a resumed conversation, however long it was closed, while its session is open:
    its link isn't pruned, and the start context says which session `session note` and
    `session handoff` write to." "Live logs are kept for 72 hours." becomes "Live logs are kept
    for 72 hours, or as long as their Azimuth session is open."
  - `docs/cli.md`, the paragraph on the current session: "which its sidecar
    (`cache/live/<claude-session>.meta.json`) keeps however long the session runs" becomes
    "which its sidecar (`cache/live/<claude-session>.meta.json`) keeps however long the session
    runs, and past the 72-hour pruning while that Azimuth session is open".
  - `docs/claude-code.md`, step 1 (Session start): after the compaction sentence, add "On a
    resume, after `/clear` and after a compaction, it also names the Azimuth session the CLI
    will use (from the same lookup as the CLI) and its state: open (`session note` and
    `handoff` write to it, `session start` adds its goal), closed, without a file, with errors,
    or none yet." Then add a sentence on pruning, which the page doesn't mention yet: "Live logs
    untouched for 72 hours are deleted at each session start, except those of a Claude Code
    session whose Azimuth session is still open."
  - `plugin/skills/azimuth/SKILL.md`, the session row: "Record work: one session per Claude Code
    session, closed by the plugin" becomes "Record work: one session per Claude Code session,
    closed by the plugin; a resumed conversation continues its open session, as its start
    context says".

Files shared with other 0.3.1 features (merge by hunk; F-027 changes only the passages above):
`docs/file-format.md`, `docs/concepts.md`, `docs/cli.md`, `docs/claude-code.md` and
`plugin/skills/azimuth/SKILL.md`. No other 0.3.1 feature changes `session.ts`, `live.ts` or
`handlers.ts`.
