# Changelog

Notable changes to Azimuth, newest first. The version is the one in `package.json` and the
plugin manifest.

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
