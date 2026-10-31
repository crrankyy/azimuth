---
id: BUG-0087
type: bug
title: Tests inherit the running Claude Code session's Azimuth variables
status: open
severity: medium
likelihood: null
impact: null
links: [F-011]
files: [vitest.config.ts, test/setup-env.ts]
found_by: SES-20261031-1611
created: 2026-10-31
resolved_at: null
---
## Repro
Run `pnpm exec vitest run test/e2e/cli.test.ts test/hooks/hooks.test.ts` from a Claude Code session whose Azimuth hooks run (they export `AZIMUTH_ACTOR=agent` and `AZIMUTH_CLAUDE_SESSION=<id>` into every Bash command).

## Expected
63 passed, as without those variables.

## Actual
BUG-0080's e2e test and S-011.4.4 fail. Helpers that spawn processes start from `process.env` (`gitEnv` in `test/helpers/git.ts`), so the spawned CLI takes the real `AZIMUTH_CLAUDE_SESSION`, which wins over the test's `CLAUDE_CODE_SESSION_ID`: the warning never prints and the session the test closes isn't the one it started. `runCli` already clears these variables; spawned processes didn't. Found on 2026-10-31, the first build in a session with working hooks.
