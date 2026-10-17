import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../src/core/frontmatter";
import { expectedIndex } from "../fixtures/hookline/expected-index";
import { createDemoRepo, FIXTURE_DIR, git, HISTORY_DIR, type DemoRepo } from "../helpers/demo-repo";

const RISK_0002 = ".azimuth/issues/RISK-0002-memory-growth.md";
const F006_CONTRACT = ".azimuth/features/F-006-dead-letter-queue/contract.md";
const F008_STORIES = ".azimuth/features/F-008-delivery-replay/stories.md";

const readFixture = (rel: string) => readFileSync(path.join(FIXTURE_DIR, rel), "utf8");

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const rel = prefix + entry.name;
    return entry.isDirectory() ? listFiles(dir, rel + "/") : [rel];
  });
}

/** Every repo-relative path the expected index points at (`file`, `glossary_file`). */
function filePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(filePaths);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    (key === "file" || key === "glossary_file") && typeof child === "string"
      ? [child]
      : filePaths(child),
  );
}

describe("Hookline fixture files", () => {
  it("parses every .azimuth Markdown file except RISK-0002 without frontmatter errors", () => {
    const markdown = listFiles(FIXTURE_DIR, ".azimuth/").filter(
      (rel) => rel.endsWith(".md") && rel !== RISK_0002,
    );
    const errors = markdown.flatMap((rel) =>
      parseFrontmatter(readFixture(rel)).errors.map((e) => `${rel}:${e.line}: ${e.message}`),
    );
    expect(markdown.length).toBeGreaterThan(60);
    expect(errors).toEqual([]);
  });

  it("puts RISK-0002's invalid likelihood on file line 6", () => {
    const text = readFixture(RISK_0002);
    expect(text.split("\n")[5]).toBe("likelihood: med");
    expect(parseFrontmatter(text).keyLines.likelihood).toBe(6);
  });

  it("contains every file the expected index points at", () => {
    const paths = [...new Set(filePaths(expectedIndex))];
    expect(paths.length).toBeGreaterThan(30);
    expect(paths.filter((rel) => !existsSync(path.join(FIXTURE_DIR, rel)))).toEqual([]);
  });

  it("puts the vague THEN of S-008.2.2 on line 41 of F-008's stories", () => {
    const line = readFixture(F008_STORIES).split("\n")[40];
    expect(line).toContain("the request is handled appropriately");
  });
});

describe("createDemoRepo", () => {
  let repo: DemoRepo;
  const run = (args: string[]) => git(repo.root, args);

  beforeAll(() => {
    repo = createDemoRepo();
  });

  afterAll(() => repo.cleanup());

  function describeCommit(sha: string) {
    const format = [
      "%H",
      "%s",
      "%aI",
      "%cI",
      "%(trailers:key=Refs,valueonly)",
      "%(trailers:key=Co-Authored-By,valueonly)",
    ].join("%x00");
    const [full = "", subject = "", authored = "", committed = "", refs = "", coAuthor = ""] = run([
      "show",
      "--no-patch",
      `--format=${format}`,
      sha,
    ]).split("\0");
    const changed = run(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", sha]);
    return {
      sha: full.slice(0, 7),
      subject,
      at: new Date(authored).toISOString(),
      committedAt: new Date(committed).toISOString(),
      refs: refs.trim() === "" ? [] : refs.trim().split(/,\s*/),
      agent: coAuthor.trim() === "Claude <noreply@anthropic.com>",
      filesChanged: changed.trim().split("\n").length,
    };
  }

  it("replays the expected commits with their subjects, dates, trailers and file counts", () => {
    const expected = [...expectedIndex.commits].reverse();
    const actual = run(["rev-list", "--reverse", "HEAD"]).trim().split("\n").map(describeCommit);

    expect(actual).toHaveLength(12);
    expect(
      actual.map(({ sha: _sha, ...commit }, i) => ({
        ...commit,
        // The root commit adds the whole fixture, so its file count can't match the original.
        filesChanged: i === 0 ? null : commit.filesChanged,
      })),
    ).toEqual(
      expected.map((commit, i) => ({
        subject: commit.subject,
        at: new Date(commit.at).toISOString(),
        committedAt: new Date(commit.at).toISOString(),
        refs: commit.refs,
        agent: commit.actor === "agent",
        filesChanged: i === 0 ? null : commit.files_changed,
      })),
    );
    expect([...repo.shas]).toEqual(actual.map((commit) => [commit.subject, commit.sha]));
  });

  it("resolves every placeholder", () => {
    const leftovers = listFiles(repo.root).filter((rel) =>
      readFileSync(path.join(repo.root, rel), "utf8").includes("{{"),
    );
    expect(leftovers).toEqual([]);
  });

  it("commits F-006's contract change on top of its pre-state", () => {
    const sha = repo.shas.get("docs(F-006): add attempt history to dead-letter contract");
    const pre = readFileSync(path.join(HISTORY_DIR, "F-006-contract.pre.md"), "utf8");
    const before = run(["show", `${sha}^:${F006_CONTRACT}`]);
    const after = run(["show", `${sha}:${F006_CONTRACT}`]);

    expect(before).toBe(pre);
    expect(after).toBe(readFixture(F006_CONTRACT));
    expect(after).not.toBe(before);
  });

  it("keeps F-008's and F-009's spec files identical to HEAD", () => {
    const status = run([
      "status",
      "--porcelain",
      "--",
      ".azimuth/features/F-008-delivery-replay/",
      ".azimuth/features/F-009-endpoint-rate-limits/",
    ]);
    expect(status).toBe("");
  });

  it("removes the repository on cleanup", () => {
    repo.cleanup();
    expect(existsSync(repo.root)).toBe(false);
  });
});
