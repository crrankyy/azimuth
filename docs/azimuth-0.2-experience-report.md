# Azimuth 0.2 in practice: the second orchestrator's report from the ZenithMD build

Written 2026-10-20 by the orchestrating session (Claude Fable 5.1) for the lead and for the Azimuth maintainers' session. It covers the first run on Azimuth 0.2.0 (commit 613f9e8), the release built from the 0.1 report (`docs/azimuth-experience-report.md`), and stops where the lead asked: after the four approved M-04 features, two P0 specs and one critical bug. Each 0.1 recommendation is checked against what 0.2 actually did, and the new costs are named with their mechanism. Numbers come from git, Azimuth's run records and the lane reports, not impressions.

## 1. What was built

| Measure | 0.2 run (this session) | 0.1 run (2026-10-19, for scale) |
|---|---|---|
| Wall clock, first to last commit | 19:33 to 21:35 (2.0 h; ~2.6 h including the bug investigation) | 21.5 h |
| Features done | 4 (F-049, F-050, F-055, F-056: 14 tasks, 47 scenarios) | 44 (185 tasks) |
| Specs written and approved | 2 (F-065 export, 21 scenarios; F-072 perf acceptance, 12 scenarios) | 73 |
| Bugs fixed | 1 critical (BUG-0005, SIGSEGV on Touch Bar Macs) | — |
| Commits | 42 (14 feat, 1 fix, 1 test, 16 docs, 10 chore) | 528 (169 feat, 333 docs/chore) |
| Rust added | 8,825 lines in 46 files | ~90,000 lines |
| Verify runs | 32 (R-0427 to R-0458), all passed, 194 s total, median ≈ 4 s | 426 (8 failed, 3 timed out), 3.0 h |
| Subagent lanes | 14 (Opus), 3.6 to 25.4 min each, 70k to 164k tokens each | ~25 |
| Issues filed | 36 (4 BUG, 20 DEBT, 12 RISK) | 49 |
| Questions | 6, all auto-answered with the recommendation (`questions: proceed`) | 24, all answered as recommended |
| Story corrections | 7 (byte offsets and one path) in 4 features | 10 features |

Throughput: 14 tasks in the 2 h of build time is about 7 tasks per hour with two to four lanes, the same as the best stretch of the 0.1 run, but this time with four feature close-outs, two specs and a bug fix interleaved, and with roughly half the orchestrator calls per task. Commits per task fell from about 2.9 to about 1.6 (the remaining docs commits are story corrections and files-list fixes, §4.2 and §4.3).

## 2. The per-task cycle as practised on 0.2

1. `azimuth move T in-progress`; `azimuth brief T > scratchpad/brief-T.md`.
2. Launch the lane with a short prompt: "read your brief at this path", plus the rules the brief does not carry (§4.6): shared-file single insertions, the controller-split convention, "report lessons and `{?}` values", and which other lane is editing what.
3. Wait for the whole batch. Read each 600 to 1,500-word report; file its risks with `azimuth new issue`; correct stories it proved wrong (edit, docs commit, `azimuth reapprove`); add files it touched outside its list to plan.md (same three steps).
4. `azimuth task finish T --commit "…" --note "…"` per task, one after another.
5. At a feature's last task: `move F verifying`, `verify F --summary`, `trace F`, write as-built.md and the architecture bullet, set `reconciled_at`, `docs(F): close out`, `move F done`, in one quiet window.

Steps 1 and 4 are one call each now. Step 3 is where the remaining bookkeeping lives.

## 3. The 0.1 recommendations, checked

