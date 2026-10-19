import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { showBrief } from "../../src/core/brief";
import { gitFacts, readBlobs, readCommits, toUtc } from "../../src/core/git";
import { globToRegExp, inModule } from "../../src/core/glob";
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

describe("inModule", () => {
  it.each([
    ["src/buffer", true],
    ["src/buffer/gap.rs", true],
    // BUG-0058: Rust's `src/buffer.rs`, like `src/buffer.ts` or `pkg/buffer.py`.
    ["src/buffer.rs", true],
    ["src/buffers.rs", false],
    ["src/buffer.rs.orig", false],
    ["src/bufferx/a.rs", false],
    ["src/lib.rs", true],
  ])("%s → %s", (path, expected) => {
    expect(inModule(path, ["src/buffer", "src/lib.rs"])).toBe(expected);
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

  describe("test names with quote characters", () => {
    const refsOf = (line: string, id: string) => scanTestFile(line, "a.test.ts").get(id);

    it("S-003.1.1 keeps an apostrophe in a double-quoted title", () => {
      expect(refsOf(`it("S-900.1.2 doesn't count", () => {});`, "S-900.1.2")).toEqual([
        { file: "a.test.ts", name: "S-900.1.2 doesn't count", confidence: "marker" },
      ]);
    });

    it("S-003.1.2 keeps double quotes in a single-quoted title", () => {
      expect(refsOf(`it('S-900.1.3 says "hi"', () => {});`, "S-900.1.3")).toEqual([
        { file: "a.test.ts", name: 'S-900.1.3 says "hi"', confidence: "marker" },
      ]);
    });

    it("S-003.1.3 reads an escaped quote of the same kind", () => {
      expect(refsOf(`it('S-900.1.4 isn\\'t lost', () => {});`, "S-900.1.4")).toEqual([
        { file: "a.test.ts", name: "S-900.1.4 isn't lost", confidence: "marker" },
      ]);
    });

    it("S-003.1.4 still treats an ID in a plain string as a mention", () => {
      expect(refsOf(`const note = "S-900.1.5 doesn't apply";`, "S-900.1.5")).toMatchObject([
        { confidence: "fallback" },
      ]);
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

  it("leaves out files matching a ! glob", () => {
    const tree = writeTree({
      "test/a.test.ts": 'it("S-001.1.1 works", () => {});',
      "test/fixtures/sample/b.test.ts": 'it("S-009.1.1 belongs to the sample", () => {});',
    });
    cleanup = tree.cleanup;
    const refs = traceTests(tree.root, ["**/*.test.ts", "!test/fixtures/**"]);
    expect([...refs.keys()]).toEqual(["S-001.1.1"]);
  });
});

describe("gitFacts", () => {
  it("BUG-0065 links a commit without a Refs trailer by the IDs in its scope", () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    commitAll(tree.root, "chore: start", "2026-10-01T10:00:00Z");
    tree.write("a.rs", "1\n");
    commitAll(tree.root, "feat(F-003): recognise inline code spans", "2026-10-01T11:00:00Z");
    tree.write("a.rs", "2\n");
    commitAll(
      tree.root,
      "docs(F-003, T-004.2): note BUG-0001 in the subject",
      "2026-10-01T12:00:00Z",
    );
    tree.write("a.rs", "3\n");
    commitAll(tree.root, "feat(F-003): tidy\n\nRefs: T-003.2", "2026-10-01T13:00:00Z");
    const refs = readCommits(tree.root, 10).map((c) => [c.subject, c.refs]);
    expect(refs).toEqual([
      ["feat(F-003): tidy", ["T-003.2"]],
      ["docs(F-003, T-004.2): note BUG-0001 in the subject", ["F-003", "T-004.2"]],
      ["feat(F-003): recognise inline code spans", ["F-003"]],
      ["chore: start", []],
    ]);
  });

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

describe("close-out in its natural order", () => {
  // Verify, then commit the as-built and the reconciliation together with Refs: F-001.
  const doneChecks = (closeOutAlsoChangesCode: boolean) => {
    const tree = writeTree({
      ".gitignore": ".azimuth/cache/\n",
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({
        id: "F-001",
        status: "verifying",
        tasks: [{ id: "T-001.1", status: "done", covers: ["S-001.1.1", "S-001.1.2"] }],
      }),
      ".azimuth/project/architecture.md": "---\nreconciled_at: null\n---\n",
      "src/app.ts": "export const a = 0;\n",
      "test/app.test.ts":
        'it("S-001.1.1 works", () => {});\nit("S-001.1.2 fails cleanly", () => {});\n',
    });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    commitAll(tree.root, "chore: start", "2026-10-01T10:00:00Z");
    tree.write("src/app.ts", "export const a = 1;\n");
    const built = commitAll(
      tree.root,
      "feat(F-001): build it\n\nRefs: T-001.1",
      "2026-10-02T10:00:00Z",
    );
    tree.write(
      ".azimuth/cache/runs/R-0001.json",
      JSON.stringify({
        id: "R-0001",
        target: "T-001.1",
        command: "pnpm test",
        ok: true,
        exit_code: 0,
        duration_ms: 1,
        at: "2026-10-02T10:05:00Z",
        commit: built,
        output_tail: "",
        scenarios: [
          { id: "S-001.1.1", status: "passing" },
          { id: "S-001.1.2", status: "passing" },
        ],
        junit: null,
      }),
    );
    tree.write(".azimuth/features/F-001-thing/as-built.md", "---\ncompleted_at: 2026-10-02\n---\n");
    tree.write(".azimuth/project/architecture.md", `---\nreconciled_at: ${built}\n---\n`);
    if (closeOutAlsoChangesCode) tree.write("src/app.ts", "export const a = 2;\n");
    commitAll(tree.root, "docs(F-001): close out\n\nRefs: F-001", "2026-10-02T11:00:00Z");
    const { index } = buildIndex(tree.root, { now: new Date("2026-10-02T12:00:00Z") });
    return index.features[0]?.derived.next_gate?.checks.map((c) => [c.id, c.ok]);
  };

  it("S-002.3.1 passes every done check without verifying again", () => {
    expect(doneChecks(false)).toEqual([
      ["done.verify-passed", true],
      ["done.scenarios-passing", true],
      ["done.as-built", true],
      ["done.architecture-reconciled", true],
    ]);
  });

  it("S-002.3.2 fails the verify and architecture checks when the close-out changes code", () => {
    expect(doneChecks(true)).toEqual([
      ["done.verify-passed", false],
      ["done.scenarios-passing", true],
      ["done.as-built", true],
      ["done.architecture-reconciled", false],
    ]);
  });
});

describe("another feature's commits after a passing run (issue 1)", () => {
  // F-001 and F-002 are built in parallel lanes; T-001.1 passed before F-002's commit landed.
  const briefAfter = (laterPath: string) => {
    const tree = writeTree({
      ".gitignore": ".azimuth/cache/\n",
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({
        id: "F-001",
        status: "verifying",
        impact: [{ path: "src/a.ts", change: "modify" }],
        tasks: [
          {
            id: "T-001.1",
            status: "done",
            covers: ["S-001.1.1", "S-001.1.2"],
            files: ["src/a.ts"],
          },
        ],
      }),
      ...featureFiles({
        id: "F-002",
        status: "verifying",
        impact: [{ path: "src/b.ts", change: "modify" }],
        tasks: [
          {
            id: "T-002.1",
            status: "done",
            covers: ["S-002.1.1", "S-002.1.2"],
            files: ["src/b.ts"],
          },
        ],
      }),
      "src/a.ts": "export const a = 0;\n",
      "src/b.ts": "export const b = 0;\n",
    });
    cleanup = tree.cleanup;
    initRepo(tree.root);
    commitAll(tree.root, "chore: start", "2026-10-01T10:00:00Z");
    tree.write("src/a.ts", "export const a = 1;\n");
    const x = commitAll(
      tree.root,
      "feat(F-001): build it\n\nRefs: T-001.1",
      "2026-10-02T10:00:00Z",
    );
    tree.write(
      ".azimuth/cache/runs/R-0001.json",
      JSON.stringify({
        id: "R-0001",
        target: "T-001.1",
        command: "pnpm test",
        ok: true,
        exit_code: 0,
        duration_ms: 1,
        at: "2026-10-02T10:05:00Z",
        commit: x,
        output_tail: "",
        scenarios: [],
        junit: null,
      }),
    );
    tree.write(laterPath, "export const changed = 2;\n");
    const y = commitAll(
      tree.root,
      "feat(F-002): build it\n\nRefs: T-002.1",
      "2026-10-02T11:00:00Z",
    );
    const { index } = buildIndex(tree.root, { now: new Date("2026-10-02T12:00:00Z") });
    return { brief: showBrief(index, "F-001")?.split("\n") ?? [], x, y };
  };

  it("S-006.5.1 keeps the run current across a commit to a file only another feature lists", () => {
    expect(briefAfter("src/b.ts").brief).toContain(
      "  ✓ Latest verify run of every task passed at HEAD",
    );
  });

  it("S-006.5.2 names the commit and path when the feature's own file changes", () => {
    const { brief, x, y } = briefAfter("src/a.ts");
    expect(x).toHaveLength(7);
    expect(y).toHaveLength(7);
    expect(brief).toContain(
      `  ✗ Latest verify run of every task passed at HEAD — T-001.1 last passed at ${x}; ${y} changed src/a.ts`,
    );
  });
});
