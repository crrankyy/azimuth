# Changelog

Notable changes to Azimuth, newest first. The version is the one in `package.json` and the
plugin manifest.

## 0.3.0 (2026-10-21)

Finishing a lane without waiting for its batch, a fix for tests credited from the working tree, and
a drafted close-out, from an agent's report on its second ZenithMD run, the first on 0.2.

### Upgrading

- In your clone, run `pnpm install && pnpm build`, then start a new Claude Code session (or run
  `/reload-plugins`). The protocol and templates didn't change, so `azimuth init --refresh` isn't
  needed.
- `azimuth task finish` can now refuse a changed file outside the task (see Fixed); adopt it into
  the task whose lane changed it with `--adopt <path,…>`.
- The done gate is stricter: a test counts only once it is committed, every deviation in
  as-built.md needs a reason, and a run made after a failed prebuild has to be rerun.
- Two optional config keys: `verify.prebuild_failure` (default `stop`, today's behaviour) and
  `verify.min_free_gb` (default 10). Add them to `.azimuth/config.yaml` to change them.
- The first time autostart replaces a viewer after the upgrade, it starts on `viewer.port`; after
  that a replaced viewer keeps its port.

### Added

- `verify.prebuild_failure: continue` lets each target's own command run after a prebuild that
  failed, with the build's time added to its limit, so a lane can be finished while another lane's
  code doesn't build. A timed-out prebuild still stops the batch.
- Each run records the prebuild that served it; `verify --summary` and `task finish` show its time.
- `verify.min_free_gb`: below it, `azimuth verify` and `azimuth task finish` warn before running and
  `azimuth doctor` flags the disk. Nothing is blocked.
- `azimuth task finish --adopt <path,…>` adds changed files to the task's `files` in plan.md and
  commits them with it. The paths it leaves out print on three lines (outside every task, other
  in-progress tasks' files, records), and a staged shared file another in-progress task lists gets
  a warning.
- `azimuth as-built F-NNN` drafts as-built.md from the feature's commits: the files changed, and
  deviations from impact.md with empty reasons to fill in. A rerun keeps what was written.
- `azimuth brief` adds the shared-file rules when the task lists a shared file, the project's
  conventions.md, and a closing request for lessons, files changed outside the list and proven
  `{?}` values.
- `azimuth check` hints at `{?}` for an offset or a range of numbers in a draft's THEN
  (`W-MEASURED`) and at a draft task that covers no scenario and lists code (`W-NO-COVERS`). Hints
  don't count toward `autonomy.strict`.
- `W-MILESTONE-READY` when every feature of a planned or active milestone is done, and an item in
  `azimuth next` telling the agent to ask you to release it.
- `azimuth log BUG-… "<text>"` adds a dated note to an issue's Status notes, shown in its History.
- `azimuth next` lists the ready tasks of different features that can run together.

### Changed

- The done gate counts a scenario only when one of its passing tests is committed (a marked test
  when it has one). `azimuth trace` and the viewer mark a test that is only in the working tree.
- `done.as-built` needs a reason on every deviation, and `done.verify-passed` asks for a rerun of a
  run made after a failed prebuild.
- `azimuth check` applies the happy-plus-negative story rule to an idea that already has stories.
- When autostart replaces a stale or dead viewer, the new one keeps its port unless `viewer.port`
  changed.
- Refusing to reapprove a verifying feature now says the done gate doesn't check the approval.
- The skills say that plan.md edits need no reapproval and show `--option a="Label: detail"`.

### Fixed

- `azimuth task finish` left a test file outside the task's `files` uncommitted, and `azimuth trace`
  and the done gate still credited its scenario from the working tree (GitHub #2).

## 0.2.0 (2026-10-20)

Fewer verify reruns and less bookkeeping in long agent runs, from an agent's report on a 21-hour
build, and viewer screens for watching live agents.

### Upgrading

- In your clone, run `pnpm install && pnpm build`, then start a new Claude Code session (or run
  `/reload-plugins`): Claude Code reads a plugin installed from a local folder from that folder.
- Run `azimuth init --refresh` in each project to update `.azimuth/PROTOCOL.md` and the templates.
- In the viewer, `g a` now opens Agents; Activity moved to `g t`.
- `azimuth new` prints only the new ID on stdout (paths and notes go to stderr). `azimuth check`
  counts warnings by code unless you pass `--warnings` or an ID, and `azimuth trace` hides
  references that only mention a scenario unless you pass `--all`. `--json` output is unchanged.

### Added

- `azimuth verify` takes several targets and runs `verify.prebuild` once before them, under its own
  `verify.build_timeout_seconds` (default 1800); `--no-prebuild` skips it. `--summary` prints one
  line per run and the output of failures only.
- Verify processes take turns through a verify lock. Each run records how long it waited and the
  session it ran in.
- `azimuth task finish <T-ID> --commit "<message>"` commits a task's files and its feature's records
  with a `Refs:` trailer, runs the verify command and moves the task to done.
- `azimuth brief <T-ID>` prints the prompt for a subagent building a task, from the records.
- `azimuth note <T-ID|F-ID> "<text>"` writes what a task taught to the feature's `notes.md`, shown
  in the As-built tab. Notes never make an approval stale.
- `{?}` in a THEN or AND line stands for a value only the code can measure. `azimuth settle` fills
  it in with the value a passing test proved, without making the approval stale; a feature can't
  be done while a `{?}` is left, and settled values appear in your Review list.
- `parallel.shared_files` lists registry files that tasks extend with one insertion each. They no
  longer count as file conflicts, and `azimuth next F-NNN` groups the ready tasks that can run
  together.
- `verify.ignore_paths` lists files whose change never makes a verify run stale, such as a README
  or guides the code doesn't read. Empty by default (BUG-0072).
- `azimuth session start` and `azimuth doctor` warn when Azimuth's hooks haven't run in the
  current Claude Code session, which happens when it started before the plugin was enabled
  (BUG-0080).
- `autonomy.questions: proceed` lets an agent's non-blocking question with `--recommend` be
  answered with its recommendation. It shows in your Review list until `azimuth ack Q-…`, and your
  own answer replaces it. The default stays `ask`.
- `azimuth session note "<text>"` records progress in the current session.
- Hooks record permission waits (PermissionRequest, Notification) and failed tools
  (PostToolUseFailure), edit sizes and transcript paths. Each agent has a status (running, waiting
  or done) and a current action. Live logs are kept 72 hours.
- Agents screen with a live count in the sidebar: running, waiting and finished sessions with their
  subagents, files being edited, planned overlaps and permission waits.
- A live transcript page for each agent and subagent, read from Claude Code's own transcript files
  by the live viewer only, behind the page's token. Exports never contain transcripts.
- Activity is a timeline (last 75 minutes, today or 3 days) with cards for running sessions and a
  thread for each finished one.
- Each issue has a full page with triage controls, related work and history; `j` and `k` step
  between issues.

### Changed

- A verify run goes stale only when a later commit touches the task's files, its feature's impact
  paths, the modules those depend on, or `verify.shared_paths` (root manifests and lockfiles by
  default). The done gate names the commit and file. (GitHub #1)
- A verify timeout, Ctrl-C or SIGTERM kills the command's whole process tree.
- Inside one Claude Code session, `azimuth session start` continues the open Azimuth session and
  adds its goal; the SessionEnd hook closes it.

### Fixed

- The installed plugin couldn't find its own CLI and viewer, so `azimuth view` failed and autostart
  stopped a running viewer without starting another (BUG-0079).
- On the Activity timeline, the current action after a running agent's row was cut off near each
  quarter hour and at 1024 px. The last-75-minutes view now ends at least 10 minutes after now,
  and a label that still doesn't fit is drawn before the now line (BUG-0078).
- `azimuth doctor` counted the records `azimuth session start` writes as hook activity, so it said
  hooks were recording when none ran (BUG-0080).
- Autostart left a new viewer running for each session instead of reusing the busy one (BUG-0068).
- Each hook spent about 40 ms finding the shared cache folder; 100 hook writes went from 4.3 s to
  41 ms (BUG-0073).
- `azimuth task finish` can run again after a verify failure caused outside the task, and says when
  it waits for another verify (BUG-0074, BUG-0075).
- A long Claude Code session lost its Azimuth session ("No current session") once its live log
  passed 64 KB.
- `azimuth new` didn't print the new ID when a step after creating the file failed.

## 0.1.0 (2026-10-18)

First release: the `.azimuth/` file format with gated lifecycles, the `azimuth` CLI, the Claude
Code plugin with its hooks and skills, and the live local viewer with HTML export.
