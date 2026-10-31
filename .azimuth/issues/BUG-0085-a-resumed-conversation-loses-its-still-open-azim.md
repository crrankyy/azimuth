---
id: BUG-0085
type: bug
title: A resumed conversation loses its still-open Azimuth session after 72 hours
status: open
severity: medium
likelihood: null
impact: null
links: [BUG-0084]
files: [src/core/live.ts, src/hooks/handlers.ts, src/core/session.ts]
found_by: SES-20261031-1611
created: 2026-10-31
resolved_at: null
---
## Repro
In ZenithMD: Claude Code session b7f1a9ae started Azimuth session SES-20261020-1343 on 2026-10-20 and added a goal to it on 2026-10-21 at 09:04 UTC. Its process then ended without SessionEnd closing the session (`ended_at` is still null). On 2026-10-24 at 15:46 UTC a new Claude Code session started and its SessionStart hook ran `pruneLive`, which deletes live files untouched for 72 hours, b7f1a9ae's sidecar included. That conversation was then resumed (SessionStart `resume`, same session ID), and `azimuth session note` and `azimuth session handoff` failed.

## Expected
The resumed conversation is still in SES-20261020-1343, the session its own `session start` opened and that nothing closed, and the hook and the CLI agree on it.

## Actual
``✗ No current session. Start one with `azimuth session start` or pass --id.`` The sidecar holding `ses` was pruned, so `currentSession` found nothing. The agent started SES-20261024-1601 instead, and the goal line added to SES-20261020-1343 three days earlier was left uncommitted. The resume hook printed only "Last handoff (SES-20261020-1343 …)". The "You are in Azimuth session SES-20261020-1343" the release report quotes came from an earlier compaction, not from the resume.

## Fix
F-027 (the user decided on 2026-10-31: keep the link while the session is open, and make the resume hook say which session the CLI will use).
