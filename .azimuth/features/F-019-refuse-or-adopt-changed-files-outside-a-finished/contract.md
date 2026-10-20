---
language: typescript
---
# F-019: Contract

## Data structures

```ts
// src/core/finish.ts (modified). Unchanged members are elided with "…".

/** "adopt" is new: it runs after "check" and before "note", and only when `adopt` is given. */
export type FinishStepName =
  | "check"
  | "adopt"
  | "note"
  | "stage"
  | "commit"
  | "verify"
  | "done"
  | "log";

export interface FinishOptions extends Who {
  // … message, note, signal as before.
  /**
   * Changed paths to add to the task's `files` in plan.md (the adopt step) and stage with the
   * rest. Each is trimmed and loses a leading "./" and a trailing "/"; empty entries are
   * dropped and duplicates count once. Absent or empty after that: no adopt step.
   */
  adopt?: string[];
}

export interface FinishResult {
  // … task, feature, ok, steps, staged, not_staged, commit, run, interrupted as before;
  // `steps` now lists check, adopt (only when `adopt` was given), note, stage, commit,
  // verify, done, log.
  /** not_staged's paths outside `.azimuth/` that no other in-progress task lists, sorted. */
  not_staged_outside: string[];
  /** not_staged's paths outside `.azimuth/` that another in-progress task lists, sorted. */
  not_staged_other_tasks: string[];
  /** not_staged's paths under `.azimuth/`, sorted. */
  not_staged_records: string[];
  /**
   * Staged paths matching parallel.shared_files that another in-progress task also lists,
   * sorted by path; [] until the stage step staged something.
   */
  shared: SharedStaged[];
}

export interface SharedStaged {
  path: string;
  /** The other in-progress tasks that list it, in model order (feature ID, then plan order). */
  tasks: Id[];
}

export interface NotStagedSplit {
  outside: string[];
  other_tasks: string[];
  records: string[];
}

/** Why the check refuses a changed path. */
export type UnlistedReason =
  /** Rule (a): scenarios the task covers that the working copy marks and HEAD's copy doesn't. */
  | { kind: "marker"; scenarios: Id[] }
  /** Rule (b): the impact.md entry the path equals or lies under. */
  | { kind: "impact"; change: "create" | "modify" | "test" };

export interface UnlistedFile {
  path: string;
  reason: UnlistedReason;
}

export interface UnlistedContext {
  /** The task being finished; `files` includes the paths being adopted. */
  task: Pick<TaskRaw, "id" | "files" | "covers">;
  feature: Pick<FeatureEntity, "id" | "dir" | "impact">;
  /** Every other in-progress task, of any feature. */
  others: Pick<TaskRaw, "id" | "files">[];
  /** config.tests.globs, matched with testFileMatcher (glob.ts). */
  testGlobs: string[];
  /**
   * A changed test path's text in the working tree and at HEAD; null where the file doesn't
   * exist (deleted from the working tree; untracked, renamed or no HEAD).
   */
  texts: (path: string) => { working: string | null; head: string | null };
}
```

## Public signatures

