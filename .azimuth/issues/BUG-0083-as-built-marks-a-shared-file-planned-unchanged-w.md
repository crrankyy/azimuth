---
id: BUG-0083
type: bug
title: as-built marks a shared file planned-unchanged when another task's commit carried the feature's insertion
status: open
severity: low
likelihood: null
impact: null
links: [F-021, F-010]
files: [src/core/as-built.ts]
found_by: SES-20261020-1730
created: 2026-10-20
resolved_at: null
---
## Repro
In a scratch clone of ZenithMD, `azimuth as-built F-050` (a done feature whose tasks added insertions to the shared files `crates/zmd-workspace/src/lib.rs` and `crates/zmd-app/src/editor/controller/mod.rs`).

## Expected
The two shared files listed as changed by F-050, as the hand-written as-built has them, or at least a deviation that says the insertion may have been committed with another task.

## Actual
Both come out as `planned-unchanged` with an empty reason. A shared file is staged whole by the first task that finishes with it, so F-050's insertions rode in another feature's commit and no commit naming F-050 touches them. The other 10 files and the two hand-written reasons matched. The done gate makes the agent write a reason, so nothing is lost, but the draft misleads.
