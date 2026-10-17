import { execFileSync, spawnSync } from "node:child_process";
import { featureBodyOf, type FeatureEntity, type Model } from "./model";
import { emptyGitFacts, type GitFacts } from "./facts";
import { MENTION_PATTERN } from "./ids";
import { specHash } from "./spec-hash";
import type { ApprovalChange, Commit } from "./types";
import { ACTIVE_STATUSES } from "./derive";

const SEP = "\x1f";
const REC = "\x1e";

function git(root: string, args: string[], input?: string): string | null {
  const result = spawnSync("git", ["-c", "core.quotepath=off", ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout : null;
}

export function isGitRepo(root: string): boolean {
  return git(root, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

/**
 * Timestamps in the index are UTC with `Z`, at whole seconds: git records commit times to the
 * second, so finer stamps would make same-second events compare out of order.
 */
export function toUtc(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.000Z$/, "Z");
}

interface RawCommit extends Commit {
  coAuthors: string;
  files: string[];
}

export function readCommits(root: string, depth: number): RawCommit[] {
  const format = [
    `${REC}%h`,
    "%cI",
    "%s",
    "%(trailers:key=Refs,valueonly,separator=%x2C)",
    "%(trailers:key=Co-Authored-By,valueonly,separator=%x3B)",
  ].join(SEP);
  const out = git(root, ["log", `-n${depth}`, "--abbrev=7", "--name-only", `--format=${format}`]);
  if (!out) return [];
  return out
    .split(REC)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [header = "", ...rest] = chunk.split("\n");
      const [sha = "", at = "", subject = "", refs = "", coAuthors = ""] = header.split(SEP);
      const files = rest.map((l) => l.trim()).filter(Boolean);
      return {
        sha,
        at: toUtc(at),
        actor: "you" as const,
        session: null,
        subject,
        refs: [...new Set(refs.match(MENTION_PATTERN) ?? [])],
        files_changed: files.length,
        coAuthors,
        files,
      };
    });
}

/** Reads many `rev:path` blobs with one `git cat-file --batch`. Missing blobs map to null. */
export function readBlobs(root: string, specs: string[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (specs.length === 0) return out;
  const result = spawnSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: specs.join("\n") + "\n",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "ignore"],
  });
  if (result.status !== 0 || !result.stdout) {
    for (const s of specs) out.set(s, null);
    return out;
  }
  const buf = result.stdout as Buffer;
  let pos = 0;
  for (const spec of specs) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl === -1) break;
    const header = buf.subarray(pos, nl).toString("utf8");
    pos = nl + 1;
    const match = /^\S+ (\S+) (\d+)$/.exec(header);
    if (!match || match[1] !== "blob") {
      out.set(spec, null);
      continue;
    }
    const size = Number(match[2]);
    out.set(spec, buf.subarray(pos, pos + size).toString("utf8"));
    pos += size + 1;
  }
  return out;
}

const SPEC_FILES = ["feature.md", "impact.md", "stories.md", "contract.md"] as const;

function hashAt(blobs: Map<string, string | null>, rev: string, f: FeatureEntity): string | null {
  const text = (name: string) => blobs.get(`${rev}:${f.dir}${name}`) ?? null;
  const feature = text("feature.md");
  const impact = text("impact.md");
  const stories = text("stories.md");
  const contract = text("contract.md");
  if (feature === null || impact === null || stories === null || contract === null) return null;
  return specHash({ featureBody: featureBodyOf(feature), impact, stories, contract });
}

const NEEDS_HEAD_HASH = ["draft", ...ACTIVE_STATUSES];

/** Gathers git history and spec-at-HEAD facts for the analysis. */
export function gitFacts(root: string, model: Model): GitFacts {
  if (!isGitRepo(root)) return emptyGitFacts();
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ?? null;
  const head = git(root, ["rev-parse", "--short=7", "HEAD"])?.trim() || null;
  const status = git(root, ["status", "--porcelain", "--untracked-files=no"]);
  const raw = head ? readCommits(root, model.config.git.log_depth) : [];

  const sessionOf = new Map<string, string>();
  for (const s of model.sessions) for (const sha of s.commits) sessionOf.set(sha.slice(0, 7), s.id);
  const pattern = model.config.git.agent_pattern.toLowerCase();
  const commits: Commit[] = raw.map((c) => {
    const session = sessionOf.get(c.sha.slice(0, 7)) ?? null;
    const agent =
      session !== null || (pattern !== "" && c.coAuthors.toLowerCase().includes(pattern));
    return {
      sha: c.sha,
      at: c.at,
      actor: agent ? "agent" : "you",
      session,
      subject: c.subject,
      refs: c.refs,
      files_changed: c.files_changed,
    };
  });
  const files = new Map(raw.map((c) => [c.sha, c.files]));
  const position = new Map(raw.map((c, i) => [c.sha, i]));
  const afterCache = new Map<string, number | null>();
  const commitsAfter = (sha: string): number | null => {
    const short = sha.slice(0, 7);
    if (position.has(short)) return position.get(short) as number;
    if (afterCache.has(sha)) return afterCache.get(sha) as number | null;
    const count = git(root, ["rev-list", "--count", `${sha}..HEAD`]);
    const value = count === null ? null : Number(count.trim());
    afterCache.set(sha, value);
    return value;
  };

  const headSpecHash = new Map<string, string | null>();
  const approvalChanges = new Map<string, ApprovalChange[]>();
  if (head) {
    const tracked = model.features.filter((f) => NEEDS_HEAD_HASH.includes(f.status) && f.spec);
    const blobs = readBlobs(
      root,
      tracked.flatMap((f) => SPEC_FILES.map((n) => `HEAD:${f.dir}${n}`)),
    );
    for (const f of tracked) headSpecHash.set(f.id, hashAt(blobs, "HEAD", f));
    for (const f of model.features) {
      const changes = approvalChangesFor(root, f, raw, blobs, sessionOf);
      if (changes.length > 0) approvalChanges.set(f.id, changes);
    }
  }

  return {
    available: true,
    branch: branch === "HEAD" ? null : branch,
    head,
    dirty: status !== null && status.trim() !== "",
    commits,
    files,
    headSpecHash,
    approvalChanges,
    commitsAfter,
  };
}

