---
completed_at: 2026-10-20
files_changed:
  - { path: test/helpers/cli.ts, change: create }
  - { path: src/cli/commands/read.ts, change: modify }
  - { path: test/cli/check.test.ts, change: create }
  - { path: test/cli/trace.test.ts, change: create }
  - { path: src/cli/commands/write.ts, change: modify }
  - { path: src/core/create.ts, change: modify }
  - { path: test/cli/new.test.ts, change: create }
  - { path: docs/cli.md, change: modify }
deviations:
  - { path: src/core/create.ts, kind: design-change, reason: "The idea asked new to print the ID before patch() and recordInSession could fail. Instead patch() is gone and the extra fields of decisions, questions and issues are written with the file inside allocateId, so fields that can't be written leave no file and use no ID (S-013.3.6); recordInSession is the only step left after the ID. The approved spec already said so" }
follow_ups: []
---
# F-013: As built

## Summary
`azimuth check` without an ID lists every error, then counts the warnings by code on one line,
most frequent first (`<W> warnings: <n> <CODE>, … (--warnings lists them)`). `--warnings` or an
ID lists them in full, and `--json` still lists every problem. `azimuth trace` hides references
that only mention a scenario ID and says how many it hid
(`<n> mention-only references hidden (--all shows them)`); `--all` shows them with the
` (mention)` suffix. `azimuth new` prints only the new ID on stdout, without colour, and the
created files on stderr (`created <paths>`). It prints them before recording the ID in the
session, so a later failure (such as `busy` from the session lock) is reported after the ID and
`$(azimuth new …)` never loses one.

`test/helpers/cli.ts` runs `main()` in process and captures the exit code, stdout and stderr, so
the new tests need no build. F-010's CLI tests use it too.

## Deviations
- `patch()` is gone from `src/core/create.ts`: the extra fields of decisions, questions and issues
  (links, options, severity, files) are written with the file inside `allocateId`. The idea only
  asked to print the ID before `patch()` and `recordInSession` could fail. Now a record whose
  fields can't be written leaves no file and uses no ID, and `recordInSession` is the only step
  after the ID. The approved spec already described this.

Otherwise the files match `impact.md`.

## Follow-ups
None.
