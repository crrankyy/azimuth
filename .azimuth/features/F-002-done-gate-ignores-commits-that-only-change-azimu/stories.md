# F-002: Stories

## ST-002.1 · Verify runs stay current across record-only commits
**Intent:** As an agent closing out a feature, I want a passing verify run to stay valid when only Azimuth's records change after it so that I don't rerun every verify command after writing the as-built.

### S-002.1.1 · Only records changed since the run {happy}
- **GIVEN** a done task whose latest run passed at commit A, and one later commit that only changes files under `.azimuth/`
- **WHEN** the feature's done gate is evaluated
- **THEN** `done.verify-passed` is ok

### S-002.1.2 · Code changed since the run {negative}
- **GIVEN** a done task whose latest run passed at commit A, and one later commit that changes `src/app.ts`
- **WHEN** the feature's done gate is evaluated
- **THEN** `done.verify-passed` fails with the detail "T-001.1 last passed at A"

### S-002.1.3 · Unknown changed files {edge}
- **GIVEN** a done task whose latest run passed at commit A, and one later commit whose changed files aren't in the git facts
- **WHEN** the feature's done gate is evaluated
- **THEN** `done.verify-passed` fails with the detail "T-001.1 last passed at A"

## ST-002.2 · The architecture is compared with the feature's last code commit
**Intent:** As an agent closing out a feature, I want the close-out commit itself not to count against the architecture reconciliation so that reconciling before committing the close-out passes.

### S-002.2.1 · A record-only commit after the reconciliation {happy}
- **GIVEN** `reconciled_at` A, after the feature's last code commit, and a later commit with `Refs: F-001` that only changes `.azimuth/`
- **WHEN** the feature's done gate is evaluated
- **THEN** `done.architecture-reconciled` is ok

### S-002.2.2 · A code commit after the reconciliation {negative}
- **GIVEN** `reconciled_at` A and a later commit with `Refs: T-001.1` that changes `src/app.ts`
- **WHEN** the feature's done gate is evaluated
- **THEN** `done.architecture-reconciled` fails with the detail "Reconciled at A, 1 commits behind"

## ST-002.3 · Close-out in its natural order
**Intent:** As an agent, I want the verify skill's natural steps to end with a feature that can move to done so that close-out needs no extra commits or verify runs.

### S-002.3.1 · Verify, as-built, reconcile, commit, done {happy}
- **GIVEN** a real git history where a verifying feature's task passed at HEAD, then `as-built.md` and `reconciled_at` (set to that HEAD) are committed together with `Refs: F-001`
- **WHEN** the index is built
- **THEN** every check of the feature's done gate is ok

### S-002.3.2 · Code slipped into the close-out commit {negative}
- **GIVEN** the same history, but the close-out commit also changes `src/app.ts`
- **WHEN** the index is built
- **THEN** `done.verify-passed` and `done.architecture-reconciled` both fail
