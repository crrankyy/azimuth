import { afterEach, describe, expect, it } from "vitest";
import { gitFacts, readBlobs, toUtc } from "../../src/core/git";
import { globToRegExp } from "../../src/core/glob";
import { loadProject } from "../../src/core/model";
import { scanTestFile, traceTests } from "../../src/core/trace";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

describe("globToRegExp", () => {
  it.each([
    ["src/**/*.test.ts", "src/a/b/c.test.ts", true],
    ["src/**/*.test.ts", "src/c.test.ts", true],
    ["src/**/*.test.ts", "lib/c.test.ts", false],
    ["test_*.py", "test_api.py", true],
    ["**/*.{ts,tsx}", "x/y.tsx", true],
    ["*.ts", "a/b.ts", false],
  ])("%s matches %s → %s", (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});

describe("scanTestFile", () => {
  it("finds JS titles, pytest markers, comments and fallback mentions", () => {
    const text = [
      'it("S-005.1.1 retries a 503", () => {});',
      "test.skip('S-005.1.2 does not retry', () => {});",
      '@pytest.mark.scenario("S-005.2.1")',
      "def test_exhausted():",
      "// scenario: S-005.3.1",
      "#[test] fn recovers_lease() {}",
      "// see S-005.9.9 for context",
    ].join("\n");
    const refs = scanTestFile(text, "t.test.ts");
    expect(
      Object.fromEntries(
        [...refs].map(([id, list]) => [id, list.map((r) => [r.name, r.confidence])]),
      ),
    ).toEqual({
      "S-005.1.1": [["S-005.1.1 retries a 503", "marker"]],
      "S-005.1.2": [["S-005.1.2 does not retry", "marker"]],
      "S-005.2.1": [["test_exhausted", "marker"]],
      "S-005.3.1": [["recovers_lease", "marker"]],
      "S-005.9.9": [["// see S-005.9.9 for context", "fallback"]],
    });
  });

  it("only scans files matching the globs", () => {
    const tree = writeTree({
      "src/a.test.ts": 'it("S-001.1.1 works", () => {});',
      "src/a.ts": "// S-001.1.2 mentioned in source",
    });
    cleanup = tree.cleanup;
    const refs = traceTests(tree.root, ["src/**/*.test.ts"]);
    expect([...refs.keys()]).toEqual(["S-001.1.1"]);
  });
});

describe("gitFacts", () => {
  it("reads commits, trailers, actors, sessions and spec state at HEAD", () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({ id: "F-001", status: "draft" }),
    });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    const first = commitAll(tree.root, "chore: start", "2026-10-01T10:00:00Z");
    tree.write("src/app.ts", "export const a = 1;\n");
    const second = commitAll(
      tree.root,
      "feat(F-001): build it\n\nRefs: T-001.1, F-001\nCo-Authored-By: Claude <noreply@anthropic.com>",
      "2026-10-02T10:00:00+02:00",
    );
    tree.write(
      ".azimuth/sessions/SES-20261002-0900.md",
      `---\nid: SES-20261002-0900\nstarted_at: 2026-10-02T09:00:00Z\ncommits: [${first}]\n---\n`,
    );
    const model = loadProject(tree.root);
    const facts = gitFacts(tree.root, model);
    expect(facts.available).toBe(true);
    expect(facts.branch).toBe("main");
    expect(facts.head).toBe(second);
    expect(facts.dirty).toBe(false);
    expect(facts.commits).toEqual([
      {
        sha: second,
        at: "2026-10-02T08:00:00Z",
        actor: "agent",
        session: null,
        subject: "feat(F-001): build it",
        refs: ["T-001.1", "F-001"],
        files_changed: 1,
      },
      {
        sha: first,
        at: "2026-10-01T10:00:00Z",
        actor: "agent",
        session: "SES-20261002-0900",
        subject: "chore: start",
        refs: [],
        files_changed: 7,
      },
    ]);
    expect(facts.commitsAfter(first)).toBe(1);
    expect(facts.headSpecHash.get("F-001")).toMatch(/^sha256:/);
  });

  it("finds spec edits made after approval, ignoring frontmatter-only changes", () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({
        id: "F-001",
        status: "approved",
        extra: { approved_hash: "sha256:placeholder" },
      }),
    });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    const approvedAt = commitAll(tree.root, "docs(F-001): spec", "2026-10-01T10:00:00Z");
    const dir = ".azimuth/features/F-001-thing/";
    const feature = loadProject(tree.root).features[0];
    tree.write(
      `${dir}feature.md`,
      `---\nid: F-001\ntitle: Renamed\nstatus: approved\nsize: M\ncreated: 2026-10-01\napproved_hash: sha256:placeholder\napproved_commit: ${approvedAt}\n---\n${feature?.body ?? ""}`,
    );
    commitAll(tree.root, "chore: rename", "2026-10-02T10:00:00Z");
    tree.write(`${dir}contract.md`, "## Types\n```ts\ntype A = 2;\n```\n");
    const edit = commitAll(
      tree.root,
      "docs(F-001): change contract\n\nRefs: F-001",
      "2026-10-03T10:00:00Z",
    );
    tree.write(`${dir}stories.md`, "## ST-001.1 · Changed\n");
    const facts = gitFacts(tree.root, loadProject(tree.root));
    expect(facts.approvalChanges.get("F-001")).toEqual([
      { path: `${dir}contract.md`, commit: edit, at: "2026-10-03T10:00:00Z", session: null },
      { path: `${dir}stories.md`, commit: null, at: null, session: null },
    ]);
  });

  it("degrades gracefully outside a repository", () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    const facts = gitFacts(tree.root, loadProject(tree.root));
    expect(facts.available).toBe(false);
    expect(facts.commits).toEqual([]);
  });
});

describe("readBlobs and toUtc", () => {
  it("returns null for missing blobs", () => {
    const tree = writeTree({ "a.txt": "hello\n" });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    commitAll(tree.root, "init");
    const blobs = readBlobs(tree.root, ["HEAD:a.txt", "HEAD:missing.txt"]);
    expect(blobs.get("HEAD:a.txt")).toBe("hello\n");
    expect(blobs.get("HEAD:missing.txt")).toBeNull();
  });

  it("normalizes offsets to UTC", () => {
    expect(toUtc("2026-10-18T13:55:00+02:00")).toBe("2026-10-18T11:55:00Z");
  });
});
