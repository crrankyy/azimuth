import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeProject } from "./build-index";
import { RETIRED_STATUSES } from "./derive";
import { AzimuthError } from "./errors";
import { updateFrontmatter } from "./frontmatter";
import { tagCommit } from "./git";
import { idKind } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import { checkExpected, type Result, type Who } from "./transitions";
import type { Sha } from "./types";

export interface ReleaseOptions extends Who {
  /** The git tag to record; Azimuth never creates it. */
  tag?: string;
  /** For viewer actions: the status the user saw; a different current status is a conflict. */
  expectStatus?: string;
}

export interface ReleaseResult extends Result {
  tag: string | null;
  released_commit: Sha | null;
  /**
   * true when git has the tag, false when it doesn't (yet); null without a tag or outside git.
   */
  tag_found: boolean | null;
}

/**
 * Starts with a letter or digit; only letters, digits and . _ + - /; no `..` or `//`; doesn't
 * end with `.`, `/` or `.lock`.
 */
export function isValidTagName(tag: string): boolean {
  if (!/^[A-Za-z0-9][A-Za-z0-9._+\-/]*$/.test(tag)) return false;
  if (tag.includes("..") || tag.includes("//")) return false;
  return !/(?:[./]|\.lock)$/.test(tag);
}

function suffix(tag: string | null, sha: Sha | null): string {
  if (tag && sha) return ` (${tag} at ${sha})`;
  if (tag) return ` (${tag})`;
  if (sha) return ` (at ${sha})`;
  return "";
}

/**
 * Releases a milestone as the user, from active or from planned (passing through active in the
 * same write, since `azimuth move` only allows released after active). Only the milestone's file
 * is written, and only the release keys. Azimuth never creates the tag: it records the name and,
 * when git already has it, the tag's commit rather than HEAD.
 */
export function releaseMilestone(root: string, id: string, opts: ReleaseOptions): ReleaseResult {
  if (idKind(id) !== "milestone") throw new AzimuthError("invalid", `${id} is not a milestone.`);
  if (opts.actor !== "you") throw new AzimuthError("policy", "Only the user releases a milestone.");
  const tag = opts.tag ?? null;
  if (tag !== null && !isValidTagName(tag)) {
    throw new AzimuthError("invalid", `"${tag}" is not a valid tag name.`);
  }
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model, facts } = analyzeProject(root, now);
    const m = model.milestones.find((x) => x.id === id);
    if (!m) throw new AzimuthError("not-found", `${id} does not exist.`);
    checkExpected(m.status, opts.expectStatus, id);
    if (m.status === "released") {
      const when = m.released_at ? ` (${m.released_at})` : "";
      throw new AzimuthError("invalid", `${id} is already released${when}.`);
    }
    const open = model.features.filter(
      (f) => f.milestone === id && !RETIRED_STATUSES.includes(f.status) && f.status !== "done",
    );
    if (open.length > 0) {
      const list = open.map((f) => `${f.id} (${f.status})`).join(", ");
      throw new AzimuthError(
        "invalid",
        `${id} has features that aren't done: ${list}. Finish them or move them to another milestone (azimuth set <F-ID> milestone <M-ID|none>).`,
      );
    }

    const tagged = tag !== null && facts.git.available ? tagCommit(root, tag) : null;
    const tag_found = tag !== null && facts.git.available ? tagged !== null : null;
    const released_commit = tagged ?? facts.git.head;
    const text = updateFrontmatter(readFileSync(join(root, m.file), "utf8"), {
      status: "released",
      released_at: now.toISOString().slice(0, 10),
      tag,
      released_commit,
    });
    writeFileAtomic(join(root, m.file), text);
    const path = m.status === "planned" ? "planned → active → released" : "active → released";
    return {
      ref: id,
      from: m.status,
      to: "released",
      changed: [m.file],
      auto: false,
      message: `${id}: ${path}${suffix(tag, released_commit)}`,
      tag,
      released_commit,
      tag_found,
    };
  });
}
