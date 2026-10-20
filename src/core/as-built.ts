import type { ImpactRaw } from "./parse/feature";
import { inScope, repoPath } from "./run-scope";
import type { AsBuilt, Id, ISODate } from "./types";

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

// Azimuth's own records change with every task and are never planned in impact.md, so they would
// only ever show up as noise.
const inAzimuthDir = (path: string) => path === ".azimuth" || path.startsWith(".azimuth/");

// Code-unit order rather than localeCompare, so the file's bytes don't depend on the machine.
const byPath = (a: { path: string }, b: { path: string }) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

const isDeviationKind = (kind: string): kind is DeviationKind =>
  (DEVIATION_KINDS as readonly string[]).includes(kind);

/** Whether `path` equals one of `rowPaths` or lies under one of them as a directory. */
const covered = (path: string, rowPaths: string[]) =>
  inScope(path, { paths: rowPaths, modules: [], shared: [] });

/**
 * A path's change from its git statuses, oldest first: "delete" when its last change is D (a
 * path created then deleted is gone), else "create" when its first change is A, else "modify"
 * (M and T are modifications).
 */
function changeOf(first: string, last: string): FileChangeKind {
  if (last === "D") return "delete";
  if (first === "A") return "create";
  return "modify";
}

/**
 * Each path the commits (oldest first) changed, outside ".azimuth/", once, sorted by path, with
 * its change (changeOf). Structural, so CommitChanges[] fits without importing git.ts.
 */
export function filesChanged(
  commits: { changes: { status: string; path: string }[] }[],
): FileChange[] {
  const seen = new Map<string, { first: string; last: string }>();
  for (const { status, path } of commits.flatMap((c) => c.changes)) {
    if (inAzimuthDir(path)) continue;
    seen.set(path, { first: seen.get(path)?.first ?? status, last: status });
  }
  return [...seen]
    .map(([path, { first, last }]) => ({ path, change: changeOf(first, last) }))
    .sort(byPath);
}

/**
 * The deviations of `files` from `impact`, then the hand-written ones of `previous`.
 * Planned rows are the create, modify and test rows whose repoPath isn't empty or under
 * ".azimuth/". A changed path is planned when it equals a row path or lies under it.
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
): Deviation[] {
  const planned = [
    ...new Set(
      impact
        .filter((row) => row.change !== "read")
        .map((row) => repoPath(row.path))
        .filter((path) => path !== "" && !inAzimuthDir(path)),
    ),
  ];
  const unplanned = files
    .filter((f) => !covered(f.path, planned))
    .map((f) => ({ path: f.path, kind: `unplanned-${f.change}` }));
  const unchanged = planned
    .filter((row) => !files.some((f) => covered(f.path, [row])))
    .map((path) => ({ path, kind: "planned-unchanged" }));
  // A reason is never invented: only one already written for the same deviation carries over.
  const reasonOf = (path: string, kind: string) =>
    previous.find((d) => d.path === path && d.kind === kind && d.reason.trim() !== "")?.reason ??
    "";
  const generated = [...unplanned, ...unchanged]
    .sort(byPath)
    .map(({ path, kind }) => ({ path, kind, reason: reasonOf(path, kind) }));
  return [...generated, ...previous.filter((d) => !isDeviationKind(d.kind))];
}
