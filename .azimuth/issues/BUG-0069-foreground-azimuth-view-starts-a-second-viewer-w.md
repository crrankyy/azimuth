---
id: BUG-0069
type: bug
title: Foreground azimuth view starts a second viewer when the running one is busy
status: open
severity: medium
likelihood: null
impact: null
links: [BUG-0068]
files: [src/cli/commands/viewer.ts]
found_by: SES-20261019-2021
created: 2026-10-19
resolved_at: null
---
## Repro
1. Have a viewer running for a project that is busy rebuilding a large index, so it misses the
   500 ms health check.
2. Run `azimuth view` in the foreground in that project.

## Expected
The running viewer is reused, as autostart does since the BUG-0068 fix.

## Actual
`src/cli/commands/viewer.ts` reuses only a viewer whose health is `ok`, so it starts a second
one; the first exits once its pages close. Autostart treats `busy` as reusable, the foreground
command doesn't.
