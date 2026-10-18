---
id: F-002
title: Done gate ignores commits that only change Azimuth's records
summary: Commits that only touch .azimuth/ (as-built, architecture reconciliation, recorded decisions) no longer make verify runs stale or put the architecture behind a feature, so close-out works in its natural order.
status: verifying
priority: P2
size: M
mode: brownfield
milestone: null
depends_on: []
superseded_by: null
tags: []
created: 2026-10-18
updated: 2026-10-18
approved_at: 2026-10-18
approved_by: agent
approved_hash: sha256:cc5bf286f5330c8bad6160825efb87ef3a6aa3da169de648797e00db4e539e6c
approved_commit: b14207a
review_ack_at: 2026-10-18T13:24:01Z
---
# F-002: Done gate ignores commits that only change Azimuth's records

## Objective
Commits that only touch `.azimuth/` (the as-built, the architecture reconciliation, recorded
decisions and issue moves) no longer make verify runs stale or put the architecture behind a
feature, so a feature can be closed out in its natural order: verify, write the as-built,
reconcile, commit, done.

## Out of scope
- The W-ARCH-STALE warning's commit count (it still counts every commit).
- Uncommitted changes in the working tree (the gate ignores them, as before).

## Integration points
- `src/core/derive.ts`: next to `commitsFor`, helpers that tell code commits from record
  commits using the changed-file lists `git.ts` already reads.
- `src/core/gates.ts`: the done gate's `done.verify-passed` and `done.architecture-reconciled`
  checks.
- `plugin/skills/verify/SKILL.md`: back to the natural close-out order.
- `docs/concepts.md`: the done gate's description.

## Invariants
- A commit that changes anything outside `.azimuth/` still makes earlier runs stale and still
  counts as the feature's last commit.
- A commit whose changed files aren't known counts as a code commit, so the gate never passes on
  missing information.
- Check IDs and order don't change.

## Assumptions
- Record commits are those whose changed files all sit under `.azimuth/`; nothing else Azimuth
  writes is committed elsewhere (`.azimuth/cache/` is gitignored).
- A run at a commit older than the history the index reads (`git.log_depth`) is stale unless it
  is HEAD, as before.
