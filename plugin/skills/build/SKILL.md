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
4. Repeat until `azimuth next <F-ID>` has no ready task (when you hand tasks to subagents,
   follow "Delegating to subagents" below):
   1. `azimuth move <T-ID> in-progress`.
   2. Write the tests for the scenarios the task covers. Each test name starts with its scenario
      ID (`it("S-005.1.2 …")`); where a name can't hold the ID, use the protocol's marker
      (`// scenario: S-005.1.2` above a Rust or Go test) and a test name unique in the project.
      Run them and confirm they fail for the right reason.
   3. Implement until the task's verify command passes. Respect the contract and invariants.
      When a passing test proves a value its scenario leaves open as `{?}`, record it with
      `azimuth settle <S-ID> "<value>"`, which fills the scenario's first `{?}`.
   4. Commit: `feat(<F-ID>): <what>` with `Refs: <T-ID>`.
   5. `azimuth verify <T-ID> --summary` to record the run, then `azimuth move <T-ID> done`.
      Don't build by hand first: a build every verify command needs belongs in
      `verify.prebuild`, which each verify call runs once, under its own timeout. If another
      `azimuth verify` is running, the call waits its turn (`waited 40s for another verify`).
   6. After each task, or every few significant steps in a long one, add
      `azimuth log <T-ID> "<what changed, what's next>"` so the viewer shows progress (and
      `azimuth session note "<progress>"` for the session's own record). Record
      what the task taught (a constraint the code revealed, a choice the spec left open) with
      `azimuth note <T-ID> "<text>"`, which writes the feature's notes.md; never add it to
      feature.md.
5. Stop and report instead of pushing on when:
   - a decision is needed: raise a question (`azimuth new question … --feature <F-ID>`), and
     `azimuth move <T-ID> blocked --note "Waiting on Q-…"` if it blocks the task;
   - the same fix has failed twice: log what you learned and ask the user;
   - the work needs a decision record: use `/azimuth:adr`.
6. When every task is done or skipped, `azimuth move <F-ID> verifying`.
7. `azimuth session handoff "<next steps>"` and report progress. Leave the session open: the
   plugin closes it when the Claude Code session ends, and the next skill you run continues it.

## Notes, settled values and the approval

`azimuth note` and `azimuth settle` never make the approval stale, so don't run
`azimuth reapprove` after them. Every other spec edit does: a lesson written into feature.md, or
a story corrected because the code proved a THEN wrong. A story correction still needs
`azimuth reapprove <F-ID>`; a lesson belongs in a note. The user reviews the values you settle in
the inbox, and the feature can't reach done while a `{?}` is left.

## Delegating to subagents

Subagents run inside your Claude Code session, so they share your Azimuth session: their work is
recorded in yours.

- **You run every `azimuth` command and every `git` commit; subagents never do.** A subagent's
  `azimuth session start` would add its goal to your session, and parallel commits in one working
  tree pick up each other's files.
- **Hand each subagent one ready task** from `azimuth next <F-ID>`, after
  `azimuth move <T-ID> in-progress`. Give it the task's title, the scenarios it covers with their
  GIVEN/WHEN/THEN, the contract and invariants it must keep, the files it may change (the task's
  `files`), the test-naming rule from step 4.2 and the task's verify command. Ask it to write the
  tests first, implement, run the verify command, and report the files it changed, the
  command's result, the value a test proved for each `{?}` and what the task taught, without
  committing. You settle those values and record those notes.
- **Parallel only when independent:** run several subagents at once only for ready tasks whose
  `files` overlap in no file outside `parallel.shared_files` (config.yaml); otherwise one at a
  time. `azimuth next <F-ID>` ends with the groups that can run together
  (`Can run together: T-005.2, T-005.3 (shared: src/registry.ts)`, `On its own: T-005.4`). Wait
  for the whole batch to report before verifying, since a half-finished change elsewhere can
  break the build.
- **Shared files take insertions only:** tell each subagent whose task lists a shared file to
  add one complete insertion to it (a whole enum variant, match arm or registry entry) and never
  to edit another task's insertion.
- **Then commit one task at a time:** review the change, stage only that task's files and commit
  with `Refs: <T-ID>` (step 4.4). A shared file holding the insertions of several tasks goes into
  one commit with those tasks, whose `Refs:` names each of them (`Refs: T-005.2, T-005.3`).
- **Verify the batch in one call:** `azimuth verify <T-ID> <T-ID> … --summary` prints one line per
  run and the output of failures only. Then `azimuth move <T-ID> done` and `azimuth log` for each
  task that passed; fix a failed one, commit it and verify it again.
