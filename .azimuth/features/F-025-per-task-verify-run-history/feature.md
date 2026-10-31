---
id: F-025
title: Per-task verify run history
summary: azimuth runs <T-ID|F-ID> lists a task's or feature's verify runs newest first, one line each; azimuth show R-NNNN prints a run's whole record, output tail included.
status: approved
priority: P1
size: M
mode: brownfield
milestone: M-03
depends_on: []
superseded_by: null
tags: []
created: 2026-10-31
updated: 2026-10-31
approved_at: 2026-10-31
approved_by: agent
approved_hash: sha256:0da6ac15b54621e51512170af527d027ed8bbcc1e517877add81fa79ebc7a476
approved_commit: 0935b31
review_ack_at: null
---
# F-025: Per-task verify run history

## Objective
Every `azimuth verify` and `azimuth task finish` records a run in `.azimuth/cache/runs/R-NNNN.json`,
but nothing prints a task's runs. "When did this test last pass, and how long did it take?" meant
reading JSON files by hand. In ZenithMD's BUG-0010, a test passed in R-0377 and R-0385 on
2026-10-19 and flaked on 2026-10-24; finding those runs took a scan of hundreds of files.
`azimuth show R-NNNN` didn't help either: without `--json` it printed `R-NNNN not found.`, and
the index it reads keeps only the 200 newest runs plus each task's latest.

This feature adds two read commands:

- **`azimuth runs <T-ID|F-ID> [--limit N] [--json]`** prints one line per verify run, newest
  first: its ID, time, commit, outcome, duration, the time it waited for another verify, and the
  prebuild that served it. For a feature, each line also names the task. It prints at most 20
  lines unless `--limit` says otherwise, then `… and <n> older`. `--json` prints the records
  without their output tails.
- **`azimuth show R-NNNN`** prints the run's fields, then its output tail. `--brief` prints the
  run's `runs` line, and `--json` the whole record.

Both read every run file through the model (`loadProject`), not the index, so an old run is
found however many runs came after it.

## Out of scope
- The viewer: no run history panel or run page. The index's runs (`indexRuns`) are unchanged.
- Filters other than the ID and `--limit`: by outcome, by date, by commit or by session.
- Runs of a scenario or story (`azimuth runs S-…`), and statistics such as pass rates or
  average durations.
- Deleting or pruning run files.
- How `verify` and `task finish` write runs, and what they print.
- `show` for every other kind of ID, including `--brief` still being ignored for them (F-026
  gives milestones a page).

## Integration points
- `src/core/runs.ts` (new): `runHistory(model, ref, limit)` picks a task's or feature's runs
  from `model.runs`, newest first, and checks the ID against `model.features`. `findRun(model,
  id)` finds one run. Pure functions over the `Model` from `loadProject` (`src/core/model.ts`),
  which reads every run file (`readRuns`, `parseRun` in `src/core/parse/run.ts`) without git.
- `src/cli/commands/runs.ts` (new): the `runs` command, the run line and run page formatting,
  and `showRun`, which `show` calls for a run ID. Commands with one job live in their own file
  (`note.ts`, `settle.ts`, `as-built.ts`), so `runs` does too.
- `src/cli/verify-report.ts`: exports `seconds`, `outcome` and `tailLines`, and moves the
  run line of `reportLines` into an exported `runResultLine(run)`, which the run page reuses.
  What `verify` and `task finish` print stays byte for byte.
- `src/cli/main.ts`: registers `runs` after `trace`. Shared with F-028, which registers
  `release`; each adds one line to `COMMANDS`.
- `src/cli/commands/read.ts`: shared with F-026, which changes `show` for milestones. F-025's
  part is only: an early branch at the top of `show.run`, after `runtime(values)` and before
  `buildIndex`, that hands a run ID (`idKind(id) === "run"`) to `showRun` and returns; and
  `index.runs` leaves `findEntity`'s pools, since run IDs no longer reach it. The rest of `show`,
  `findEntity` and the other commands are F-026's or unchanged.
- `src/core/brief.ts` is not changed: `showBrief` reads the index, whose runs are capped, so the
  run's one line is formatted in `runs.ts` from the model instead. F-026 has `brief.ts` to
  itself.
