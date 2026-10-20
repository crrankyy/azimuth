---
id: BUG-0080
type: bug
title: A Claude Code session started before the plugin was enabled runs without Azimuth's hooks, and nothing says so
status: resolved
severity: high
likelihood: null
impact: null
links: []
files: [src/core/live.ts, src/cli/commands/work.ts, src/cli/commands/harness.ts]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: 2026-10-20
---
## Repro
1. Start a Claude Code session in a repository, then install or enable the Azimuth plugin
   (`claude plugin install azimuth@azimuth`) without restarting it or running `/reload-plugins`.
2. Work on: `azimuth session start`, prompts, tool calls.

## Expected
Either the hooks run, or Azimuth says they don't and how to fix it.

## Actual
Claude Code loads a plugin's hooks only at session start or on `/reload-plugins`, so none of
Azimuth's hooks run in that session: no prompt or tool records, no SessionStart (the sidecar's
`started_at` and `transcript_path` stay null), no autostart of a stale viewer and no SessionEnd,
so its Azimuth sessions stay open. Nothing reports it: `azimuth doctor` says "Hooks are recording"
because `azimuth session start` itself writes `session` records to the live log. Seen in session
0d8b4fdf (started 2026-10-17T20:30Z, plugin enabled 2026-10-18T01:32Z): the 4319 viewer went
blank after a rebuild, and SES-20261019-2008 stayed open through the whole v0.2 build.
