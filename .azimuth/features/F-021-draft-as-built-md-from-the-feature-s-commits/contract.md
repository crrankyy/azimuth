---
language: typescript
---
# F-021: Contract

## Data structures

```ts
// src/core/git.ts

/** One commit of a feature, as `git log --name-status --no-renames` prints it. */
export interface CommitChanges {
  /** 7-character SHA. */
  sha: string;
  subject: string;
  /** readCommits' rule: the Refs trailer's IDs, else the IDs in the Conventional Commits scope. */
  refs: Id[];
  /** One per path line, in git's order: status A, M, D or T, and the repo-relative path. */
  changes: { status: string; path: string }[];
}

// src/core/as-built.ts (new)

export type FileChangeKind = "create" | "modify" | "delete";

export interface FileChange {
  path: string;
  change: FileChangeKind;
}

/** The kinds azimuth as-built generates; any other kind is one written by hand. */
export const DEVIATION_KINDS = [
  "unplanned-create",
  "unplanned-modify",
  "unplanned-delete",
  "planned-unchanged",
] as const;
export type DeviationKind = (typeof DEVIATION_KINDS)[number];

/** As AsBuilt (types.ts) holds it: kind is a DeviationKind or a hand-written kind. */
export type Deviation = AsBuilt["deviations"][number];

/** What as-built.md's frontmatter holds, in the order it is written. */
export interface AsBuiltFrontmatter {
  completed_at: ISODate;
  files_changed: FileChange[];
  deviations: Deviation[];
  /** Kept as read from the existing file (a list), else []. */
  follow_ups: unknown[];
}

export interface AsBuiltOptions {
  /** The clock for completed_at (its UTC date); defaults to new Date(). */
  now?: Date;
}

export interface AsBuiltResult {
  feature: Id;
  /** Repo-relative path of the as-built.md written. */
  file: string;
  /** True when the file didn't exist before. */
  created: boolean;
  /** 7-character SHAs of the feature's commits, oldest first. */
  commits: string[];
  files_changed: FileChange[];
  deviations: Deviation[];
  /** The deviations whose reason is blank after trimming, in file order. */
  unexplained: { path: string; kind: string }[];
  /** asBuiltMessage(…): what the CLI prints. */
  message: string;
}
```

## Public signatures

```ts
// src/core/git.ts

/**
 * The commits reachable from HEAD that name the feature (featureOf(ref) === featureId for one of
 * their refs: the feature, its stories, scenarios or tasks), oldest first, with their changes.
 * Reads the whole history, without git.log_depth's limit:
 *   git log --topo-order --reverse --no-renames --name-status --abbrev=7 --fixed-strings
 *           --grep=<F-NNN> --grep=-<NNN>. --format=<sha, subject, Refs trailer>
 * then keeps the commits whose refs (commitRefs, the rule readCommits uses) name the feature.
 * Merge commits list no changes. [] when HEAD has no commit; null when git log fails.
 */
export function readFeatureCommits(root: string, featureId: Id): CommitChanges[] | null;

// Private, shared with readCommits (whose behaviour doesn't change):
// function commitRefs(trailer: string, subject: string): Id[]
//   the unique IDs MENTION_PATTERN finds in the Refs trailer value, else scopeRefs(subject).

// src/core/as-built.ts

/**
 * Each path the commits (oldest first) changed, outside ".azimuth/", once, sorted by path:
 * "create" when its first change is A, else "delete" when its last change is D, else "modify"
 * (M and T are modifications). Structural, so CommitChanges[] fits without importing git.ts.
 */
export function filesChanged(commits: { changes: { status: string; path: string }[] }[]): FileChange[];

/**
 * The deviations of `files` from `impact`, then the hand-written ones of `previous`.
 * Planned rows are the create, modify and test rows whose repoPath isn't empty or under
 * ".azimuth/". A changed path is planned when inScope(path, { paths: <planned row paths>,
 * modules: [], shared: [] }) holds (equal to a row path, or under it as a directory).
 *  - each unplanned changed path: { path, kind: "unplanned-<change>", reason }
 *  - each planned row path (normalised, once) that no changed path equals or lies under:
 *    { path, kind: "planned-unchanged", reason }
 * sorted by path; `reason` is the first non-blank reason of a `previous` entry with the same path
 * and kind, else "". Then every `previous` entry whose kind isn't a DeviationKind, as it is, in
 * its order. `previous` entries of a DeviationKind that isn't generated again are dropped.
 */
export function deviationsFor(
  files: FileChange[],
  impact: Pick<ImpactRaw, "path" | "change">[],
  previous: Deviation[],
): Deviation[];

/**
 * as-built.md's text: `bom`, then "---", "completed_at: <date>", "files_changed:" with one
 * "  - <inlineYaml(item, { padded: true })>" line per item (or "files_changed: []"), the same for
 * "deviations:" (items { path, kind, reason }, keys in that order), "follow_ups:
 * <inlineYaml(list)>", "---", joined with `eol`; then `body` as given.
 */
export function asBuiltText(
  fm: AsBuiltFrontmatter,
  body: string,
  style?: { eol: "\n" | "\r\n"; bom: string },
): string;

/**
 * "Wrote <file> from <n> commit(s): <n> file(s) changed, <n> deviation(s), <k> without a reason."
 * and, when k > 0, a second line "Needs a reason: <path> (<kind>), …" in file order.
 * "1 commit", "1 file changed", "1 deviation"; otherwise plurals. No trailing newline.
 */
export function asBuiltMessage(
  file: string,
  commits: number,
  files: number,
  deviations: Deviation[],
): string;

/**
 * Writes the feature's as-built.md under the project lock (withLock, writeFileAtomic), in order:
 * the ID is a feature ID; the feature exists; its status is verifying or done; the project is a
 * git repository; an existing as-built.md has valid frontmatter; readFeatureCommits isn't null.
 * Then filesChanged, deviationsFor (previous: the existing file's deviations), and asBuiltText
 * with completed_at = the UTC date of opts.now (a done feature keeps an existing non-empty
 * completed_at), the existing follow_ups when a list, and the existing body, or for a new file
 * the body of template(root, "feature/as-built.md") filled with { id, date } (splitFrontmatter).
 * A rerun keeps the file's BOM and line ending. Throws AzimuthError (see Errors).
 */
export function writeAsBuilt(root: string, featureId: string, opts?: AsBuiltOptions): AsBuiltResult;

// src/core/frontmatter.ts: unchanged output without opts.
/** `padded`: a space inside flow collections, `{ path: src/a.ts, change: create }`. */
export function inlineYaml(value: unknown, opts?: { padded?: boolean }): string;

// src/core/create.ts: unchanged, now exported.
/** The project's copy of a template when present, otherwise the built-in one. */
export function template(root: string, name: string): string;

// src/core/run-scope.ts: unchanged, now exported.
/** A path as git prints it: no leading "./", no trailing "/" (a directory needs no marker). */
export function repoPath(path: string): string;

// src/core/gates.ts: doneGate's done.as-built check comes from a private helper.
// function asBuiltCheck(f: FeatureEntity): GateCheck
//   id "done.as-built", rule "as-built.md written" (both unchanged);
//   no as-built.md            → ok false, no detail (as today);
//   f.asBuilt null (errors)   → ok false, detail "as-built.md has errors (see azimuth check <F-ID>)";
//   blank reasons             → ok false, detail "No reason for <path> (<kind>), …" in file order;
//   otherwise                 → ok true.

// src/cli/commands/as-built.ts (new); src/cli/main.ts adds "as-built" to COMMANDS after settle.
export const asBuilt: Command;
//   usage:   "as-built <F-ID> [--json]"
//   summary: "Draft as-built.md from the feature's commits: files changed and deviations from impact.md"
//   options: json (boolean)
//   run: requirePositional(positionals, 0, "F-ID"); idKind(id) !== "feature" → UsageError;
//        runtime(values); writeAsBuilt(rt.root, id); recordInSession(…, { touched: [id] });
//        printJson(result) with --json, else print(result.message).
```

