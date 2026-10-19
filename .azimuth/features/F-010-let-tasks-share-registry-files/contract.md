---
language: typescript
---
# F-010: Contract

## Data structures

```ts
// src/core/config.ts: a new section (F-007's verify keys land first; other sections unchanged).
export interface Config {
  /* … */
  parallel: {
    /**
     * Globs (globToRegExp) of repo-relative files that tasks extend additively, such as an
     * enum, its dispatch or a keymap. They are never file conflicts, and tasks listing them
     * may run at the same time.
     */
    shared_files: string[];
  };
}
// DEFAULT_CONFIG.parallel = { shared_files: [] }
// SHAPE.parallel = { shared_files: r.strings() }

// src/core/types.ts (index contract)
export interface Project {
  /* name, description, mode, stack, commands, git, autonomy, editor_url, root: unchanged */
  /** config.parallel.shared_files, as written. */
  shared_files: string[];
}

// src/core/next.ts
/** Ready tasks that can be built at the same time. */
export interface TaskGroup {
  /** Task IDs, in the order next lists them. */
  tasks: Id[];
  /** Files matching parallel.shared_files that two or more of the tasks list, sorted. */
  shared: string[];
}
```

```yaml
# .azimuth/config.yaml
parallel:
  # Files tasks extend additively (globs); tasks listing them may run in parallel
  shared_files: [src/editor/input.rs, src/editor/action.rs, "keymaps/*.toml"]
```

## Public signatures

```ts
// src/core/next.ts
/**
 * Groups tasks greedily, in the order given: each task joins the first group in which no task
 * lists one of its files, files matching `sharedFiles` aside; otherwise it starts a new group.
 * A task without files starts a group of its own that no later task joins. Paths compare as
 * written; the globs are compiled with globToRegExp.
 */
export function parallelGroups(tasks: Task[], sharedFiles: string[]): TaskGroup[];

/**
 * The groups of a feature's ready tasks, in readyTasks order (in-progress first, then todo,
 * each in plan order), using index.project.shared_files. [] unless the feature is in progress.
 */
export function taskGroups(index: Index, f: Feature): TaskGroup[];

// src/core/derive.ts (private): fileConflicts(features, shared: RegExp[]) leaves out every path
//   for which matchesAny(path, shared) is true; derive() passes
//   model.config.parallel.shared_files.map(globToRegExp).
// src/core/validate.ts (private): conflictProblems(model) leaves out the same paths.
```

```text
azimuth next [F-ID] [--json]          (usage unchanged)

$ azimuth next F-010
T-010.2 azimuth move T-010.2 in-progress
  F-010, covers S-010.2.1, S-010.2.2
T-010.3 azimuth move T-010.3 in-progress
  F-010, covers S-010.3.1
T-010.4 azimuth move T-010.4 in-progress
  F-010, covers S-010.4.1
Can run together: T-010.2, T-010.3 (shared: src/registry.ts)
On its own: T-010.4
```

- The group lines come after the items, one per group in order, only when the feature has two
  or more ready tasks. A group of two or more tasks prints as
  `Can run together: <IDs joined by ", ">`, followed by ` (shared: <paths joined by ", ">)` when
  its `shared` isn't empty; a group of one prints as `On its own: <ID>`.
- `azimuth next F-NNN --json` prints `{ "items": NextItem[], "groups": TaskGroup[] }`, where
  `items` is the array it printed before. `azimuth next --json` (no ID) still prints the
  `NextItem[]` array.

## Errors

None new. A `parallel.shared_files` value that isn't a list of text values is reported by the
existing config reader as `E-SCHEMA` "parallel.shared_files must be a list of text values." and
the default `[]` is kept. The `parallel` section no longer produces `W-UNKNOWN-KEY`.

## State transitions
None.