| 0.1 § | Recommendation | 0.2 outcome | Evidence |
|---|---|---|---|
| 5.1 | Path-scoped verify staleness | **Shipped; weaker than hoped in a multi-feature build** | Every close-out still reran every task: tasks go stale through shared `lib.rs`, `Cargo.lock` and dependency edges (`T-055.2 … 8016ad2 changed crates/zmd-workspace/src/lib.rs`; `T-049.1 … f914c44 changed switcher.rs`). Cheap only because the prebuild is cached: 4 reruns in 22 s. The gate's detail line (commit and path) is exactly right and made this diagnosable. |
| 5.2 | Verify that understands the build | **Shipped and decisive** | `verify.prebuild` runs once per finish; the first finish of a batch pays 1:43 to 2:26, the rest take 4 to 14 s. Zero timeouts, zero collisions, no manual pre-build. The verify lock recorded `waited_ms` = 0 throughout. One hole: the run JSON does not record the prebuild's duration, so the real cost of a finish (two minutes) is invisible in the records. |
| 5.3 | One compound task command | **Shipped; the biggest single gain** | `task finish` did check, note, stage, commit, verify, move and log in one call, 14 times, never wrongly. The one defect is §4.4. |
| 5.4 | Content-based spec staleness, records exempt | **Shipped** | `note`, `settle` and `resolve --assumption` never staled an approval (F-049 stayed approved through two resolves; F-065 approved right after three). A corrected THEN still needs `reapprove`, correctly. |
| 5.5 | Registry files first-class | **Shipped, with a sharp edge** | `parallel.shared_files` let two or three lanes extend `zmd-workspace/src/lib.rs` and the controller registries every wave with no merge conflict. But a shared file is staged whole by the first finish, so 893c20c (T-049.1) carries `pub mod switcher;` while `switcher.rs` landed in f914c44: a commit that does not compile alone. Bisect-unfriendly; verify runs on the working tree, so nothing failed. |
| 5.6 | Generate lane briefs | **Shipped; good** | `azimuth brief` gave 800 to 1,700 words with scenarios, contract, invariants, files, verify, notes of earlier tasks and the standing rules; lanes finished without a single clarification. I still appended ~150 words per lane (§4.6). |
| 5.7 | `{?}` for measured values | **Shipped; unused by these specs** | The four features were specced on 0.1 with exact offsets, and 7 of them were wrong (§4.2). The two new specs use `{?}` in 6 places; the next run will show whether `settle` removes the churn. |
| 5.8 | Coarser sessions | **Shipped** | One Azimuth session (SES-20261020-1343) absorbed every `session start`; `session note` carried progress. 1 session instead of ~15. |
| 5.9 | Unattended mode as a setting | **Shipped; exactly the real workflow** | `questions: proceed` answered Q-0025 to Q-0030 at creation and printed what to do next; `resolve --assumption` wrote the record. Two calls per decision instead of three records. |
| 5.10 | Quiet by default | **Shipped** | `check` prints counts; `new` prints only the ID (36 issues created in chains, every ID correct); `trace` hides mention-only rows; `verify --summary` is the right default for me. |
| 5.11 | notes.md per feature | **Shipped** | Lane lessons went to `notes.md` through `--note`; the briefs of later tasks carried them (T-049.3's brief had T-049.1, .2 and .4's notes). |

Net: nine of eleven asks landed as designed; two (5.1, 5.5) landed with a residue described below. The 0.1 report's §4.1 to §4.4, §4.7 to §4.9 and §4.11 are closed.

## 4. What held the work back on 0.2

### 4.1 Batch waiting is now the main idle time

The rule "finish nothing until the whole batch has reported" exists because `task finish` runs the workspace prebuild on the working tree, and a lane's half-written tests break it. In wave 3 three finished lanes waited 17 minutes for the fourth (an app-wiring lane: 25 min, 163k tokens); in wave 2, 6 minutes. Over six waves that is roughly 35 minutes of lane output sitting unfinished, about a quarter of the build time. Path-scoped staleness does not touch this; the constraint is the prebuild's scope.

### 4.2 Story offsets are still the main spec churn

Seven THEN values were wrong (S-055.1.1, S-055.2.3, S-056.1.1 twice, S-050.1.1, S-056.2.4's path, S-055.1.3's split), each costing a lane paragraph, an edit, a docs commit and a reapprove: about 21 orchestrator calls and 7 of the 16 docs commits. All seven were byte offsets or paths written before the code existed, the case `{?}` was built for. These specs predate 0.2; the two specs written today use `{?}`. The maintainers could add a `check` warning on a THEN that contains a bare byte range in a feature still `draft`, pointing at `{?}`.

### 4.3 The `files` list is a prediction, and it drifted on 5 of 14 tasks

