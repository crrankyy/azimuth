import { execFileSync } from "node:child_process";

/** Git environment isolated from the developer's config, with deterministic dates. */
export function gitEnv(date?: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TZ: "UTC",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.test",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.test",
    ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
  };
}

export function git(root: string, args: string[], date?: string): string {
  return execFileSync("git", args, { cwd: root, env: gitEnv(date), encoding: "utf8" }).trim();
}

export function initRepo(root: string): void {
  git(root, ["init", "-q", "-b", "main"]);
}

/** Stages everything and commits; returns the 7-char SHA. */
export function commitAll(root: string, message: string, date = "2026-10-01T10:00:00Z"): string {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "--allow-empty", "-m", message], date);
  return git(root, ["rev-parse", "--short=7", "HEAD"]);
}