/** Spec edits after approval: commits touching spec files, plus uncommitted edits. */
function approvalChangesFor(
  root: string,
  f: FeatureEntity,
  raw: RawCommit[],
  headBlobs: Map<string, string | null>,
  sessionOf: Map<string, string>,
): ApprovalChange[] {
  if (!ACTIVE_STATUSES.includes(f.status) || !f.approved_hash || !f.spec) return [];
  const current = specHash(f.spec);
  if (current === f.approved_hash) return [];
  const approvedIndex = f.approved_commit
    ? raw.findIndex((c) => c.sha.startsWith(f.approved_commit as string))
    : -1;
  const approvedMs = f.approved_at ? Date.parse(`${f.approved_at}T23:59:59Z`) : Number.NaN;
  const after = raw.filter((c, i) =>
    approvedIndex >= 0
      ? i < approvedIndex
      : !Number.isNaN(approvedMs) && Date.parse(c.at) > approvedMs,
  );
  const specPaths = new Set(SPEC_FILES.map((n) => `${f.dir}${n}`));
  const touching = after.filter((c) => c.files.some((p) => specPaths.has(p)));
  const bodyChanged = bodyChangedIn(root, f, touching);
  const changes: ApprovalChange[] = [];
  for (const c of [...touching].reverse()) {
    for (const path of c.files.filter((p) => specPaths.has(p))) {
      if (path.endsWith("feature.md") && !bodyChanged.has(c.sha)) continue;
      changes.push({ path, commit: c.sha, at: c.at, session: sessionOf.get(c.sha) ?? null });
    }
  }
  for (const path of uncommittedSpecFiles(f, headBlobs)) {
    changes.push({ path, commit: null, at: null, session: null });
  }
  return changes;
}

/** Spec files whose working-tree content differs from HEAD (feature.md compared by body). */
function uncommittedSpecFiles(f: FeatureEntity, headBlobs: Map<string, string | null>): string[] {
  if (!f.spec) return [];
  const working: Record<(typeof SPEC_FILES)[number], string> = {
    "feature.md": f.spec.featureBody,
    "impact.md": f.spec.impact,
    "stories.md": f.spec.stories,
    "contract.md": f.spec.contract,
  };
  return SPEC_FILES.filter((name) => {
    const atHead = headBlobs.get(`HEAD:${f.dir}${name}`);
    if (atHead === undefined) return false;
    if (atHead === null) return true;
    const committed = name === "feature.md" ? featureBodyOf(atHead) : atHead;
    return committed !== working[name];
  }).map((name) => `${f.dir}${name}`);
}

/** Commits whose change to feature.md touched the body, not just frontmatter. */
function bodyChangedIn(root: string, f: FeatureEntity, commits: RawCommit[]): Set<string> {
  const path = `${f.dir}feature.md`;
  const relevant = commits.filter((c) => c.files.includes(path));
  const blobs = readBlobs(
    root,
    relevant.flatMap((c) => [`${c.sha}:${path}`, `${c.sha}^:${path}`]),
  );
  const out = new Set<string>();
  for (const c of relevant) {
    const now = blobs.get(`${c.sha}:${path}`);
    const before = blobs.get(`${c.sha}^:${path}`);
    if (now === null || now === undefined || before === null || before === undefined) {
      out.add(c.sha);
      continue;
    }
    if (featureBodyOf(now) !== featureBodyOf(before)) out.add(c.sha);
  }
  return out;
}

/** HEAD SHA (7 chars), or null outside a repo or before the first commit. */
export function headSha(root: string): string | null {
  return git(root, ["rev-parse", "--short=7", "HEAD"])?.trim() || null;
}

export function gitTopLevel(root: string): string | null {
  return git(root, ["rev-parse", "--show-toplevel"])?.trim() || null;
}

export function gitCommonDir(root: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
