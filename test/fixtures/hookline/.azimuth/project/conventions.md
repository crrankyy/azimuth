---
updated: 2026-09-03
---
# Conventions

## Error handling
Domain code returns `Result<T, E>`. Only the HTTP boundary throws.

## Testing
Vitest. Test titles start with the scenario ID. Unit tests make no network calls; use `fakeReceiver()`.

## Naming
Files are kebab-case, types PascalCase, functions camelCase.

## Commits
Conventional Commits with `Refs:` trailers.
