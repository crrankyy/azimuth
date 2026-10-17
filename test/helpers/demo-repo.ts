/**
 * Builds the Hookline demo repository from `test/fixtures/hookline/`: a real git repo whose
 * history replays the commits listed in the fixture's expected index, so git-derived values
 * (commit actors, refs, approval changes, commits since reconcile) can be computed from it.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "../../src/core/frontmatter";
import { specHash } from "../../src/core/spec-hash";

export interface DemoRepo {
  root: string;
  /** Commit subject → 7-character SHA of the replayed commit. */
  shas: Map<string, string>;
  cleanup(): void;
}

interface FileChange {
  path: string;
  /** Content source under `history/`; defaults to the file's final content in the fixture. */
  from?: string;
}

interface CommitStep {
  subject: string;
  at: string;
  refs: string[];
  agent: boolean;
  files: FileChange[];
}

export const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/hookline/", import.meta.url));
export const HISTORY_DIR = path.join(FIXTURE_DIR, "history");

const AUTHOR = { name: "Hookline Dev", email: "dev@hookline.test" };
const AGENT_TRAILER = "Co-Authored-By: Claude <noreply@anthropic.com>";
const GITIGNORE = ".azimuth/cache/\nnode_modules/\n";

/** Fixture entries that describe the fixture rather than belong to the Hookline repo. */
const NOT_IN_REPO = ["history/", "expected-index.ts"];
/** Written after the replay and left uncommitted: they name replayed SHAs or are local cache. */
const UNCOMMITTED = [".azimuth/sessions/", ".azimuth/cache/"];
const IGNORED_NAMES = new Set([".DS_Store"]);

const F005 = ".azimuth/features/F-005-retry-backoff/";
const F006 = ".azimuth/features/F-006-dead-letter-queue/";
const F008 = ".azimuth/features/F-008-delivery-replay/";
const F009 = ".azimuth/features/F-009-endpoint-rate-limits/";

const SPEC_FILES = ["feature.md", "impact.md", "stories.md", "contract.md", "plan.md", "log.md"];
const wholeSpec = (dir: string): FileChange[] => SPEC_FILES.map((name) => ({ path: dir + name }));

/** The root commit holds every fixture file not introduced later, these ones in an earlier state. */
const ROOT_COMMIT: Omit<CommitStep, "files"> = {
  subject: "docs: reconcile architecture after F-003",
  at: "2026-09-27T17:20:00Z",
  refs: ["F-003"],
  agent: true,
};

const ROOT_PRE_STATES: Record<string, string> = {
  // The final file records this very commit as reconciled_at, which it cannot contain.
  ".azimuth/project/architecture.md": "architecture.pre.md",
  [F006 + "contract.md"]: "F-006-contract.pre.md",
  "package.json": "package.pre.json",
  "pnpm-lock.yaml": "pnpm-lock.pre.yaml",
  "src/api/server.ts": "src/api/server.pre-F-007.ts",
  "src/worker/deliver.ts": "src/worker/deliver.pre-F-007.ts",
};

/** Oldest first; each step writes exactly the files its commit changes. */
const LATER_COMMITS: CommitStep[] = [
  {
    subject: "docs(F-005): spec retry with exponential backoff",
    at: "2026-10-07T11:00:00Z",
    refs: ["F-005"],
    agent: true,
    files: wholeSpec(F005),
  },
  {
    subject: "feat(F-005): retry policy types and scaffolding",
    at: "2026-10-10T14:02:00Z",
    refs: ["T-005.1"],
    agent: true,
    files: [
      { path: "src/retry/types.ts" },
      { path: "src/retry/policy.ts", from: "src/retry/policy.scaffold.ts" },
      { path: "src/retry/classify.ts", from: "src/retry/classify.scaffold.ts" },
    ],
  },
  {
    subject: "chore: bump fastify to 5.1",
    at: "2026-10-15T09:05:00Z",
    refs: [],
    agent: false,
    files: [{ path: "package.json" }, { path: "pnpm-lock.yaml" }],
  },
  {
    subject: "docs(F-006): add attempt history to dead-letter contract",
    at: "2026-10-16T13:38:00Z",
    refs: ["F-006"],
    agent: true,
    files: [{ path: F006 + "contract.md" }],
  },
  {
    subject: "docs(F-009): spec per-endpoint rate limiting",
    at: "2026-10-17T09:45:00Z",
    refs: ["F-009"],
    agent: true,
    files: wholeSpec(F009),
  },
  {
    subject: "feat(F-007): record every delivery attempt",
    at: "2026-10-17T15:10:00Z",
    refs: ["T-007.1", "T-007.2"],
    agent: true,
    files: [
      { path: "src/store/migrations/003_attempts.sql" },
      { path: "src/store/attempts.ts" },
      { path: "src/store/attempts.test.ts" },
      { path: "src/worker/deliver.ts" },
      { path: "src/worker/record-attempt.test.ts" },
    ],
  },
  {
    subject: "feat(F-007): expose attempts at GET /deliveries/:id/attempts",
    at: "2026-10-17T16:35:00Z",
    refs: ["T-007.3", "T-007.4"],
    agent: true,
    files: [
      { path: "src/api/attempts.ts" },
      { path: "src/api/attempts.schema.ts" },
      { path: "src/api/attempts.test.ts" },
      { path: "src/api/server.ts" },
    ],
  },
  {
    subject: "docs(F-008): draft delivery replay spec",
    at: "2026-10-18T10:20:00Z",
    refs: ["F-008"],
    agent: true,
    files: wholeSpec(F008),
  },
  {
    subject: "feat(F-005): exponential backoff with full jitter",
    at: "2026-10-18T11:12:00Z",
    refs: ["T-005.2"],
    agent: true,
    files: [
      { path: "src/retry/policy.ts" },
      { path: "src/retry/backoff.test.ts" },
      { path: "test/support/seeded-random.ts" },
    ],
  },
  {
    subject: "feat(F-005): classify responses as retryable or permanent",
    at: "2026-10-18T11:31:00Z",
    refs: ["T-005.3"],
    agent: true,
    files: [
      { path: "src/retry/classify.ts" },
      { path: "src/retry/classify.test.ts" },
      { path: "src/retry/status-codes.ts" },
    ],
  },
  {
    subject: "test(F-005): add red tests for retry exhaustion",
    at: "2026-10-18T11:55:00Z",
    refs: ["T-005.4"],
    agent: true,
    files: [{ path: "src/retry/policy.test.ts" }, { path: "test/support/fake-bus.ts" }],
  },
];

