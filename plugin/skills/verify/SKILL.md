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
   with the scenario ID), commit them and rerun verify.
4. Write `.azimuth/features/<F-ID>-<slug>/as-built.md`: compare the files actually changed
   (`git log --name-only` for commits with `Refs:` to this feature) with impact.md; list
   `files_changed`, `deviations` with reasons, and `follow_ups`. File each follow-up with
   `/azimuth:bug` (debt or bug) and list its ID.
5. Bring `.azimuth/project/architecture.md` in line with what was built (modules, boundaries,
   data flow), leaving `reconciled_at` alone for now. `azimuth check <F-ID>`, then commit:
   `docs(<F-ID>): close out` with `Refs: <F-ID>`.
6. Set `reconciled_at` to the current `git rev-parse --short HEAD` (the close-out commit) and
   commit it as `chore(azimuth): reconcile architecture.md` **without** a `Refs:` trailer. A
   commit that refers to the feature counts as its newest one, which would leave the
   architecture behind it again.
7. `azimuth verify <F-ID>` once more: the done gate needs every task's latest run at HEAD, and
   the two commits above moved HEAD.
8. `azimuth move <F-ID> done`. If a check still fails, fix what it names.
9. Hand off and close the session, commit the pending `.azimuth/` changes, and tell the user the
   feature is done and mention follow-ups.