### as-built.md example

The project: `.azimuth/config.yaml` is `MINIMAL_CONFIG` (`test/helpers/tree.ts`), a `.gitignore`
holds `.azimuth/cache/`, and `featureFiles({ id: "F-001", status: "verifying", impact })`
(`test/helpers/project.ts`) writes F-001 in `.azimuth/features/F-001-thing/` with the impact
rows `src/a.ts` create, `src/b.ts` modify, `src/c.ts` modify, `test/a.test.ts` test and
`src/types.ts` read. Commits, after `initRepo`:

1. `chore: start` (`commitAll`): `src/b.ts`, `src/c.ts`, `src/types.ts` and every `.azimuth/`
   file.
2. `feat(F-001): add a\n\nRefs: T-001.1`: adds `src/a.ts`, `src/extra.ts` and
   `test/a.test.ts`, changes `src/b.ts`, and appends a line to
   `.azimuth/features/F-001-thing/plan.md`.

`writeAsBuilt(root, "F-001", { now: new Date("2026-10-20T09:00:00Z") })` writes
`.azimuth/features/F-001-thing/as-built.md` exactly as:

```markdown
---
completed_at: 2026-10-20
files_changed:
  - { path: src/a.ts, change: create }
  - { path: src/b.ts, change: modify }
  - { path: src/extra.ts, change: create }
  - { path: test/a.test.ts, change: create }
deviations:
  - { path: src/c.ts, kind: planned-unchanged, reason: "" }
  - { path: src/extra.ts, kind: unplanned-create, reason: "" }
follow_ups: []
---
# F-001: As built

## Summary

## Deviations

## Follow-ups
```

(with one newline after `## Follow-ups`), and its result's `message` is:

```text
Wrote .azimuth/features/F-001-thing/as-built.md from 1 commit: 4 files changed, 2 deviations, 2 without a reason.
Needs a reason: src/c.ts (planned-unchanged), src/extra.ts (unplanned-create)
```

`azimuth as-built F-001` prints the message and a newline; with `--json`, the `AsBuiltResult`.

## Errors

`writeAsBuilt` throws, in the order it checks (nothing is written):

| Check                       | Code        | Message                                                                                                                                    |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| a feature ID                | `invalid`   | `T-001.1 is not a feature ID.`                                                                                                             |
| the feature exists          | `not-found` | `F-009 does not exist.`                                                                                                                    |
| verifying or done           | `invalid`   | `F-001 is in-progress: azimuth as-built takes a feature in verifying or done.`                                                             |
| a git repository            | `invalid`   | `Not a git repository: azimuth as-built reads the feature's commits.`                                                                      |
| existing frontmatter parses | `invalid`   | `.azimuth/features/F-001-thing/as-built.md has invalid frontmatter. Fix it (azimuth check F-001 shows where), then run azimuth as-built F-001 again.` |
| git log ran                 | `invalid`   | `git log failed; .azimuth/features/F-001-thing/as-built.md was not written.`                                                               |

The CLI prints a thrown `AzimuthError` as `✗ <message>` on stderr and exits 1. Usage errors exit
2 with `<message>` and `Usage: azimuth as-built <F-ID> [--json]` on stderr: `Missing <F-ID>.`,
`T-001.1 is not a feature ID.`, and `runtime`'s "No Azimuth project found" message.

## State transitions
None. `azimuth as-built` changes no status; the done gate's `done.as-built` check is the only
gate that changes.
