import { readFileSync } from "node:fs";
import { join } from "node:path";
import { template } from "./create";
import { AzimuthError } from "./errors";
import { inlineYaml, parseFrontmatter, splitFrontmatter } from "./frontmatter";
import { isGitRepo, readFeatureCommits } from "./git";
import { idKind } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import { loadProject } from "./model";
import type { ImpactRaw } from "./parse/feature";
import { inScope, repoPath } from "./run-scope";
import { fill } from "./templates";
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

/**
 * as-built.md's text: `bom`, then "---", "completed_at: <date>", "files_changed:" with one
 * "  - <inlineYaml(item, { padded: true })>" line per item (or "files_changed: []"), the same for
 * "deviations:" (items { path, kind, reason }, keys in that order), "follow_ups:
 * <inlineYaml(list)>", "---", joined with `eol`; then `body` as given.
 */
export function asBuiltText(
  fm: AsBuiltFrontmatter,
  body: string,
  style: { eol: "\n" | "\r\n"; bom: string } = { eol: "\n", bom: "" },
): string {
  const list = (key: string, items: object[]) =>
    items.length === 0
      ? [`${key}: []`]
      : [`${key}:`, ...items.map((item) => `  - ${inlineYaml(item, { padded: true })}`)];
  const lines = [
    "---",
    `completed_at: ${inlineYaml(fm.completed_at)}`,
    ...list(
      "files_changed",
      fm.files_changed.map(({ path, change }) => ({ path, change })),
    ),
    // Rebuilt key by key: a kept hand-written deviation may hold its keys in another order.
    ...list(
      "deviations",
      fm.deviations.map(({ path, kind, reason }) => ({ path, kind, reason })),
    ),
    `follow_ups: ${inlineYaml(fm.follow_ups)}`,
    "---",
  ];
  return style.bom + lines.join(style.eol) + style.eol + body;
}

const unexplainedOf = (deviations: Deviation[]) =>
  deviations.filter((d) => d.reason.trim() === "").map(({ path, kind }) => ({ path, kind }));

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Wrote <file> from <n> commit(s): <n> file(s) changed, <n> deviation(s), <k> without a reason."
 * and, when k > 0, a second line "Needs a reason: <path> (<kind>), …" in file order.
 */
export function asBuiltMessage(
  file: string,
  commits: number,
  files: number,
  deviations: Deviation[],
): string {
  const missing = unexplainedOf(deviations);
  const summary =
    `Wrote ${file} from ${count(commits, "commit", "commits")}: ` +
    `${count(files, "file changed", "files changed")}, ` +
    `${count(deviations.length, "deviation", "deviations")}, ${missing.length} without a reason.`;
  if (missing.length === 0) return summary;
  return `${summary}\nNeeds a reason: ${missing.map((d) => `${d.path} (${d.kind})`).join(", ")}`;
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A deviation item as parseAsBuilt reads it, so the writer and the model agree on its fields. */
function toDeviation(item: unknown): Deviation {
  const o = (item ?? {}) as Record<string, unknown>;
  return {
    path: String(o.path ?? ""),
    kind: String(o.kind ?? ""),
    reason: String(o.reason ?? ""),
  };
}

/**
 * Writes the feature's as-built.md under the project lock, after checking in order: the ID is a
 * feature ID; the feature exists; it is verifying or done; the project is a git repository; an
 * existing as-built.md has valid frontmatter; git log ran. A rerun keeps the reasons, the
 * hand-written deviations, follow_ups, the body, the BOM and the line ending; a done feature also
 * keeps its completed_at. Throws AzimuthError; a refusal writes nothing.
 */
export function writeAsBuilt(
  root: string,
  featureId: string,
  opts: AsBuiltOptions = {},
): AsBuiltResult {
  if (idKind(featureId) !== "feature") {
    throw new AzimuthError("invalid", `${featureId} is not a feature ID.`);
  }
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const f = loadProject(root).features.find((x) => x.id === featureId);
    if (!f) throw new AzimuthError("not-found", `${featureId} does not exist.`);
    if (f.status !== "verifying" && f.status !== "done") {
      throw new AzimuthError(
        "invalid",
        `${f.id} is ${f.status}: azimuth as-built takes a feature in verifying or done.`,
      );
    }
    // Without git every planned row would read as unchanged, a draft worse than none.
    if (!isGitRepo(root)) {
      throw new AzimuthError(
        "invalid",
        "Not a git repository: azimuth as-built reads the feature's commits.",
      );
    }
    const file = f.files.asBuilt ?? `${f.dir}as-built.md`;
    const abs = join(root, file);
    const existing = f.files.asBuilt ? readFileSync(abs, "utf8") : null;
    const previous = existing === null ? null : parseFrontmatter(existing);
    if (previous && previous.errors.length > 0) {
      throw new AzimuthError(
        "invalid",
        `${file} has invalid frontmatter. Fix it (azimuth check ${f.id} shows where), then run azimuth as-built ${f.id} again.`,
      );
    }
    const commits = readFeatureCommits(root, f.id);
    if (commits === null) {
      throw new AzimuthError("invalid", `git log failed; ${file} was not written.`);
    }

    const files_changed = filesChanged(commits);
    const deviations = deviationsFor(
      files_changed,
      f.impact,
      listOf(previous?.data.deviations).map(toDeviation),
    );
    // Rerunning on a done feature refreshes its record without moving the day it was finished.
    const kept = previous?.data.completed_at;
    const completed_at =
      f.status === "done" && typeof kept === "string" && kept.trim() !== ""
        ? kept
        : now.toISOString().slice(0, 10);
    const body = previous
      ? previous.body
      : splitFrontmatter(
          fill(template(root, "feature/as-built.md"), { id: f.id, date: completed_at }),
        ).body;
    const text = asBuiltText(
      { completed_at, files_changed, deviations, follow_ups: listOf(previous?.data.follow_ups) },
      body,
      previous ? { eol: previous.eol, bom: previous.bom } : undefined,
    );
    // Unchanged bytes aren't rewritten, so a rerun with nothing new leaves the file untouched.
    if (text !== existing) writeFileAtomic(abs, text);
    return {
      feature: f.id,
      file,
      created: existing === null,
      commits: commits.map((c) => c.sha),
      files_changed,
      deviations,
      unexplained: unexplainedOf(deviations),
      message: asBuiltMessage(file, commits.length, files_changed.length, deviations),
    };
  });
}
