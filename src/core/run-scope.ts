import { globToRegExp, inModule, matchesAny } from "./glob";
import type { FeatureEntity } from "./model";
import type { TaskRaw } from "./parse/feature";
import type { Module } from "./types";

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
): RunScope | null {
  const impactPaths = feature.impact.filter((e) => e.change !== "read").map((e) => e.path);
  const paths = [...new Set([...task.files, ...impactPaths].map(repoPath).filter(Boolean))];
  if (paths.length === 0) return null;
  // Test and read entries add no modules, as in W-PATH: a test module depends on almost every
  // other module.
  const changed = feature.impact
    .filter((e) => e.change === "create" || e.change === "modify")
    .map((e) => repoPath(e.path));
  const own = modules.filter((m) => changed.some((p) => inModule(p, [m.path])));
  const deps = new Set(own.flatMap((m) => m.depends_on));
  return {
    paths,
    modules: modules.filter((m) => deps.has(m.name)).map((m) => m.path),
    shared: sharedPaths.map(globToRegExp),
  };
}

/** Whether a changed path (repo-relative, as git prints it) falls in the scope. */
export function inScope(path: string, scope: RunScope): boolean {
  return (
    scope.paths.some((p) => path === p || path.startsWith(`${p}/`)) ||
    inModule(path, scope.modules) ||
    matchesAny(path, scope.shared)
  );
}

/** A path as git prints it: no leading "./", no trailing "/" (a directory needs no marker). */
export function repoPath(path: string): string {
  return path
    .trim()
    .replace(/^(\.\/)+/, "")
    .replace(/\/+$/, "");
}
