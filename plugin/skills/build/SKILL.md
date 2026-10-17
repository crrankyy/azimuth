---
name: build
description: Implement an approved Azimuth feature task by task in its plan's order, test-first, keeping task status, logs and verify runs current for the live viewer.
argument-hint: "<F-NNN>"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
  - Bash(git *)
---

# Build a feature

Target: $ARGUMENTS

1. `azimuth session start --skill build --goal "Build <F-ID>" --touch <F-ID>`, then
   `azimuth show <F-ID> --brief`. Read its spec files and the previous handoff.
2. Handle what the brief lists first: change requests from the user, answered questions not yet
   applied (apply each, then `azimuth resolve Q-… --assumption <F-ID>` or `--adr ADR-…`), and a
   spec changed since approval (`azimuth reapprove <F-ID>`).
3. If the feature is `approved`, run `azimuth move <F-ID> in-progress`. A refusal names the gate
   check that failed (an unfinished dependency, a changed spec); resolve it or ask the user.
4. Repeat until `azimuth next <F-ID>` has no ready task:
   1. `azimuth move <T-ID> in-progress`.
   2. Write the tests for the scenarios the task covers. Each test name starts with its scenario
      ID (`it("S-005.1.2 …")`). Run them and confirm they fail for the right reason.
   3. Implement until the task's verify command passes. Respect the contract and invariants.
   4. Commit: `feat(<F-ID>): <what>` with `Refs: <T-ID>`.
   5. `azimuth verify <T-ID>` to record the run, then `azimuth move <T-ID> done`.
   6. After each task, or every few significant steps in a long one, add
      `azimuth log <T-ID> "<what changed, what's next>"` so the viewer shows progress.
5. Stop and report instead of pushing on when:
   - a decision is needed: raise a question (`azimuth new question … --feature <F-ID>`), and
     `azimuth move <T-ID> blocked --note "Waiting on Q-…"` if it blocks the task;
   - the same fix has failed twice: log what you learned and ask the user;
   - the work needs a decision record: use `/azimuth:adr`.
6. When every task is done or skipped, `azimuth move <F-ID> verifying`.
7. `azimuth session handoff "<next steps>"`, `azimuth session close`, and report progress.
