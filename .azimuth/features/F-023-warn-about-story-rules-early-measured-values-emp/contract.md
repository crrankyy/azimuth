---
language: typescript
---
# F-023: Contract

## Data structures

```ts
// src/core/parse/stories.ts

/** One line of stories.md as the parser read it. */
export interface SourceLine {
  /**
   * The clause text after `**THEN**` or `**AND**` (and an optional ":"), trimmed, with indented
   * continuation lines joined by a single space, as the parser joins them into the clause.
   */
  text: string;
  /** 1-based line number in the file, frontmatter included. */
  line: number;
}

export interface ScenarioRaw {
  // id, title, kind, given, when, then, line and thenLine are unchanged.
  /**
   * The THEN line, then every AND line that follows it up to the scenario's end, in file order.
   * An AND after GIVEN or WHEN extends that clause and isn't listed. Lines in fenced code are
   * never read. [] when the scenario has no THEN. Not part of the index (build-index maps
   * scenario fields one by one).
   */
  thenLines: SourceLine[];
}
```

```ts
// src/core/validate.ts

/**
 * Warning codes that are hints: likely improvements of a draft that may be deliberate and that
 * nothing silences. `check`, `status --brief` and the index show them like any warning;
 * `autonomy.strict`'s approval check (`approve.no-warnings`) doesn't count them.
 */
export const HINT_CODES: readonly string[]; // ["W-MEASURED", "W-NO-COVERS"]
```

## Public signatures

```ts
// src/core/parse/stories.ts

/**
 * The first fragment of a THEN or AND line that looks like a value only the code can measure,
 * exactly as written, or null. Only the plain-text parts of placeholderParts(line) are tested,
 * each on its own, so an open or settled placeholder never matches. Within a part, the earliest
 * match of either pattern wins:
 * - a range: one or more digits, "..", an optional "=", one or more digits, not right after a
 *   letter, digit, "_" or "." (`9..12`, `2..=5`);
 * - a word: "offset", "caret", "byte", "column" or "position" in any case, not right after a
 *   letter, then either
 *   - any letters or "_" (`byte_range`), one or more spaces, ":", "=" or backticks, and a
 *     number or range, or a name (a letter, then word characters) with "(" before the number
 *     or range and ")" after it (`offset: Some(63)`, `caret: 24`, `byte_range: 34..39`,
 *     `position = 7`), or
 *   - right after the word, a number or range.
 *   A number or range is one or more digits, optionally followed by "..", an optional "=" and
 *   one or more digits.
 * `byte-for-byte`, `byte_to_char(5)`, `byte_to_utf16`, `0.3.0` and `S-023.1.1` don't match.
 */
export function measuredValue(line: string): string | null;
```

```ts
// src/core/validate.ts

/** Whether the problem's code is in HINT_CODES. */
export function isHint(problem: Pick<Problem, "code">): boolean;

// validate(model, facts, derived) keeps its signature. Inside it:
// - featureProblems runs the story-kind loop (W-NO-NEGATIVE) when the feature is specified
//   (draft, approved, in-progress, verifying) or an idea; everything else in its `specified`
//   block stays as it is;
// - for a draft, featureProblems adds W-MEASURED (one per thenLines entry with a measuredValue)
//   and W-NO-COVERS (one per task with empty covers, except a task whose files are non-empty
//   and all end in ".md");
// - a new private milestoneProblems(model) adds W-MILESTONE-READY for each milestone, with
//   milestoneProgress, that milestoneReady accepts, in model order (ID order).
```

```ts
// src/core/derive.ts

/**
 * A planned or active milestone with at least one counted feature, every one of them done.
 * Counting follows milestoneProgress: cancelled and superseded features don't count; a
 * deferred feature counts and isn't done.
 */
export function milestoneReady(m: Pick<Milestone, "status" | "progress">): boolean;
```

```ts
// src/core/next.ts

/**
 * One item per index milestone that milestoneReady accepts, in index order:
 * { ref: m.id, title: m.title, action: `Ask the user to release ${m.id} in the viewer`,
 *   reason: "Every feature is done; only the user releases a milestone" }.
 */
export function releaseItems(index: Index): NextItem[];

/**
 * Highest-value unblocked work across the project, best first: critical issues, milestones ready
 * for release (releaseItems), feature work, then high-severity issues. (Signature unchanged.)
 */
export function nextWork(index: Index): NextItem[];
```

```ts
// src/core/gates.ts — approveGate, inside `if (ctx.model.config.autonomy.strict)` only:
// warnings = featureProblems(ctx, f, "warning") without the problems isHint accepts. The check
// keeps id "approve.no-warnings", rule "No warnings in this feature" and detail
// plural(warnings.length, "warning").
```

## Errors

No new errors and no thrown errors. Four warnings (problems with severity `warning`) are new or
reach more features:

| Code                | When                                                                                     | file                       | line                     | ref              | message                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `W-NO-NEGATIVE`     | A story without a happy and a negative or edge scenario, now also while the feature is `idea` | stories.md (else feature.md) | the story heading's line | the story ID     | `<ST-ID> needs at least one happy and one negative or edge scenario.` (unchanged)                                                       |
| `W-MEASURED`        | The feature is `draft` and a `thenLines` entry has a `measuredValue` m (hint)             | stories.md (else feature.md) | that entry's line        | the scenario ID  | `"<m>" looks like a value only the code can measure. If it is, write {?} instead: the first passing test settles it.`                   |
| `W-NO-COVERS`       | The feature is `draft` and a task's `covers` is empty, unless its `files` is non-empty and every entry ends in `.md` (hint) | plan.md (else feature.md)  | null                     | the task ID      | `<T-ID> covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents.`                            |
| `W-MILESTONE-READY` | `milestoneReady` accepts the milestone                                                   | the milestone's file       | null                     | the milestone ID | `Every feature of <M-ID> is done but it is still <planned or active, its status>; ask the user to release it.`                          |

In contract.md `{?}` is plain text (only stories.md has placeholders): the W-MEASURED message
holds the three characters of the open placeholder.

## State transitions
None.