Lanes touched files outside their list in T-049.2 (`watch()` in lib.rs), T-049.3 (main.rs, machine.rs, refactor/mod.rs), T-055.3 (controller/mod.rs, tests/keymap.rs) and T-050.4 (widget.rs, a test file), always for a reason the contract forced (an enum that lives there, a bug found). Each needed a plan.md edit, a docs commit and a reapprove before `task finish` would stage the file. The lanes flagged every case in their reports except one (§4.4). Suggestion: let `task finish` list the modified source files that are not in `files`, and with `--adopt` add them to the task and stage them, instead of sending the orchestrator through plan.md.

### 4.4 `task finish` left an uncommitted test, and `trace` credited it (filed as crrankyy/azimuth#2)

T-055.3's verify command named `--test keymap`, the lane added a test to `tests/keymap.rs`, the file was not in `files`, and `task finish` committed without it. The file appeared in a 20-item `not staged:` line mixed with `.azimuth/` records and other lanes' files; I missed it. `azimuth trace F-055` then credited S-055.3.1 from the working tree and the done gate was green. I caught it from `git status` while writing the as-built. A feature can reach `done` with a scenario proven by a test that is not in the repository. This is the one high-severity finding of the run.

### 4.5 Close-out is still manual and still ~10 minutes per feature

For each of four features: `verify F --summary`, `trace F`, `git log --name-only` on `Refs:` commits, diff against impact.md by eye, write as-built.md (60 lines), write the architecture bullet, set `reconciled_at`, two commits, `move done`. About six calls and most of the orchestrator's writing time after lane review. Twice `move done` was refused because another feature's commit had touched a file in this feature's impact map between `verify` and `move` (app.rs is in every app feature's impact.md); the fix was to run the two back to back. `azimuth` could pre-fill as-built's `files_changed` from the `Refs:` commits and mark the impact.md rows that were never touched.

### 4.6 The brief omits the rules its own data implies

When a task lists a `parallel.shared_files` path, the brief does not say "one complete insertion, never touch another lane's insertion, never run cargo fmt on this crate". When a feature follows the controller-split convention, the brief does not say it. I appended the same 150 words fourteen times. The brief also does not ask the lane to report what it learned or the values it proved, which is the material `--note` and `settle` need.

### 4.7 Smaller frictions

- `azimuth log BUG-…` is refused ("not a feature, story, scenario or task"): an issue under investigation has no progress log until the resolving `move --reason`. The BUG-0005 investigation (1.1 h) left no trail in Azimuth until its end.
- `azimuth check F-072` printed "No problems" while `move F-072 approved` failed the "every story has a happy and a negative or edge scenario" gate. The gate is right; `check` should warn first.
- `azimuth reapprove` is refused while a feature is `verifying`; a files-list fix at close-out cannot be re-approved, and the message does not say that the done gate ignores approval staleness anyway.
- `azimuth next F` shows the "can run together" grouping only with two or more ready tasks; with linear plans (every task `after` the previous) it never appears, so the parallelism decision was made from `files` lists by hand across features.
- A task with empty `covers` (T-050.4, app wiring, verify = `cargo check && clippy`) passes every gate. It is honest for wiring, but the brief then has no THEN to hold the lane to. A `check` warning unless `note` explains it would help.
- `--option "a: text"` is rejected; the syntax is `--option a="Label: detail"`. The usage line says so; the skill text does not show an example.
- The viewer is on port 4321 while config.yaml says 4319 (autostart picked another port); the hook's banner is right, the config is misleading.
- Milestones M-02 and M-03 still read `planned` and M-01 `active` though all their features are done. Releasing is the lead's, but the viewer's phase is wrong until then; a warning when every feature of a `planned` milestone is done would prompt it.

### 4.8 Outside Azimuth, for fairness

The disk reached 100 % (3 GB free) with `target/` at 65 GB: 696 test executables (up to 15 copies of `zmd`), 15 GB of incremental dirs and 11.6 GB of nested target dirs left by the quality test. Pruning artifacts older than 90 minutes in quiet windows kept it at 25 to 34 GB free; pruning once while a finish's prebuild ran stretched that finish to 7 minutes (recompiles, nothing broken). Azimuth could warn before a verify when free disk is below a threshold, and `task finish` could offer a sweep of stale test binaries; the quality test's nested target dir is ZenithMD's own debt (DEBT-0052).