- Docs and skills: `docs/cli.md` (shared with every 0.3.1 feature; F-025 adds the `runs` row,
  extends the `show` row and adds one paragraph after the Read table), `docs/file-format.md`
  (one sentence in Cache), `plugin/skills/azimuth/SKILL.md` (the `runs` row and the `show` row)
  and `plugin/skills/bug/SKILL.md` (one sentence on checking a test's past runs).

## Invariants
- `runs` and `show R-NNNN` write nothing: no file under `.azimuth/`, no session record, no cache
  file other than what `loadProject` already reads.
- `runs` lists every run whose target is the task (for a task ID) or belongs to the feature
  (`featureOf(target)` equals it, for a feature ID), and no other run.
- The order is newest `at` first, then the higher run ID first, whatever the file names.
- `azimuth verify` and `azimuth task finish` print exactly what they print today
  (`test/cli/verify-report.test.ts` passes unchanged).
- `show` of every ID that isn't a run prints what it prints today, with and without `--json`.
- A run file that doesn't parse is skipped, as `loadProject` skips it; `azimuth check` still
  reports it as `W-RUN-INVALID`.

## Assumptions
- **Source.** Both commands read `loadProject(root)`, not `buildIndex`: the model holds every
  run, and loading it runs no git, derive or validation. `buildIndex` has no cheaper mode
  (`live` and `export` differ only in what they show), and its `index.runs` keeps only the 200
  newest runs plus each task's latest, which would hide R-0377 behind 200 later runs.
- **Order.** Newest first by `Date.parse(at)`, then by run ID descending (the comparator of
  `indexRuns`), so two runs at the same second list the later ID first.
- **Feature runs.** A feature ID lists every run whose target's feature is that feature
  (`featureOf(target)`): runs of its tasks, runs of a task since removed from plan.md, and any run
  whose target is the feature itself. Each line names the target after the run ID.
- **Accepted IDs.** A task ID is accepted when its feature's plan.md lists it or a run targets
  it, so the runs of a removed task stay readable. A feature ID is accepted when the feature
  exists and has a task or a run.
- **Refusals** (AzimuthError, exit 1, `✗ <message>` on stderr):
  - an ID of another kind, or no ID form at all: `Q-0001 is not a task or feature ID.`
    (code `invalid`);
  - an unknown task or feature: `T-001.9 does not exist.` (code `not-found`, the wording of
    `azimuth log` and issue moves);
  - a feature with no tasks and no runs (an idea, or a plan without tasks):
    `F-002 has no tasks and no verify runs.` (code `invalid`). A wrong feature ID is the likely
    cause, so it is refused rather than reported as empty.
  A missing ID is a usage error (`Missing <ID>.`, exit 2), as for every command.
- **No runs yet.** A known task or feature without runs prints `No verify runs for T-001.2 yet.`
  and exits 0; `--json` prints `[]`.
- **Limit.** `--limit N` takes a whole number of at least 1 (digits only, no sign or point);
  anything else is a usage error, exit 2: `--limit takes a whole number of at least 1, not "0".`
  The default is 20. When more runs exist, a last line `… and <n> older` counts them (the
  `… and <n> more` form of `status --brief` and `next`). `--json` honours the limit and prints no
  such line.
- **Line format.** `<id>[ <target>] <at> <commit> <outcome> in <duration>`, then
  `, waited <n>s` when `waited_ms` is above 0, then `, prebuild passed in <duration>` or
  `, prebuild failed in <duration>` when a prebuild served the run. `<at>` is the run's `at` as
  recorded. `<commit>` is the short SHA, or `no commit` when it is null. `<outcome>` and
  `<duration>` are `verify`'s (`passed`, `failed (exit 1)`; `12.4s`, one decimal), coloured only
  on a terminal. The wait is rounded up to whole seconds, as `verify` prints it
  (`waited 41s for another verify`). Runs without `waited_ms` (older files) show no wait.
- **JSON.** `runs --json` prints an array (as `verify --json` does) of the records as the model
  reads them, newest first, each without `output_tail`. A tail holds up to
  `verify.output_tail_lines` lines (40 here), so 20 tails would bury the list an agent reads to
  pick a run; `show R-NNNN --json` gives the one it picks. `scenarios` and `junit` stay, since
  they answer "did this scenario pass in that run".
- **Run page.** `show R-NNNN` prints, one per line: `verify`'s result line for the run
  (`R-0003 T-001.1 failed (exit 1) in 2.1s`, with ` after a failed prebuild` when that applies);
  `At: <at>`; `Commit: <sha>` or `Commit: none`; `Command: <command>`; `Waited: <n>s` (rounded up)
  when the file has `waited_ms`; `Session: <SES-ID>` or `Session: none` when the file has `ses`;
  `Prebuild: passed in 41.2s`, `Prebuild: failed in 3.1s` or `Prebuild: none`;
  `JUnit: tests 2, failures 1, errors 0, skipped 0` when `junit` isn't null;
  `Scenarios: S-001.1.1 failing, S-001.1.2 passing` when the run lists any; then `Output:` and
  each tail line indented four spaces (`verify`'s `tailLines`, dimmed on a terminal), or
  `Output: (none)` when the tail is empty.
- **show flags.** `show R-NNNN --brief` prints the run's `runs` line with its target.
  `show R-NNNN --json` prints the record, `output_tail` included. With both flags, `--json` wins,
  as for other IDs. An unknown run keeps today's refusal: `R-0999 not found.` and the usage line,
  exit 2.
