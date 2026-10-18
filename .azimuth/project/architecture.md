---
updated: 2026-10-18
reconciled_at: b48cc93
modules:
  - name: core
    path: src/core
    responsibility: Read .azimuth/ into a model, derive, validate, gate, build the index, and every locked write
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
  and never re-serialize the Markdown body.
- `src/core/flows.ts`, `glob.ts`, `ids.ts` and `types.ts` import no Node modules, so the viewer can
  use them.
- The viewer server binds 127.0.0.1, checks `Host` on every request and the token and `Origin` on
  writes, and always acts as you.

## Data flow
`.azimuth/` files, git history, test files and hook logs → `buildIndex` → the index, which the CLI
prints and the server pushes to the viewer over SSE.
