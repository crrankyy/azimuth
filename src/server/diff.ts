import { spawnSync } from "node:child_process";
import type { Feature } from "../core/types";

const MAX_BYTES = 20 * 1024;
const SPEC_FILES = ["feature.md", "impact.md", "stories.md", "contract.md"];

function git(root: string, args: string[]): string {
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return r.status === 0 ? r.stdout : "";
}

function cap(text: string): string {
  return Buffer.byteLength(text) > MAX_BYTES
    ? `${text.slice(0, MAX_BYTES)}\n… diff truncated`
    : text;
}

/** Unified diffs of the spec files that changed since the feature was approved. */
export function approvalDiff(root: string, feature: Feature): { path: string; diff: string }[] {
  const changed = [...new Set(feature.derived.approval_changes.map((c) => c.path))];
  const paths = changed.length > 0 ? changed : SPEC_FILES.map((n) => `${feature.file}${n}`);
  if (feature.approved_commit) {
    return paths
      .map((path) => ({
        path,
        diff: cap(git(root, ["diff", feature.approved_commit as string, "--", path])),
      }))
      .filter((d) => d.diff);
  }
  // No recorded approval commit: show each later commit's change, then uncommitted edits.
  return feature.derived.approval_changes.map((change) => ({
    path: change.path,
    diff: cap(
      change.commit
        ? git(root, ["show", "--format=", change.commit, "--", change.path])
        : git(root, ["diff", "HEAD", "--", change.path]),
    ),
  }));
}
