---
language: typescript
---
# F-018: Contract

## Data structures

```ts
// src/core/types.ts (no Node imports)

/** The prebuild that ran before a verify run, in the same `azimuth verify` or finish call. */
export interface RunPrebuild {
  /** false only under verify.prebuild_failure: continue; otherwise a failed prebuild records no run. */
  ok: boolean;
  duration_ms: number;
}

export interface VerifyRun {
  // …existing fields unchanged…
  /**
   * null when no prebuild ran (none configured, a blank command, `--no-prebuild`), and for run
   * files without the key or with a malformed value. Always present in the model and the index.
   */
  prebuild: RunPrebuild | null;
}
```

```ts
// src/core/config.ts

export const PREBUILD_FAILURES = ["stop", "continue"] as const;
export type PrebuildFailure = (typeof PREBUILD_FAILURES)[number];

export interface Config {
  // …
  verify: {
    // …timeout_seconds, output_tail_lines, shared_paths, ignore_paths, prebuild,
    // build_timeout_seconds unchanged…
    /**
     * What a prebuild that exits non-zero does. stop (default): no target runs and no run is
     * recorded. continue: every target runs under build_timeout_seconds + timeout_seconds and
     * records prebuild { ok: false }. A prebuild that times out or is interrupted always stops.
     */
    prebuild_failure: PrebuildFailure;
    /**
     * verify and task finish warn on stderr, and doctor shows a `?` line, when the project
     * root's filesystem has less than this many GB (10^9 bytes) free; 0 turns the guard off.
     */
    min_free_gb: number;
  };
}

// DEFAULT_CONFIG.verify gains: prebuild_failure: "stop", min_free_gb: 10
// SHAPE.verify gains: prebuild_failure: r.oneOf(PREBUILD_FAILURES), min_free_gb: r.int(0)
```

```ts
// src/core/verify.ts

export interface PrebuildResult {
  command: string;
  ok: boolean;
  /** 124 after a timeout. */
  exit_code: number;
  /** True when verify.build_timeout_seconds stopped it; a timed-out prebuild never lets targets run. */
  timed_out: boolean;
  duration_ms: number;
  /** Last verify.output_tail_lines lines; ends with "[azimuth] prebuild timed out after <N>s" on a timeout. */
  output_tail: string;
}

export interface RunContext {
  waited_ms: number;
  ses: Id | null;
  /** Written to the run as `prebuild`; default null. */
  prebuild?: RunPrebuild | null;
  /**
   * The command's timeout, also the N of "[azimuth] timed out after <N>s"; default
   * verify.timeout_seconds.
   */
  timeout_seconds?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

export interface VerifyBatchResult {
  waited_ms: number;
  /** null when no prebuild is configured, it was skipped, or it was interrupted. */
  prebuild: PrebuildResult | null;
  /** In target order; [] when the prebuild failed under prebuild_failure: stop, or timed out. */
  runs: VerifyRun[];
  interrupted: boolean;
}
```

```ts
// src/core/disk.ts (new)

/**
 * Bytes an unprivileged user can still write on the filesystem holding `path`; throws when it
 * can't be read.
 */
export type FreeBytes = (path: string) => number;

/** What diskSpace found. */
export type DiskSpace =
  /** verify.min_free_gb is 0: the free space wasn't read. */
  | { state: "off" }
  /** The free-space source threw; `error` is its message. */
  | { state: "unknown"; error: string }
  /** low: free_bytes < min_free_gb × 10^9. */
  | { state: "ok" | "low"; free_bytes: number; min_free_gb: number };
```

## Public signatures

```ts
// src/core/verify.ts

/**
 * Runs one target's verify command under context.timeout_seconds (default
 * verify.timeout_seconds) and records the run with `prebuild: context.prebuild ?? null`; null
 * when aborted (nothing recorded).
 */
export function runVerify(
  root: string,
  target: VerifyTarget,
  context: RunContext,
): Promise<VerifyRun | null>;

/**
 * Takes the verify lock, runs verify.prebuild once (unless skipped), then each target in order,
 * and releases the lock. No targets: returns at once without waiting or building.
 * - Passing prebuild: every run records { ok: true, duration_ms } and keeps timeout_seconds.
 * - Prebuild exits non-zero: under stop, returns with no runs; under continue, runs every target
 *   under build_timeout_seconds + timeout_seconds, each run recording { ok: false, duration_ms }.
 * - Prebuild times out: returns with no runs. Interrupted: returns interrupted, prebuild null.
 */
export function verifyBatch(
  root: string,
  targets: VerifyTarget[],
  options?: VerifyBatchOptions,
): Promise<VerifyBatchResult>;
```

