---
completed_at: 2026-10-20
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: src/cli/commands/harness.ts, change: modify }
  - { path: src/cli/commands/task.ts, change: modify }
  - { path: src/cli/commands/work.ts, change: modify }
  - { path: src/cli/verify-report.ts, change: modify }
  - { path: src/core/config.ts, change: modify }
  - { path: src/core/disk.ts, change: create }
  - { path: src/core/finish.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: src/core/init.ts, change: modify }
  - { path: src/core/parse/run.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/verify.ts, change: modify }
  - { path: test/cli/disk.test.ts, change: create }
  - { path: test/cli/doctor.test.ts, change: modify }
  - { path: test/cli/verify-report.test.ts, change: modify }
  - { path: test/cli/verify.test.ts, change: create }
  - { path: test/core/disk.test.ts, change: create }
  - { path: test/core/finish.test.ts, change: modify }
  - { path: test/core/prebuild-gate.test.ts, change: create }
  - { path: test/core/verify-batch.test.ts, change: modify }
  - { path: test/core/verify-config.test.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
deviations: []
follow_ups: []
---
# F-018: As built

## Summary
`verify.prebuild_failure: continue` lets each target's own command run after a prebuild that exited non-zero, under the build timeout plus the test timeout; a timed-out or interrupted prebuild still records nothing, and `stop` stays the default. Every run records the prebuild that served it (`prebuild: { ok, duration_ms } | null`), `verify --summary` and `task finish` print its time, and `done.verify-passed` asks for a rerun of a run made after a failed prebuild. `verify.min_free_gb` (default 10) makes `verify`, `task finish` and `doctor` warn on a nearly full disk. The build skill now finishes a lane as soon as it reports.

## Deviations
None. `src/cli/commands/harness.ts` was adopted into T-018.8 for doctor's summary line; it was already in impact.md (T-018.7).

## Follow-ups
None.
