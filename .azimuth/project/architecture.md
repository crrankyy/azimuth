---
updated: 2026-10-20
reconciled_at: 9f08102
modules:
  - name: core
    path: src/core
    responsibility: Read .azimuth/ into a model, derive, validate, gate, build the index, every locked write, and verify runs
    depends_on: []
  - name: cli
    path: src/cli
    responsibility: Command parsing and output for the azimuth CLI, bundled to plugin/dist/cli.mjs
    depends_on: [core, hooks, server, docs]
  - name: hooks
    path: src/hooks
    responsibility: Claude Code hook handlers (session context, live activity, inbox delta, stop checks)
    depends_on: [core, server]
  - name: server
    path: src/server
    responsibility: The viewer's localhost HTTP server, SSE, actions, autostart and static export
    depends_on: [core]
  - name: viewer
    path: viewer/src
    responsibility: The React viewer, rendered from the index only
    depends_on: [core]
  - name: plugin
    path: plugin
    responsibility: The Claude Code plugin (launcher, hooks.json, skills) that runs the bundled CLI
    depends_on: [cli]
  - name: tests
    path: test
    responsibility: Vitest suites, the Hookline sample project and test helpers
    depends_on: [core, cli, hooks, server]
  - name: docs
    path: docs
    responsibility: User and contributor documentation
    depends_on: []
---
# Architecture

## Overview
One TypeScript package with three deliverables: the `azimuth` CLI, the viewer and the Claude Code
plugin. `docs/architecture.md` is the detailed description; this file is the summary agents load.

## Tech stack
TypeScript on Node 20+, React 19 and Vite for the viewer, esbuild for the CLI bundle, `yaml` for
frontmatter, Vitest, ESLint and Prettier. pnpm only.

## Directory layout
- `src/core`: library (no CLI, HTTP or React code)
- `src/cli`, `src/hooks`, `src/server`: bundled into `plugin/dist/cli.mjs`
- `viewer/`: React app, built to `plugin/dist/viewer/`
- `plugin/`: the plugin; `.claude-plugin/marketplace.json` makes the repo its own marketplace
- `test/`: tests, fixtures (`test/fixtures/hookline` is a sample project) and helpers
- `docs/`: user and contributor documentation; `file-format.md`, `concepts.md` and `cli.md` are
  also bundled into the CLI for `azimuth docs`

## Commands
- build: `pnpm build`
- typecheck: `pnpm typecheck`
- test: `pnpm test`
- lint: `pnpm lint`
- format: `pnpm format`

## Boundaries & invariants
- Files under `.azimuth/` are the source of truth; derived values are never stored.
- Every write goes through the project lock and an atomic rename; frontmatter edits are surgical
  and never re-serialize the Markdown body. `azimuth new` writes a record's extra fields with the
  file, inside `allocateId`, so a failed write uses no ID.
- Only `azimuth verify` takes the verify lock (`verify.lock` beside the write lock,
  `acquireVerifyLock` in `src/core/lock.ts`). It waits for a live holder instead of failing busy,
  is never taken from a live pid and covers a whole call (prebuild and every target).
- Verify commands and the prebuild run through `runShell` (`src/core/shell.ts`) as a detached
  process group; a timeout, or SIGINT/SIGTERM to `azimuth verify`, kills the whole group (SIGTERM,
  then SIGKILL after 2 s).
- `src/core/flows.ts`, `glob.ts`, `ids.ts`, `next.ts`, `placeholders.ts` and `types.ts` import no
  Node modules, so the viewer can use them.
- An agent answers a question only under `autonomy.questions: proceed`, and only a new,
  non-blocking one it raised with exactly one recommended option (`answer.by: agent`).
  `azimuth answer` stays yours, and your answer replaces an agent's.
- The viewer server binds 127.0.0.1, checks `Host` on every request and the token and `Origin` on
  writes, and always acts as you.
- One viewer per project: autostart reuses a recorded viewer that answers, or that times out while
  its pid is alive (busy), and a viewer whose `viewer.json` names another live instance exits once
  its last page closes.
- The spec hash covers feature.md's body, impact.md, stories.md (with every `{?}` and `{=…}`
  mapped to one token) and contract.md; `notes.md`, plan.md, log.md and as-built.md never make an
  approval stale.

## Data flow
`.azimuth/` files, git history, test files and hook logs → `buildIndex` → the index, which the CLI
prints and the server pushes to the viewer over SSE.

- Verify: `azimuth verify <IDs…>` resolves every ID first, then `verifyBatch`
  (`src/core/verify.ts`) takes the verify lock, runs `verify.prebuild` once under
  `verify.build_timeout_seconds`, then each target under `verify.timeout_seconds`, and writes run
  files to `.azimuth/cache/runs/` (with `waited_ms` and `ses`). `src/cli/verify-report.ts` turns
  its progress events into full or `--summary` lines.
- Done gate: `runScope` (`src/core/run-scope.ts`) gives the paths a task's runs depend on (its
  `files`, its feature's create/modify/test impact paths, the modules those modules depend on and
  `verify.shared_paths`), and `staleCause` (`derive.ts`) finds the first later commit that touched
  them; `done.verify-passed` names that commit and path.
- Parallel tasks: `parallel.shared_files` reaches the index as `project.shared_files`.
  `W-FILE-CONFLICT` (`validate.ts`) and `derived.file_conflicts` (`derive.ts`) skip matching
  paths, and `taskGroups` (`next.ts`) groups a feature's ready tasks for `azimuth next F-NNN`
  (`--json`: `{items, groups}`).
- Questions: under `proceed`, `new question` follows `createQuestion` with
  `proceedWithRecommendation` (`transitions.ts`). `inbox.ts` lists the agent's answer as a Review
  item until `azimuth ack Q-…` or your answer, and `delta.ts` and `next.ts` keep it out of
  "Decided by the user".
- CLI text output: `new` prints only the new ID on stdout (files and notes on stderr) before
  anything that can still fail; `check` lists errors and counts warnings by code unless
  `--warnings` or an ID asks for them; `trace` hides mention-only references unless `--all`.
  `--json` output is unchanged.
- Records outside the approval: `azimuth note` (`src/core/notes.ts`) appends to a feature's
  `notes.md`, which the index carries and the As-built tab shows; `azimuth settle`
  (`src/core/settle.ts`, `placeholders.ts`) replaces a `{?}` with `{=value}` and logs it. The done
  gate waits while any `{?}` remains, and `inbox.ts` lists settles made after `review_ack_at`.
  `settle` writes stories.md and its `Settled <S-ID>: {=value}` agent note in one locked step. The
  Review item covers features you approved too, and `azimuth ack F-…` (`acknowledge`) clears it.
  The Stories tab renders values through `placeholderParts`.
- Sessions: within one Claude Code session, `session start` (`src/core/session.ts`) reuses the
  open SES and adds its goal to a Goals list; `session note` appends to Notes; SessionEnd closes
  the SES from its own file. The sidecar `live/<claude-session>.meta.json` (`readLiveMeta`,
  `updateLiveMeta` in `live.ts`) keeps `started_at`, `ses` and `transcript_path`, so they survive
  the live log's 64 KB tail.
- Viewer: each issue has a page at `#/issues/<id>/page` (`viewer/src/screens/issues/`), whose
  related work (`related.ts`) and history (`history.ts`) are derived from the index on every
  render.
