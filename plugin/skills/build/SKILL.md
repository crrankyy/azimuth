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
   2. Build the task yourself, or hand it to a subagent whose prompt is `azimuth brief <T-ID>`
      (see "Delegating to subagents"). Write the tests for the scenarios the task covers. Each
      test name starts with its scenario ID (`it("S-005.1.2 …")`); where a name can't hold the
      ID, use the protocol's marker (`// scenario: S-005.1.2` above a Rust or Go test) and a test
      name unique in the project. Run them and confirm they fail for the right reason.
   3. Implement until the task's verify command passes. Respect the contract and invariants.
      When a passing test proves a value its scenario leaves open as `{?}`, record it with
      `azimuth settle <S-ID> "<value>"`, which fills the scenario's first `{?}`.
   4. `azimuth task finish <T-ID> --commit "feat(<F-ID>): <what>" [--note "<what it taught>"]`
      replaces the commit, verify, move and log steps. It checks the feature, adds the note to
      the feature's notes.md, stages the task's changed `files` and the feature's changed
      records, commits them with a `Refs: <T-ID>` trailer (hooks run), runs the verify command
      and moves the task to done with the result in its log. It prints one line per step and
      stops at the first ✗: fix the cause and run it again, without `--note` when the note step
      already ran. After a failed verify the commit stays and the task stays in progress; the
      fix goes in the next finish's commit.
      Don't build by hand first: a build every verify command needs belongs in
      `verify.prebuild`, which each finish runs once, under its own timeout.
      - **A refused file.** The check refuses a changed file outside the task's `files` that
        adds a marker for a scenario the task covers, or that is an `impact.md` path no
        in-progress task lists; each output line names one file and why. Find whose lane changed
        it. This task's: run finish again with `--adopt <path,…>`, which adds the paths to the
        task's `files` in plan.md and commits them, with no reapprove; `--adopt` may stay on
        later reruns. Another task's: finish that task first, with `--adopt` if it doesn't list
        the file yet. Nobody's: commit or revert it. Adopt only what this task's lane changed.
      - **What stayed out.** `not staged:` lists changed files no in-progress task lists: no
        task in flight will commit them, so check each one. The lines
        `not staged, other in-progress tasks:` and `not staged, records:` are expected. A
        `warning:` line says the commit carries another lane's unfinished insertion in a shared
        file and may not build on its own; it fails nothing.
   5. Every few significant steps in a long task, add
      `azimuth log <T-ID> "<what changed, what's next>"` so the viewer shows progress (and
      `azimuth session note "<progress>"` for the session's own record). Record what the task
      taught (a constraint the code revealed, a choice the spec left open) with `--note` on
      `task finish`, or `azimuth note <T-ID> "<text>"`, which writes the feature's notes.md; never
      add it to feature.md.
5. Stop and report instead of pushing on when:
   - a decision is needed: raise a question (`azimuth new question "<question>" --feature <F-ID>`
     with `--option a="Label: detail" --option b="Label: detail" --recommend a`), and
     `azimuth move <T-ID> blocked --note "Waiting on Q-…"` if it blocks the task;
   - the same fix has failed twice: log what you learned and ask the user;
   - the work needs a decision record: use `/azimuth:adr`.
6. When every task is done or skipped, `azimuth move <F-ID> verifying`.
7. `azimuth session handoff "<next steps>"` and report progress. Leave the session open: the
   plugin closes it when the Claude Code session ends, and the next skill you run continues it.

## Notes, settled values and the approval

The approval's spec hash covers the feature.md body, impact.md, stories.md and contract.md.
plan.md isn't part of it: editing a task's `files`, `covers` or `verify` needs no
`azimuth reapprove`, and neither do `azimuth note` and `azimuth settle`. An edit to any of the
four makes the approval stale: a lesson written into feature.md, or a story corrected because
the code proved a THEN wrong. A story correction needs `azimuth reapprove <F-ID>` while the
feature is approved or in progress; once it is verifying, the done gate doesn't check the
approval, so a close-out fix needs none. A lesson belongs in a note. The user reviews the values
you settle in the inbox, and the feature can't reach done while a `{?}` is left.

## Delegating to subagents

Subagents run inside your Claude Code session, so they share your Azimuth session: their work is
recorded in yours.

- **You run every `azimuth` command and every `git` commit; subagents never do.** A subagent's
  `azimuth session start` would add its goal to your session, and parallel commits in one working
  tree pick up each other's files.
- **Hand each subagent one ready task** from `azimuth next <F-ID>`, after
  `azimuth move <T-ID> in-progress`. Its prompt is the output of `azimuth brief <T-ID>`: the
  task, the scenarios it covers, the contract and invariants, the files it may change, the
  verify command, the feature's notes, the project's conventions and the rules (tests first,
  test names, no git or azimuth, the shared-file rules below, and last a request to report the
  files changed, the verify result, what the task taught, each file changed outside its list
  and why, and the value a test proved for each `{?}`). Add only what the records don't hold:
  which other tasks in the batch add to which shared file, and which files the other lanes are
  editing right now. You settle those values with `azimuth settle`, pass the lesson to
  `task finish --note`, and check each file changed outside the list (step 4.4 says when to
  `--adopt` it).
- **Parallel only when independent:** run several subagents at once only for ready tasks whose
  `files` overlap in no file outside `parallel.shared_files` (config.yaml); otherwise one at a
  time. `azimuth next <F-ID>` ends with the groups that can run together
  (`Can run together: T-005.2, T-005.3 (shared: src/registry.ts)`, `On its own: T-005.4`).
  `azimuth next` without an ID ends with the groups of ready tasks across in-progress features
  that can run together, when two or more have ready tasks (`Across F-001, F-002:`). Finish a
  lane as soon as it reports, unless a lane still running lists a shared file it lists, or edits
  files in the same package or crate: its commit would take that lane's half-written insertion,
  or its verify command would compile that lane's half-written code, so wait for that lane.
  `verify.prebuild_failure: continue` (config.yaml) is what lets a finish pass while another
  lane's code doesn't build: the task's own command still runs after a failed prebuild (under
  the default `stop`, the verify step fails and the commit stays; finish again once the
  workspace builds). The feature then needs those runs rerun with a working build before done:
  the done gate names them (`T-005.2 passed after a failed prebuild`), and
  `azimuth verify <T-ID> …` reruns them.
- **Shared files take insertions only:** the brief of a task that lists a file matching
  `parallel.shared_files` tells the subagent to add one complete insertion to it (a whole enum
  variant, match arm, registry entry or module line), never to edit or reorder another task's
  insertion, and not to run a formatter over a shared file or its package. You add which other
  tasks in the batch add to that file.
- **Then finish one task at a time:** as the rule above allows each lane, review its change and
  run `azimuth task finish` (step 4.4) for its task, one finish at a time, never two in parallel.
  Each commits only its task's files and the feature's records. A shared file is
  staged whole, so the first finished task that lists it commits it with every task's
  insertions, and the next task's commit no longer sees it changed; finish's `warning:` line
  flags that commit and fails nothing. When finish refuses a file, the subagents' reports of the
  files they changed say whose lane changed it: finish that lane's task with `--adopt` (step
  4.4). Fix a task whose finish failed and finish it again.
