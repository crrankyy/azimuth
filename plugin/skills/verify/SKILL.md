---
name: verify
description: Close out an Azimuth feature in verifying - rerun the verify runs the done gate names, confirm scenario coverage, write as-built.md, reconcile the architecture doc and move it to done.
argument-hint: "<F-NNN>"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
  - Bash(git *)
---

# Close out a feature

Target: $ARGUMENTS

1. `azimuth session start --skill verify --goal "Close out <F-ID>" --touch <F-ID>` and
   `azimuth show <F-ID> --brief` (the "Next gate → done" checks are your checklist).
2. Rerun only the runs that "Latest verify run of every task passed at HEAD" names, in one call:
   `azimuth verify <T-ID> <T-ID> … --summary` with the tasks in its detail (`verify.prebuild`, if
   set, builds once first; don't build by hand). A passing run stays current until a later
   commit changes a path the task depends on, and the detail names that commit and path
   (`T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts`). When the check passes,
   rerun nothing. If a run fails, fix it (`azimuth move <F-ID> in-progress --reason "…"` first if
   it needs real work), commit, verify that task again.
3. `azimuth trace <F-ID>`: every scenario must have a passing test that is committed. A test
   that trace marks `(uncommitted)` is only in the working tree, and the done gate doesn't count it.
   Add missing tests (named with the scenario ID), commit them and every file holding an
   uncommitted test (with `Refs: <T-ID>` naming the task that covers the scenario), and rerun the
   runs the done gate then names.
4. `azimuth as-built <F-ID>` drafts the feature's `as-built.md` from its commits:
   `files_changed`, and the `deviations` from impact.md (`unplanned-create`, `unplanned-modify`,
   `unplanned-delete`, `planned-unchanged`), each with an empty reason. It prints the file and
   the deviations that need a reason. Then edit that file: write each deviation's `reason` (why
   the build differs from the plan), add deviations of your own kinds for anything else that
   differs (a changed interface, a corrected test) with their reasons, write the Summary (what
   was built and how), and file each follow-up with `/azimuth:bug` (debt or bug) and list its ID
   in `follow_ups`. After a later commit, run `azimuth as-built <F-ID>` again: it keeps the
   reasons, your deviations, the body and the follow-ups. The done gate refuses while a
   deviation has no reason.
5. Reconcile `.azimuth/project/architecture.md` with what was built (modules, boundaries, data
   flow), then set `reconciled_at` to the current `git rev-parse --short HEAD`.
6. `azimuth check <F-ID>`, then commit: `docs(<F-ID>): close out` with `Refs: <F-ID>`. Keep this
   commit to files under `.azimuth/`: commits that only change Azimuth's records don't make the
   verify runs stale or put the architecture behind, but a code change can.
7. `azimuth move <F-ID> done`. If a check still fails, fix what it names.
8. Hand off with `azimuth session handoff "<next steps>"` (the plugin closes the session when the
   Claude Code session ends), commit the pending `.azimuth/` changes, and tell the user the
   feature is done and mention follow-ups.
