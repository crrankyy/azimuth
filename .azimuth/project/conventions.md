---
updated: 2026-10-18
---
# Conventions

## Error handling
Validate at boundaries (files, CLI arguments, HTTP requests, hook stdin) and report problems with a
code, file and line (`src/core/errors.ts`, `Problem` in `src/core/types.ts`). Parsers never throw on
bad content. Refusals are typed errors (`GateError`, policy, conflict, busy) mapped to exit codes in
the CLI and HTTP statuses in `src/server/actions.ts`. No empty `catch`, no silenced lint or type
errors.

## Testing
Vitest. Core rules are pure functions tested without I/O (`test/core`); the CLI, hooks and server
are tested end to end against temp repos built from `test/fixtures/hookline`
(`test/helpers/demo-repo.ts`). Viewer libraries have tests next to their code. Tests written for an
Azimuth scenario or bug start their name with its ID.

## Naming
Small pure functions, early returns, no classes. Viewer component names follow the design brief.

## Logging
The CLI prints results to stdout and problems to stderr; hooks print exactly one JSON document or
nothing. No debug output is committed.

## Dependencies
Runtime: `yaml` (bundled into the CLI), `react` and `react-dom`. Everything else (glob, JUnit,
Markdown, DAG layout) is in-house. New dependencies need the owner's approval.

## Commits
Conventional Commits, imperative subject of 72 characters or fewer, a body that explains why, and a
`Refs:` trailer naming the issue, task or feature.
