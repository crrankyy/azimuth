# Development

## Setup

```sh
pnpm install
pnpm build          # viewer → plugin/dist/viewer, CLI → plugin/dist/cli.mjs
```

Node 20+ and pnpm are required. TypeScript is pinned to 6.0 because typescript-eslint doesn't
support 7.x yet.

| Script                              | What it does                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm build`                        | Builds the viewer and the CLI bundle                                                             |
| `pnpm test`                         | Builds, then runs every test (Vitest), one file at a time so timing budgets hold                 |
| `pnpm typecheck`                    | `tsc` for the core/CLI and for the viewer                                                        |
| `pnpm lint`                         | ESLint (typescript-eslint, React hooks rules for the viewer)                                     |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                         |
| `pnpm dev:viewer`                   | The viewer on Vite's dev server, rendering the Hookline sample (no backend; actions are refused) |

To try the plugin in Claude Code without installing it: `claude --plugin-dir ./plugin`.

## Tests

| Folder                   | Covers                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/core`              | Parsers, frontmatter edits, analysis (derive, validate, gates, inbox), git and trace, transitions (including the exhaustive status × actor × autonomy matrix), allocation                                               |
| `test/golden`            | The index built from the Hookline fixture equals the design sample, section by section, except for documented deviations                                                                                                |
| `test/fixture`           | The fixture itself parses and replays correctly                                                                                                                                                                         |
| `test/e2e`               | The CLI through the launcher with no Node on PATH, in a temporary git repository: init, approval (automatic and manual), uncommitted specs, re-approval, verify, sessions, drift, exit codes, 20 concurrent `new` calls |
| `test/hooks`             | Every hook with the JSON Claude Code sends: fast exit, env exports, compaction, 50 concurrent events, wake-ups, prompt deltas, edit and stop checks                                                                     |
| `test/server`            | The viewer server: guards, SSE (polling path), actions and refusals, approval diffs, export; autostart and restart                                                                                                      |
| `viewer/src/**/*.test.*` | Viewer libraries and components: graph layout, state-diagram parser, tokenizer, Markdown (emphasis, link safety), task graph and run results                                                                            |

`test/helpers/demo-repo.ts` builds the Hookline repository: it copies
`test/fixtures/hookline/`, replays its twelve dated commits with trailers into a temporary git
repository and fills in SHAs and approval hashes. Git runs with `GIT_CONFIG_GLOBAL=/dev/null` so
your own git configuration can't affect results.

## Conventions

- Core code is plain functions over data; I/O stays at the edges (`model.ts`, `git.ts`, `lock.ts`,
  the CLI and the server). Analysis takes injected facts and a clock.
- Entity writes go through `transitions.ts` and `create.ts` under the project lock; sessions
  (`session.ts`) and run records (`verify.ts`, via `allocate.ts`) are locked too. Only `init.ts`
  writes without the lock, before the project exists.
- Problems, not exceptions, for bad project content; `AzimuthError` for refusals the user should
  see (gate, policy, conflict, busy, not found, invalid).
- Timestamps are UTC at whole seconds (`toUtc`), matching git.
- The viewer renders from the index only; compute on the client what the index doesn't carry.
  Don't call `Date.now()` during render (use the provider's `now`).
- Commits follow Conventional Commits with `Co-Authored-By` for agent work.

## Releasing

v0.1 is installed from a local clone (see [getting started](getting-started.md)); the build
output (`plugin/dist/`) isn't committed. Bump `version` in `package.json`, `src/core/version.ts`
and `plugin/.claude-plugin/plugin.json` together (a test checks that the first two match); a
running viewer from an older version is replaced automatically.