const readFixture = (rel: string) => readFileSync(path.join(FIXTURE_DIR, rel), "utf8");
const readHistory = (name: string) => readFileSync(path.join(HISTORY_DIR, name), "utf8");

/** A file as the root commit holds it. */
function readRootState(rel: string): string {
  const pre = ROOT_PRE_STATES[rel];
  return pre === undefined ? readFixture(rel) : readHistory(pre);
}

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED_NAMES.has(entry.name)) return [];
    const rel = prefix + entry.name;
    return entry.isDirectory() ? listFiles(dir, rel + "/") : [rel];
  });
}

const startsWithAny = (rel: string, prefixes: string[]) => prefixes.some((p) => rel.startsWith(p));

function repoFiles(): string[] {
  return listFiles(FIXTURE_DIR)
    .filter((rel) => !startsWithAny(rel, NOT_IN_REPO))
    .sort();
}

function rootCommitFiles(all: string[]): string[] {
  const later = new Set(LATER_COMMITS.flatMap((step) => step.files.map((f) => f.path)));
  const kept = all.filter((rel) => !later.has(rel) && !startsWithAny(rel, UNCOMMITTED));
  return [...new Set([...kept, ...Object.keys(ROOT_PRE_STATES)])].sort();
}

function specHashOf(featureDir: string, read: (rel: string) => string): string {
  return specHash({
    featureBody: splitFrontmatter(read(featureDir + "feature.md")).body,
    impact: read(featureDir + "impact.md"),
    stories: read(featureDir + "stories.md"),
    contract: read(featureDir + "contract.md"),
  });
}

/**
 * `{{approved_hash}}` is the hash of the feature's final spec; `{{approved_hash:pre}}` hashes the
 * spec as the root commit holds it (F-006 was approved before its contract changed).
 * `{{sha:<subject>}}` needs that commit to have been replayed already.
 */
function resolvePlaceholders(rel: string, text: string, shas: Map<string, string>): string {
  const featureDir = rel.slice(0, rel.lastIndexOf("/") + 1);
  return text
    .replace(/\{\{approved_hash(:pre)?\}\}/g, (_, pre?: string) =>
      specHashOf(featureDir, pre ? readRootState : readFixture),
    )
    .replace(/\{\{sha:([^}]+)\}\}/g, (_, subject: string) => {
      const sha = shas.get(subject);
      if (sha === undefined)
        throw new Error(`${rel}: commit "${subject}" has not been replayed yet`);
      return sha;
    });
}

function writeRepoFile(root: string, rel: string, text: string): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function gitEnv(at?: string): NodeJS.ProcessEnv {
  // Inherited GIT_* variables (e.g. GIT_DIR inside a hook) would redirect commands to another repo.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  return {
    ...inherited,
    TZ: "UTC",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
    ...(at === undefined ? {} : { GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at }),
  };
}

/** Runs git in `root` with the demo repo's fixed identity and config. */
export function git(root: string, args: string[], at?: string): string {
  return execFileSync("git", args, {
    cwd: root,
    env: gitEnv(at),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function commitMessage(step: Omit<CommitStep, "files">): string {
  const trailers = [
    ...(step.refs.length > 0 ? [`Refs: ${step.refs.join(", ")}`] : []),
    ...(step.agent ? [AGENT_TRAILER] : []),
  ];
  return trailers.length === 0 ? step.subject : `${step.subject}\n\n${trailers.join("\n")}`;
}

function commit(
  root: string,
  step: Omit<CommitStep, "files">,
  paths: string[],
  shas: Map<string, string>,
): void {
  git(root, ["add", "--", ...paths]);
  git(root, ["commit", "--quiet", "--message", commitMessage(step)], step.at);
  shas.set(step.subject, git(root, ["rev-parse", "HEAD"]).trim().slice(0, 7));
}

function replay(root: string, shas: Map<string, string>): void {
  const all = repoFiles();
  const write = (rel: string, text: string) =>
    writeRepoFile(root, rel, resolvePlaceholders(rel, text, shas));

  git(root, ["init", "--quiet", "-b", "main"]);
  writeRepoFile(root, ".gitignore", GITIGNORE);
  for (const rel of rootCommitFiles(all)) write(rel, readRootState(rel));
  commit(root, ROOT_COMMIT, ["."], shas);

  for (const step of LATER_COMMITS) {
    for (const file of step.files) {
      write(file.path, file.from === undefined ? readFixture(file.path) : readHistory(file.from));
    }
    commit(
      root,
      step,
      step.files.map((f) => f.path),
      shas,
    );
  }

  // Final state: unchanged files are rewritten byte-identical, so only real differences show up.
  for (const rel of all) write(rel, readFixture(rel));
}

export function createDemoRepo(): DemoRepo {
  const root = mkdtempSync(path.join(os.tmpdir(), "hookline-"));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  const shas = new Map<string, string>();
  try {
    replay(root, shas);
  } catch (error) {
    cleanup();
    throw error;
  }
  return { root, shas, cleanup };
}