```ts
// src/core/glob.ts (new export; the module still imports no Node module)

/**
 * Whether a repo-relative path is a test file under `globs` (tests.globs): some glob not
 * starting with "!" matches it and no "!" glob matches it (globToRegExp), the rule traceTests
 * applies inline. The globs are compiled once.
 */
export function testFileMatcher(globs: string[]): (path: string) => boolean;

// src/core/finish.ts

/**
 * The changed paths the check refuses, sorted by path. A path is a candidate when it is outside
 * the task's files (runScope(task, { impact: [] }, [], []) with inScope) and doesn't start with
 * `feature.dir`. A candidate is refused:
 * (a) when testFileMatcher(testGlobs) holds for it and scanTestFile(working) has a reference of confidence
 *     "marker" for a scenario in task.covers that scanTestFile(head) has none for (compared by
 *     scenario ID; a null text has no markers); reason { kind: "marker", scenarios } sorted;
 * (b) otherwise, when it equals or lies under a create, modify or test entry of feature.impact
 *     (normalized as runScope does) and no task in `others` lists it; reason { kind: "impact",
 *     change } of the first such entry.
 * `texts` is called only for candidates that match testGlobs.
 */
export function unlistedFiles(changed: string[], ctx: UnlistedContext): UnlistedFile[];

/**
 * Splits the paths left out of the commit: `records` start with ".azimuth/" (AZ_DIR); of the
 * rest, `other_tasks` are listed by a task in `others` (equal to one of its files or under it,
 * as selectPaths decides); `outside` is everything else. Each list is sorted.
 */
export function splitNotStaged(
  notStaged: string[],
  others: Pick<TaskRaw, "files">[],
): NotStagedSplit;

/**
 * The staged paths matching one of `sharedFiles` (globToRegExp) that a task in `others` lists,
 * sorted by path, each with those tasks in the order of `others`.
 */
export function sharedStaged(
  staged: string[],
  sharedFiles: string[],
  others: Pick<TaskRaw, "id" | "files">[],
): SharedStaged[];

/**
 * As before, with these changes:
 * check   after F-009's parts up to the feature's errors:
 *         1. `git status --porcelain=v1 -z --untracked-files=all` through porcelainPaths;
 *         2. the --adopt paths (see Errors);
 *         3. nothing staged outside selectPaths' `staged`, with the adopted paths counted as
 *            the task's files;
 *         4. unlistedFiles(changed, …) is empty, its task's files including the adopted paths,
 *            `others` the in-progress tasks of every feature but this task, from the model the
 *            check analyzed, and texts read from the working tree and with readBlobs at HEAD.
 *         Still read-only.
 * adopt   only with `adopt`: inside withLock, re-reads plan.md and sets the task's `files` to
 *         its files followed by the adopted paths not yet the task's, in the order given, with
 *         updateFrontmatterItem and writeFileAtomic. Writes nothing when every path is already
 *         the task's. A writer's AzimuthError fails the step.
 * stage   also fills not_staged_outside, not_staged_other_tasks and not_staged_records from
 *         splitNotStaged(not_staged, others) whenever it fills not_staged, and `shared` from
 *         sharedStaged(staged, config.parallel.shared_files, others) after `git add` succeeded.
 */
export function finishTask(root: string, taskId: string, opts: FinishOptions): Promise<FinishResult>;

// src/cli/commands/task.ts

export const task: Command;
//   usage:   'task finish <T-ID> --commit "<message>" [--note "<text>"] [--adopt <path,…>] [--json]'
//   options: commit (string), note (string), adopt (string, comma-separated), json (boolean)
//   finishLines after the stage step, each only when non-empty, in this order:
//     "  not staged: <not_staged_outside joined by ', '>"
//     "  not staged, other in-progress tasks: <not_staged_other_tasks joined by ', '>"
//     "  not staged, records: <not_staged_records joined by ', '>"
//     "  warning: <path> carries <tasks> work in progress; this commit may not build on its own."
//       one per `shared` entry; <tasks> is each ID followed by "'s", joined by " and "
//       ("T-002.1's", "T-001.2's and T-002.1's").
```

## Step details

The examples use T-001.1 of F-001.

- **adopt, done, some paths written.** Detail: `added to T-001.1's files: <paths>`, listing
  only the paths written, in the order given, joined by `, `. Output: `""`.
- **adopt, done, nothing written.** Detail: `already T-001.1's files: <paths>`, listing every
  adopted path, joined by `, `. Output: `""`.
- **check, failed (the refusal).** Detail:
  `Changed outside T-001.1's files: <paths>. Adopt each into the task whose lane changed it (task finish <T-ID> --adopt <path,…>), or commit or revert it.`
  The paths are sorted and joined by `, `. Output: one line `<path>: <reason>` per refused
  path, sorted by path, where `<reason>` is:
  - for `{ kind: "marker", scenarios: [S] }`: `adds a marker for S, which T-001.1 covers`;
  - for `{ kind: "marker", scenarios: [S1, S2, …] }`:
    `adds markers for S1, S2, which T-001.1 covers`;
  - for `{ kind: "impact", change }`:
    `a <change> path in F-001's impact.md that no in-progress task lists`.

## Errors

All of the following fail the check step, which then writes nothing. They are checked in this
order, after F-009's own checks:

1. git status exits non-zero. Detail: `git status failed (exit N)`, with git's output tail as
   the output.
2. An adopted path that isn't the task's and that git status doesn't list. Detail:
   `Can't adopt <path>: git status shows no change to it.`
3. An adopted path that another in-progress task lists. Detail:
   `Can't adopt <path>: <T> lists it and is in progress, so it goes in <T>'s commit.`, naming
   the first such task.
4. Something staged outside the set (F-009). The detail is unchanged; the adopted paths count
   as the task's files.
5. unlistedFiles is not empty. The detail is the refusal above.

When several adopted paths are invalid (2 and 3), the detail holds one sentence per path, in
the order given, joined by a space.

On the command line, `--adopt` with no path left after splitting on commas and trimming is a
`UsageError` (exit 2): `task finish --adopt needs a path: --adopt <path,…>.` A failed check
exits 1, as before.

## State transitions
None.
