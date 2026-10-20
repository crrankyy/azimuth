import type { ApprovalChange, Commit, Id, ISODateTime, Sha } from "./types";

/**
 * Everything the analysis needs from outside `.azimuth/`: git history, test files and the
 * clock. Gathered by build-index (git.ts, trace.ts) and injected so analysis stays pure.
 */
export interface GitFacts {
  available: boolean;
  branch: string | null;
  head: Sha | null;
  dirty: boolean;
  /**
   * Every path `git status --porcelain -z --untracked-files=all` names, sorted and unique:
   * modified, added, deleted and unmerged files, untracked files (each file of an untracked
   * directory) and a rename's or copy's new path. Relative to the repository root. [] without
   * git or when the status call fails.
   */
  changed: string[];
  /** Newest first. */
  commits: Commit[];
  /** Files changed per commit SHA. */
  files: Map<Sha, string[]>;
  /** Spec hash of each feature as committed at HEAD (null when its spec isn't in HEAD). */
  headSpecHash: Map<string, string | null>;
  /** Commits (or the working tree) that changed a feature's spec after its approval. */
  approvalChanges: Map<string, ApprovalChange[]>;
  /** Number of commits on the current branch after `sha`; null when `sha` is unknown. */
  commitsAfter: (sha: string) => number | null;
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

export interface Facts {
  now: Date;
  git: GitFacts;
  /** Scenario ID → tests that reference it. */
  tests: Map<string, TestRef[]>;
  /** Whether a repo-relative path exists in the working tree. */
  exists: (path: string) => boolean;
  /**
   * Azimuth session ID → when the live log of the Claude Code session whose sidecar names it was
   * last written (its modification time, UTC). Sessions no sidecar names are absent.
   */
  sesLastSeen: Map<Id, ISODateTime>;
}

export function emptyGitFacts(): GitFacts {
  return {
    available: false,
    branch: null,
    head: null,
    dirty: false,
    changed: [],
    commits: [],
    files: new Map(),
    headSpecHash: new Map(),
    approvalChanges: new Map(),
    commitsAfter: () => null,
  };
}