## 5. Recommendations, in order of expected gain

1. **Finish a lane without waiting for the batch.** Let `task finish` (or `verify`) scope the prebuild to the task's crate and its dependents (`cargo test -p <crate> --no-run` from the task's `files`), so a finished lane in `zmd-workspace` is not blocked by a half-written test in `zmd-app`. Would have returned ~35 minutes of the 2 hours.
2. **Refuse or adopt unlisted source files in `task finish`** (#2). Fail when a modified file is named by the verify command or lies under the feature's impact paths; print source files and `.azimuth/` records on separate lines; `--adopt` adds them to `files`. Removes §4.3's three-step dance and closes §4.4.
3. **Mark tests credited from uncommitted files in `trace`** and have the done gate refuse them (#2).
4. **Stage shared files by hunk, or at least warn** when a shared file is committed with another task's insertion whose own file is not yet committed, so each commit compiles.
5. **Pre-fill the as-built** from the `Refs:` commits (files_changed, untouched impact rows) and offer `azimuth close-out F` that runs verify, trace, the architecture `reconciled_at` bump and the docs commit.
6. **Make the brief complete:** shared-file rules when a listed file is shared, the project's conventions.md section the task touches, and a closing request for lessons, deviations and `{?}` values.
7. **Record prebuild time in the run JSON** and show it in `verify --summary`.
8. **`check` warnings for the spec gate's story rule, for bare byte ranges in a draft's THEN, and for a task with empty `covers`.**
9. **`azimuth log` for issues.**
10. **Disk guard** before a verify; milestone-done warning.

## 6. What I would keep unchanged

Everything the 0.1 report listed, plus: `task finish` as the unit of work; `brief` as the lane prompt; `questions: proceed` with `resolve --assumption`; notes.md; `verify --summary` and the gate's "last passed at X; Y changed Z" detail, which made every staleness explainable; the new quiet defaults.

## 7. Bugs filed and not filed

- Filed: crrankyy/azimuth#2 (high): `task finish` leaves a modified test uncommitted; `trace` credits it from the working tree.
- Not filed (medium or low, listed here as the rules say): no `log` for issues; `check` versus the approval gate's story rule; `reapprove` refused in `verifying` without saying why it does not matter; `next F` grouping needs two ready tasks; empty-`covers` tasks pass silently; config.yaml's viewer port is stale; milestones never prompt a release; prebuild time absent from run records; shared-file whole-staging produces non-compiling commits.

## Appendix: the lanes

| Task | Minutes | Tokens | Tool uses | Note |
|---|---|---|---|---|
| T-049.1 | 7.3 | 132k | 24 | shared lib.rs with T-055.1 |
| T-055.1 | 6.0 | 96k | 14 | release-only 10k test |
| T-049.2 | 8.5 | 126k | 22 | edited `watch()`; TEMP-table move queue |
| T-055.2 | 13.6 | 84k | 19 | release timing run 1.22 ms |
| T-056.1 | 5.7 | 95k | 24 | added grep-searcher/regex |
| T-049.4 | 6.4 | 73k | 19 | found BUG-0006 |
| T-055.3 | 25.4 | 163k | 54 | app wiring; the batch waited on it |
| T-056.2 | 6.6 | 106k | 19 | `$1x` regex rewrite |
| T-050.1 | 8.8 | 106k | 26 | schema 3 |
| T-049.3 | 11.8 | 164k | 51 | three files outside its list |
| T-050.2 | 5.4 | 90k | 16 | aho-corasick |
| T-056.3 | 8.0 | 126k | 29 | stayed inside its files |
| T-050.3 | 3.6 | 70k | 16 | stayed inside its files |
| T-050.4 | 11.8 | 135k | 46 | found the Cmd+Shift+B bug |

Finishes: first of a batch 1:43 to 2:26 (prebuild), the rest 4 to 14 s; one 7:10 when a prune ran concurrently. Verify runs: 32, all passed, 194 s total.
