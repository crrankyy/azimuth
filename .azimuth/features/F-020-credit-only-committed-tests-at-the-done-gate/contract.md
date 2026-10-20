---
language: typescript
---
# F-020: Contract

## Data structures

```ts
// src/core/facts.ts

export interface GitFacts {
  // …every existing field unchanged; `dirty` keeps its meaning: a tracked file differs from
  // HEAD (staged or not), read from the same status call; untracked files don't count.
  /**
   * Every path `git status --porcelain -z --untracked-files=all` names, sorted and unique:
   * modified, added, deleted and unmerged files, untracked files (each file of an untracked
   * directory) and a rename's or copy's new path. Relative to the repository root. [] without
   * git or when the status call fails.
   */
  changed: string[];
}

export interface TestRef {
  file: string;
  name: string;
  confidence: "marker" | "fallback";
  /**
   * False when the reference is only in the working tree: its file is in GitFacts.changed and
   * HEAD's copy of the file has no reference with the same scenario ID and name. markCommitted
   * sets it on every ref; scanTestFile and traceTests leave it out, and a ref without it counts
   * as committed.
   */
  committed?: boolean;
}

/** emptyGitFacts() also returns `changed: []`. */
export function emptyGitFacts(): GitFacts;

// src/core/types.ts

export interface ScenarioTest {
  file: string;
  name: string;
  status: CoverageStatus;
  confidence: "marker" | "fallback";
  /** False when the test is only in the working tree; the done gate doesn't count it. */
  committed: boolean;
}
```

## Public signatures

```ts
// src/core/git.ts

/**
 * Unchanged signature. Runs `git status --porcelain -z --untracked-files=all` once, in place of
 * `git status --porcelain --untracked-files=no`: `dirty` is true when an entry's XY isn't `??`,
 * and `changed` lists every entry's path (a rename's or copy's new path; its source path, the
 * next NUL-separated field, is skipped), sorted and unique.
 */
export function gitFacts(root: string, model: Model): GitFacts;

// src/core/trace.ts

/**
 * `tests` with `committed` set on every ref, as a new map of new ref objects (`tests` and its
 * refs, which traceTests' scan cache holds, are never mutated).
 *
 * - `changed` null (no git): every ref is committed; nothing is read.
 * - The files to check are the refs' files that are in `changed`. When there are none, every ref
 *   is committed and git isn't called.
 * - Otherwise one readBlobs(root, ["HEAD:<file>", …]) call reads HEAD's copies, each is scanned
 *   with scanTestFile(text, file), and a ref of a checked file is committed when HEAD's scan
 *   holds a ref for the same scenario ID with the same name. A file HEAD doesn't hold (null
 *   blob) has no such ref. Refs of other files are committed.
 */
export function markCommitted(
  root: string,
  tests: Map<string, TestRef[]>,
  changed: readonly string[] | null,
): Map<string, TestRef[]>;

// scanTestFile(text, file) and traceTests(root, globs): signatures and output unchanged.

// src/core/build-index.ts

/**
 * Unchanged signature. Gathers `git` first and then
 * `tests: markCommitted(root, traceTests(root, model.config.tests.globs),
 *   git.available ? git.changed : null)`.
 */
export function analyzeProject(root: string, now?: Date): Omit<BuildResult, "index">;

// src/core/derive.ts

/** Unchanged signature; each ScenarioTest gets `committed: ref.committed !== false`. */
export function coverageOf(
  scenarioId: string,
  facts: Facts,
  runStatus: Map<string, CoverageStatus>,
): ScenarioCoverage;

// src/core/gates.ts (private; doneGate puts its result where the inline check was)

/**
 * done.scenarios-passing over f's scenarios (stories order) and ctx.derived.coverage.
 * The tests that count for a scenario: its tests with confidence "marker" when it has any,
 * else all its tests (mentions only).
 * counted: scenarios whose coverage status is "passing" and of whose counting tests one has
 * `committed: true`. ok: total > 0 and counted === total.
 * detail: `<counted> of <total>`, then for each passing scenario that isn't counted,
 * `; <S-ID> only in uncommitted <file>, <file>` (the files of its counting tests, unique and
 * sorted). The detail is present whether the check passes or fails.
 */
function scenariosPassing(ctx: GateContext, f: FeatureEntity): GateCheck;
```

### `azimuth trace`

Text output: each test line is

```text
    <file>: <name>[ (mention)][ (uncommitted)]
```

` (mention)` as today (only shown with `--all`), ` (uncommitted)` when `committed` is false.
The whole line stays dim on a TTY; scenario lines and the hidden-mentions line don't change.

`--json`: the rows keep their shape (`feature`, `scenario`, `title`, `status`, `tests`); each
test is a `ScenarioTest`, so it carries `committed`.

```text
$ azimuth trace F-001
S-001.1.1 passing Scenario
    test/keymap.test.ts: S-001.1.1 opens the palette
S-001.1.2 passing Scenario
    test/keymap.test.ts: S-001.1.2 lists keys in every preset (uncommitted)
```

### Viewer

```tsx
// viewer/src/screens/feature/StoriesTab.tsx

// chipLabel(s): unchanged for untested; otherwise
//   `${COVERAGE_LOOK[status].label} · ${plural(tests.length, "test")}`
//   + (u > 0 ? ` · ${u} uncommitted` : "")   where u counts tests with committed false.
// ScenarioCard: the test list starts open when the status is "failing" or a test is
//   uncommitted.
// TestRow: after the fallback chip, when test.committed is false:
//   <span className="az-tag fd-test-uncommitted"
//         title="Not committed: the done gate counts only tests in HEAD">uncommitted</span>
export function ScenarioCard(props: { scenario: Scenario }): JSX.Element;

// viewer/src/screens/Verification.tsx

// Now exported for its test. The test cell's title lists `${file} › ${name}` per test, with
// " (uncommitted)" after an uncommitted one, joined by "\n". When any test is uncommitted, the
// cell ends with
//   <span className="az-tag vf-uncommitted"
//         title="Not committed: the done gate counts only tests in HEAD">uncommitted</span>
export function ScenarioRow(props: {
  scenario: Scenario;
  run?: VerifyRun;
  now: number;
  onRun: (id: string) => void;
}): JSX.Element;
```

Styles: `.fd-test-uncommitted` (feature.css) and `.vf-uncommitted` (verification.css) give the
`az-tag` the warning look, `color: var(--label-yellow)` and
`border-color: var(--st-warning-border)`, at the 11 px size of the rows' other secondary text;
`.vf-uncommitted` keeps a small left margin. No new tokens; azimuth.css is not edited.

## Errors

None new. A failed `git status` gives `changed: []`; a failed `git cat-file` gives null blobs
(readBlobs), so the checked refs are uncommitted. The done gate's refusal is the existing
`AzimuthError("gate", …)` from `moveFeature`, with the new detail:

```text
F-001 cannot move to done: Every scenario has a passing test (1 of 2; S-001.1.2 only in uncommitted test/keymap.test.ts).
```

## State transitions
None.
