import type { ApprovalChange, Commit, Sha } from "./types";

/**
 * Everything the analysis needs from outside `.azimuth/`: git history, test files and the
 * clock. Gathered by build-index (git.ts, trace.ts) and injected so analysis stays pure.
 */
export interface GitFacts {
  available: boolean;
  branch: string | null;
  head: Sha | null;
  dirty: boolean;
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
}

export interface Facts {
  now: Date;
  git: GitFacts;
  /** Scenario ID → tests that reference it. */
  tests: Map<string, TestRef[]>;
  /** Whether a repo-relative path exists in the working tree. */
  exists: (path: string) => boolean;
}

export function emptyGitFacts(): GitFacts {
  return {
    available: false,
    branch: null,
    head: null,
    dirty: false,
    commits: [],
    files: new Map(),
    headSpecHash: new Map(),
    approvalChanges: new Map(),
    commitsAfter: () => null,
  };
}
