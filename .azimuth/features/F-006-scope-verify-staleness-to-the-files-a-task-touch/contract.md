---
language: typescript
---
# F-006: Contract

## Data structures

```ts
// src/core/config.ts
export interface Config {
  /* other sections unchanged */
  verify: {
    timeout_seconds: number;
    output_tail_lines: number;
    /** Globs (globToRegExp) of repo-relative files every verify run depends on. */
    shared_paths: string[];
  };
}

// DEFAULT_CONFIG.verify (root files only: a glob without "/" or "**" matches the root)
//   shared_paths: ["package.json", "pnpm-lock.yaml", "Cargo.toml", "Cargo.lock",
//                  "go.mod", "go.sum", "pyproject.toml", "uv.lock"]
// SHAPE.verify
//   shared_paths: r.strings()

// src/core/run-scope.ts (new)
/** What a task's verify runs depend on. */
export interface RunScope {
  /**
   * The task's files and the feature's create/modify/test impact paths, without a leading "./"
   * or trailing "/". Each covers itself and everything under it.
   */
  paths: string[];
  /** Paths of the modules that the feature's modules depend on, matched with inModule. */
  modules: string[];
  /** verify.shared_paths, compiled with globToRegExp. */
  shared: RegExp[];
}

// src/core/derive.ts
/** Why a passing run is no longer current. */
export type StaleCause =
  /** A later code commit changed a path in scope (or, without a scope, outside .azimuth/). */
  | { kind: "changed"; commit: string; path: string }
  /** A later commit's changed files aren't known. */
  | { kind: "unknown-files"; commit: string }
  /** The run's commit isn't in the history the index read. */
  | { kind: "outside-history" };
```

```yaml
# .azimuth/config.yaml
verify:
  timeout_seconds: 600
  output_tail_lines: 40
  shared_paths: [package.json, pnpm-lock.yaml, Cargo.toml, Cargo.lock, go.mod, go.sum, pyproject.toml, uv.lock]
```

## Public signatures

```ts
// src/core/run-scope.ts
/**
 * The scope of a task's runs: its files, the feature's create/modify/test impact paths, the
 * paths of the modules that the modules holding the feature's create/modify entries depend on
 * (directly), and the shared globs. Null when neither the task nor the feature lists a path of
 * its own, so any code commit makes the run stale.
 */
export function runScope(
  task: Pick<TaskRaw, "files">,
  feature: Pick<FeatureEntity, "impact">,
  modules: Module[],
  sharedPaths: string[],
): RunScope | null;

/** Whether a changed path (repo-relative, as git prints it) falls in the scope. */
export function inScope(path: string, scope: RunScope): boolean;

// src/core/derive.ts
/** Abbreviated SHAs can differ in length; one is a prefix of the other. (Now exported.) */
export const sameCommit: (a: string, b: string) => boolean;

/**
 * The earliest commit after `sha`, up to HEAD, that changed a path outside .azimuth/ for which
 * `touches` is true (any such path when `touches` is null), or whose changed files aren't known.
 * Within that commit, the first such path in git's order. Null when the run is still current.
 */
export function staleCause(
  sha: string,
  facts: Facts,
  touches: ((path: string) => boolean) | null,
): StaleCause | null;

// src/core/gates.ts: runCurrent is removed; doneGate calls
//   runScope(task, f, ctx.model.knowledge.architecture.modules, ctx.model.config.verify.shared_paths)
// and staleCause(run.commit, ctx.facts, scope ? (p) => inScope(p, scope) : null)
// for each passing run whose commit isn't HEAD.
```

## Errors

None new. A `verify.shared_paths` value that isn't a list of text values is reported by the
existing config reader as `E-SCHEMA` "verify.shared_paths must be a list of text values." and
the default list is kept.

`done.verify-passed` details, per task, joined with "; " as today:

```text
T-006.2 has no run                                               (unchanged)
T-006.2 failed at abc1234                                        (unchanged; failures win)
T-006.2 last passed at an uncommitted tree                       (unchanged)
T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts   (kind "changed")
T-006.2 last passed at abc1234; def5678's changed files are unknown (kind "unknown-files")
T-006.2 last passed at abc1234                                   (kind "outside-history"; unchanged)
```

`azimuth show F-006 --brief` (and a refused `azimuth move F-006 done`) prints it as before:

```text
Next gate → done:
  ✗ Latest verify run of every task passed at HEAD — T-006.2 last passed at abc1234; def5678 changed src/core/gates.ts
```

## State transitions
None.
