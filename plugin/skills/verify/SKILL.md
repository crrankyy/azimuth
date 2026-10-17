---
name: verify
description: Close out an Azimuth feature in verifying - rerun every verify command, confirm scenario coverage, write as-built.md, reconcile the architecture doc and move it to done.
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
2. `azimuth verify <F-ID>` runs every task's verify command at HEAD. If one fails, fix it
   (`azimuth move <F-ID> in-progress --reason "…"` first if it needs real work), commit, verify again.
3. `azimuth trace <F-ID>`: every scenario must have a passing test. Add missing tests (named
   with the scenario ID) and rerun verify.
4. Write `.azimuth/features/<F-ID>-<slug>/as-built.md`: compare the files actually changed
   (`git log --name-only` for commits with `Refs:` to this feature) with impact.md; list
   `files_changed`, `deviations` with reasons, and `follow_ups`. File each follow-up with
   `/azimuth:bug` (debt or bug) and list its ID.
5. Reconcile `.azimuth/project/architecture.md` with what was built (modules, boundaries, data
   flow), then set `reconciled_at` to the current `git rev-parse --short HEAD`.
6. `azimuth check <F-ID>`, then commit: `docs(<F-ID>): close out` with `Refs: <F-ID>`.
7. `azimuth move <F-ID> done`. If a check still fails, fix what it names.
8. Hand off and close the session; tell the user the feature is done and mention follow-ups.
