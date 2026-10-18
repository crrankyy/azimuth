---
id: BUG-0012
type: bug
title: Answers given between sessions never reach the agent
status: open
severity: high
likelihood: null
impact: null
links: []
files: [src/hooks/handlers.ts, src/core/brief.ts, src/core/next.ts]
found_by: SES-20261018-1454
created: 2026-10-18
resolved_at: null
---
## Repro
1. A session raises a blocking question and ends (greenfield test, session 3).
2. Answer it in the viewer.
3. `claude -p --continue "Continue."`.

## Expected
The agent is told what you did since its last turn, as `docs/claude-code.md` promises ("anything that happened while the agent was idle is passed to Claude with your next prompt"), and the start context lists answered questions waiting to be applied.

## Actual
No delta: the resume `start` record resets the prompt hook's cursor (`cursorOf` stops at the latest start), so answers made before the resume are skipped. The SessionStart brief omits answered-but-unapplied questions, and its Next line said `azimuth move F-002 approved`, inviting approval before applying the answers.
