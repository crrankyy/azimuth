---
language: typescript
---
# F-025: Contract

## Data structures

```ts
// src/core/runs.ts (new)

import type { Model } from "./model";
import type { Id, VerifyRun } from "./types";

/** The runs of one task or feature, as `azimuth runs` lists them. */
export interface RunHistory {
  /** The ID asked for. */
  ref: Id;
  kind: "task" | "feature";
  /** Newest first (newestFirst), at most `limit` of them. */
  runs: VerifyRun[];
  /** How many runs the ref has in all; total - runs.length is the `… and <n> older` count. */
  total: number;
}

// src/cli/commands/runs.ts (new)

/** What `runs --json` prints for each run: the record without its output tail. */
export type RunSummary = Omit<VerifyRun, "output_tail">;

/** Lines `runs` prints when --limit isn't given. */
export const DEFAULT_RUN_LIMIT = 20;
```

## Public signatures

```ts
// src/core/runs.ts

/**
 * Newest `at` first (Date.parse), then the higher run ID first (compareIds), as indexRuns orders
 * the index's runs.
 */
export function newestFirst(a: VerifyRun, b: VerifyRun): number;

/**
 * The runs of a task (target === ref) or of a feature (featureOf(target) === ref, so runs of
 * removed tasks and of the feature itself count), sorted with newestFirst and cut to `limit`
 * (a whole number ≥ 1; the CLI checks it).
 *
 * Checks, in order (see Errors): ref's kind is task or feature; the feature exists in
 * model.features; a task is listed in its feature's plan or targeted by a run; a feature has a
 * task or a run. A known task or feature without runs returns runs [] and total 0.
 * Never reads files.
 */
export function runHistory(
  model: Pick<Model, "features" | "runs">,
  ref: string,
  limit: number,
): RunHistory;

/** The run with this ID, or null. */
export function findRun(model: Pick<Model, "runs">, id: string): VerifyRun | null;

// src/cli/verify-report.ts (existing helpers, now exported; output unchanged)

/** `12.4s`: milliseconds as seconds with one decimal. */
export function seconds(ms: number): string;

/** `passed`, or `failed (exit <code>)`; coloured only on a terminal. */
export function outcome(ok: boolean, exitCode: number): string;

/** Each line of an output tail indented four spaces and dimmed; [] for an empty tail. */
export function tailLines(tail: string): string[];

/**
 * `<id> <target> <outcome> in <seconds>`, plus ` after a failed prebuild` when run.prebuild.ok
 * is false: the line reportLines prints for a "run" event, which now calls it.
 */
export function runResultLine(run: VerifyRun): string;

// src/cli/commands/runs.ts

/**
 * `azimuth runs <T-ID|F-ID> [--limit N] [--json]`. Options: limit (string), json (boolean).
 * Order: requirePositional(positionals, 0, "ID"); parseLimit; runtime(values);
 * runHistory(loadProject(rt.root), id, limit). Prints runLine(run, kind === "feature") per run
 * and `… and <total - shown> older` when runs were left out, or
 * `No verify runs for <ref> yet.` when there are none; with --json, printJson of the RunSummary
 * array (`[]` when empty). Writes nothing.
 */
export const runs: Command;

/**
 * DEFAULT_RUN_LIMIT when value is undefined; the number when value matches /^[1-9]\d*$/;
 * otherwise throws UsageError(`--limit takes a whole number of at least 1, not "${value}".`).
 */
export function parseLimit(value: string | undefined): number;

/**
 * `<id>[ <target>] <at> <commit | "no commit"> <outcome> in <seconds>`, then
 * `, waited <ceil(waited_ms / 1000)>s` when waited_ms > 0, then
 * `, prebuild passed in <seconds>` or `, prebuild failed in <seconds>` when prebuild isn't null.
 */
export function runLine(run: VerifyRun, withTarget: boolean): string;

/**
 * The lines of `show R-NNNN`: runResultLine(run); `At: …`; `Commit: <sha | none>`;
 * `Command: …`; `Waited: <ceil s>s` when waited_ms is present; `Session: <ses | none>` when ses
 * is present; `Prebuild: passed in …` | `Prebuild: failed in …` | `Prebuild: none`;
 * `JUnit: tests <n>, failures <n>, errors <n>, skipped <n>` when junit isn't null;
 * `Scenarios: <id> <status>, …` when scenarios isn't empty; then `Output:` followed by
 * tailLines(output_tail), or `Output: (none)` for an empty tail.
 */
export function runPage(run: VerifyRun): string[];

/**
 * show's handling of a run ID. Finds the run with findRun(loadProject(root), id); throws
 * UsageError(`${id} not found.`) when there is none. Prints the record with printJson when
 * `json`, else runLine(run, true) when `brief`, else runPage(run).
 */
export function showRun(root: string, id: string, flags: { brief: boolean; json: boolean }): void;

// src/cli/commands/read.ts (show; the rest is F-026's or unchanged)

export const show: Command; // run: after runtime(values), `if (idKind(id) === "run")` → showRun(...), return

// findEntity's pools no longer include index.runs.

// src/cli/main.ts

// COMMANDS gains `runs` (from ./commands/runs) after `trace`.
```

## Errors

```ts
// Thrown by runHistory (src/core/runs.ts); the CLI prints `✗ <message>` and exits 1.
new AzimuthError("invalid", `${ref} is not a task or feature ID.`); // idKind isn't task or feature
new AzimuthError("not-found", `${ref} does not exist.`); // unknown feature, or a task neither planned nor run
new AzimuthError("invalid", `${ref} has no tasks and no verify runs.`); // a feature with neither

// Thrown in src/cli/commands/runs.ts; the CLI prints the message and the usage line, exit 2.
new UsageError(`--limit takes a whole number of at least 1, not "${value}".`);
new UsageError(`${id} not found.`); // showRun, an unknown run (show's existing wording)
```

## State transitions
None.
