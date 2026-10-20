---
id: BUG-0079
type: bug
title: The installed plugin can't find its own CLI or viewer, so autostart stops the viewer and never restarts it
status: in-progress
severity: high
likelihood: null
impact: null
links: []
files: [src/server/autostart.ts, src/cli/commands/viewer.ts]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: null
---
## Repro
1. Install the plugin (`claude plugin install azimuth@azimuth`), which copies `plugin/` to
   `~/.claude/plugins/cache/azimuth/azimuth/<version>/`.
2. Run `azimuth view` with that copy, or let a hook autostart the viewer.

## Expected
The copy serves the viewer from its own `dist/viewer`, and autostart restarts a viewer of another
build with the copy's `dist/cli.mjs`.

## Actual
`viewerDir()` and `cliPath()` treat the bundle as "built" only when its folder ends in
`plugin/dist`; the copy's folder is `<version>/dist`, so they resolve paths of a source checkout
that don't exist. `azimuth view` fails with "The viewer isn't built
(~/.claude/plugins/cache/azimuth/plugin/dist/viewer)", and `buildId()` falls back to the bare
version, so every prompt's hook finds a running viewer "stale", stops it and spawns a CLI path
that doesn't exist: the viewer goes away and stays away. Present since f30f32c (v0.1); found
when the installed plugin was updated to 0.2.0.