```ts
// src/core/disk.ts

/** fs.statfsSync(path): bavail × bsize. */
export function statfsFreeBytes(path: string): number;

/**
 * Reads verify.min_free_gb from config.yaml (loadConfig) and, unless it is 0, the free space at
 * `root` from `free`. Never throws for an unreadable disk ("unknown").
 */
export function diskSpace(root: string, free?: FreeBytes): DiskSpace;

/** "4.2 GB": bytes / 10^9 rounded down to one decimal. */
export function formatGb(bytes: number): string;

/** The stderr line verify and task finish print before running; null unless state is "low". */
export function diskWarning(space: DiskSpace): string | null;
```

```ts
// src/cli/commands/harness.ts

/**
 * doctor's disk line: ok true when there is room, ok null (a `?` line, which doesn't fail doctor)
 * when the disk is low or unreadable; null (no line) when the guard is off.
 */
export function diskCheck(space: DiskSpace): { ok: boolean | null; text: string } | null;
```

`reportLines(event, mode)` (`src/cli/verify-report.ts`), `parseRun(text, file)`
(`src/core/parse/run.ts`) and `configYaml(d)` (`src/core/init.ts`) keep their signatures.
`finishTask` keeps its signature and `FinishResult`; only its verify step's `detail` and the log
text change.

## Output lines

Examples use R-0142 for T-005.4, a 1.2 s run, a 41.2 s passing prebuild and a 3.1 s prebuild that
exited 2.

| Where | Text |
| --- | --- |
| verify, full and `--summary`: a passing prebuild | `prebuild passed in 41.2s` |
| verify: a failed prebuild (unchanged) | `prebuild failed (exit 2) in 3.1s`, then its output tail indented by 4 spaces |
| verify: a run after a failed prebuild | `R-0142 T-005.4 passed in 1.2s after a failed prebuild`; `R-0142 T-005.4 failed (exit 1) in 1.2s after a failed prebuild`, then its tail |
| verify: any other run (unchanged) | `R-0142 T-005.4 passed in 1.2s` |
| task finish verify detail, passing prebuild | `R-0142 passed in 1.2s (prebuild 41.2s)`; `R-0142 failed (exit 1) in 1.2s (prebuild 41.2s)` |
| task finish verify detail, failed prebuild under continue | `R-0142 passed in 1.2s after a failed prebuild (exit 2, 3.1s)`; `R-0142 failed (exit 1) in 1.2s after a failed prebuild (exit 2, 3.1s)` |
| task finish verify detail, no prebuild or a stopped one (unchanged) | `R-0142 passed in 1.2s`; `prebuild failed (exit 2) in 3.1s` |
| task finish log text after `Committed <sha>; ` | `R-0142 passed after a failed prebuild.`; `R-0142 failed (exit 1) after a failed prebuild.`; otherwise unchanged |
| `done.verify-passed` detail | `T-005.4 passed after a failed prebuild` (with the stale entries, after any failure) |
| verify and task finish, stderr | `Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.` |
| doctor | `✓ 120.5 GB free on the project's disk (verify.min_free_gb: 10)`; `? Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10)`; `? Could not read the free space on the project's disk: <error message>` |

## Errors

No new `AzimuthError`. Config problems (`E-SCHEMA`, the default value is kept):

- `verify.prebuild_failure must be stop or continue.`
- `verify.min_free_gb must be a whole number ≥ 0.`

A malformed `prebuild` in a run file is read as `null` without a problem, as malformed
`waited_ms` and `ses` are left out today. An unreadable free space is `{ state: "unknown" }`, never
an error.

## State transitions
None.
