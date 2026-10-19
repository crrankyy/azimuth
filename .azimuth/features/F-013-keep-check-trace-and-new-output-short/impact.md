---
files:
  - path: src/cli/commands/read.ts
    change: modify
    note: check takes --warnings and prints one warning summary line without it; trace takes --all and counts hidden mention-only references
  - path: src/cli/commands/write.ts
    change: modify
    note: newCommand prints the ID on stdout and the created files on stderr before recordInSession runs
  - path: src/core/create.ts
    change: modify
    note: createRecord applies the frontmatter updates before the exclusive write inside allocateId; patch() is removed
  - path: src/cli/main.ts
    change: read
    note: Unchanged error handler (✗ message and exit 1, or azimuth crashed and exit 3) reports a failure after the ID
  - path: src/core/session.ts
    change: read
    note: recordInSession, the step that still runs after creation (takes the lock; can fail with busy)
  - path: src/core/allocate.ts
    change: read
    note: allocateId writes the high-water mark only after its create callback succeeds
  - path: test/helpers/cli.ts
    change: create
    note: runCli() runs main() in-process against a project root and captures exit code, stdout and stderr
  - path: test/helpers/project.ts
    change: read
    note: featureFiles() builds the F-001 fixtures for the check and trace tests
  - path: test/cli/check.test.ts
    change: test
    note: S-013.1 warning summary, --warnings, IDs, warnings-only and --json
  - path: test/cli/trace.test.ts
    change: test
    note: S-013.2 hidden mention-only references, --all, no hint without mentions, --json
  - path: test/cli/new.test.ts
    change: test
    note: S-013.3 ID-only stdout, created line on stderr, chaining, --json, failures after and before the file exists
  - path: test/core/transitions.test.ts
    change: read
    note: Calls createIssue and createQuestion; must still pass after the patch() change
  - path: test/e2e/cli.test.ts
    change: read
    note: Unchanged; reads new through --json, check through exit codes and full listings with an ID
  - path: plugin/skills/azimuth/SKILL.md
    change: read
    note: Unchanged; its command table shows no output and the new hints name the flags
  - path: src/core/protocol.ts
    change: read
    note: Unchanged; tells agents to run check and fix errors, which check still lists in full
  - path: docs/cli.md
    change: modify
    note: check --warnings, trace --all, and what new prints on stdout and stderr (also bundled into azimuth docs cli)
---
# F-013: Impact map

Only the CLI's text output changes, plus one step in `create.ts`: the extra frontmatter fields of
decisions, questions and issues are written with the file instead of patched in afterwards. The
index, the validator, the hooks and the viewer are untouched. No test, hook, skill or protocol text
depends on the old text output: the e2e tests use `--json` and exit codes, and no skill shows the
old `created:` line.
