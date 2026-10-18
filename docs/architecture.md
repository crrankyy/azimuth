# Architecture

Azimuth is one TypeScript package with three deliverables built from it: the `azimuth` CLI (a
single bundled ES module), the viewer (a React app built to one JS and one CSS file) and the
Claude Code plugin (skills, hooks and the launcher that runs the CLI).

```
src/core     the library: reading, analysis, writes            (no CLI, HTTP or React code)
src/cli      command parsing and output                        → plugin/dist/cli.mjs (esbuild)
src/hooks    Claude Code hook handlers                          (bundled into the CLI)
src/server   the viewer's HTTP server, actions, export, autostart
viewer/      the React app                                      → plugin/dist/viewer/ (Vite)
plugin/      the Claude Code plugin: .claude-plugin/plugin.json, bin/azimuth, hooks/, skills/
.claude-plugin/marketplace.json   makes the repository its own plugin marketplace
test/        fixtures, helpers and tests (Vitest); viewer unit tests live next to their code
```

## Data flow

```
.azimuth/ files ──loadProject──▶ Model ──┐
git history ─────gitFacts───────▶ Facts ──┼─▶ derive ─▶ validate ─▶ gates / inbox ─▶ Index
test files ──────traceTests─────▶        ─┘
hook logs ───────readLiveSessions─────────────────────────────────────────────────▶ Index.live
```

1. **`model.ts`** reads `.azimuth/` into a typed `Model`. Parsers (`parse/*`) never throw on bad
   content: they return entities plus `Problem`s with file and line; records with schema errors are
   left out. Parse results are memoized by path, mtime and size.
2. **`git.ts`** reads history in one `git log` (abbreviated SHAs, `Refs:` and `Co-Authored-By:`
   trailers, changed files) and committed spec files in one `git cat-file --batch`.
   **`trace.ts`** finds scenario markers in test files.
3. **`derive.ts`**, **`validate.ts`**, **`gates.ts`** and **`inbox.ts`** are pure functions over the
   model and injected facts (including the clock), so every rule is unit-tested without I/O.
4. **`build-index.ts`** assembles the index, the contract in `types.ts` that the viewer renders and
   `status --json` prints. `rev` hashes its content (excluding live data and timestamps) so the
   server pushes a new index only when something changed.

## Writes

Changes to entities go through **`transitions.ts`** (status moves, answers, field updates, log
entries) or **`create.ts`** (new entities), shared by the CLI and the viewer's actions.
**`session.ts`** writes sessions under the same lock, **`verify.ts`** creates run records through
`allocate.ts`, and **`init.ts`** writes the initial project before there is anything to lock. The
hooks only append to the live activity logs. The building blocks:

- **`lock.ts`**: a project write lock (an exclusive lock file in the main worktree's cache, stolen
  when its owner died or after 30 s) and temp-file-and-rename writes.
- **`frontmatter.ts`**: surgical YAML edits that replace only the changed value's source range and
  never re-serialize Markdown bodies (including CRLF and BOM files), plus edits to one item of a
  list (a task in `plan.md`).
- **`allocate.ts`**: IDs allocated under the lock from the highest of the files on disk and a
  high-water mark, created exclusively, never reissued.
- **`flows.ts`** holds the lifecycle tables (which status can follow which) and `ACTIVE_STATUSES`.
  It imports nothing but types, so the viewer uses it too; keep it, `ids.ts` and `types.ts` free of
  Node imports.
- The transition rules (lifecycle tables, actor and autonomy policy) are pure functions tested
  exhaustively; gates come from `gates.ts`; every move appends a log entry.

## The viewer server

**`server.ts`** serves the app as a single page (the built JS and CSS inlined, so there are no
static routes) on `127.0.0.1`, checks `Host` on every request and the per-launch token and
`Origin` on writes, and pushes changes over SSE. **`watch.ts`** combines `fs.watch` hints with a
stat-signature poll and debounces bursts. **`actions.ts`** maps viewer actions onto
`transitions.ts`, always as you. **`autostart.ts`** starts one detached server per project and
health-checks it over HTTP. **`export.ts`** builds the self-contained snapshot.

## The viewer

`viewer/src/data/IndexProvider.tsx` loads the index (embedded in exports, or `/api/index` plus the
event stream when served), reconnects, and exposes actions. Screens (`viewer/src/screens`) render
from the index only; shared pieces live in `viewer/src/components` (names follow the design brief)
and `viewer/src/lib` (hash router, keys, Markdown renderer, code tokenizer, DAG layout). Styles are
the design handoff's `azimuth.css` tokens and primitives plus `base.css`.

## Claude Code plugin

`plugin/bin/azimuth` is a POSIX launcher: it exits immediately for hooks outside Azimuth projects,
finds Node 20+ and runs `dist/cli.mjs`. `plugin/hooks/hooks.json` maps Claude Code events to
`azimuth hook <event>` (`src/hooks/handlers.ts`). Live activity is append-only JSONL per Claude
session, read from the tail (`src/core/live.ts`). The skills (`plugin/skills/*/SKILL.md`) encode
the workflow and call the CLI.
