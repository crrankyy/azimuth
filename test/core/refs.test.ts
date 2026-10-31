import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { initProject } from "../../src/core/init";
import { PROTOCOL } from "../../src/core/protocol";
import { runCli } from "../helpers/cli";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const MILESTONE = ".azimuth/milestones/M-01-mvp.md";
const BUG = ".azimuth/issues/BUG-0001-x.md";

function gitProject(files: Record<string, string>): string {
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  cleanup = tree.cleanup;
  initRepo(tree.root);
  return tree.root;
}

const milestoneProject = () =>
  gitProject({
    [MILESTONE]: "---\nid: M-01\ntitle: MVP\nstatus: active\ntarget: null\ngoal: Ship it.\n---\n",
  });

function firstCommitRefs(root: string): string[] | undefined {
  return buildIndex(root, { now: new Date("2026-10-02T12:00:00Z") }).index.commits[0]?.refs;
}

describe("F-028 Refs to any item", () => {
  it("S-028.1.1 links a release commit to the milestone its Refs trailer names", async () => {
    const root = milestoneProject();
    commitAll(root, "chore(azimuth): release M-01\n\nRefs: M-01");
    expect(firstCommitRefs(root)).toEqual(["M-01"]);
    const check = await runCli(root, ["check", "M-01"]);
    expect([check.code, check.out]).toEqual([0, "No problems.\n"]);
  });

  it("S-028.1.2 links a records-only commit to the issue its Refs trailer names", async () => {
    const root = gitProject({
      [BUG]:
        "---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n",
    });
    commitAll(root, "chore(azimuth): file BUG-0001\n\nRefs: BUG-0001");
    expect(firstCommitRefs(root)).toEqual(["BUG-0001"]);
    const check = await runCli(root, ["check", "BUG-0001"]);
    expect([check.code, check.out]).toEqual([0, "No problems.\n"]);
  });

  it("S-028.1.3 links a commit without a trailer to the milestone in its scope", () => {
    const root = milestoneProject();
    commitAll(root, "chore(M-01): release");
    expect(firstCommitRefs(root)).toEqual(["M-01"]);
  });

  it("S-028.1.4 tells agents a commit may name a milestone or an issue", () => {
    expect(PROTOCOL).toContain(
      "- Commit with Conventional Commits and a `Refs:` trailer naming the task or feature\n  (`Refs: T-005.2`). A commit about another item names that item instead: a release commit its\n  milestone (`Refs: M-04`), a records-only commit its issue (`Refs: BUG-0010`). Commit pending\n  `.azimuth/` changes as well (`chore(azimuth): record decisions`).\n",
    );
    expect(PROTOCOL).toContain(
      "- Only the user answers questions, releases milestones (in the viewer or with\n  `azimuth release`) and overrides gates.",
    );
  });

  it("S-028.1.5 init --refresh rewrites the protocol and keeps the project's conventions", () => {
    const tree = writeTree({});
    cleanup = tree.cleanup;
    initProject(tree.root);
    const conventions = "# Conventions\n\n## Commits\nOur own rule.\n";
    writeFileSync(join(tree.root, ".azimuth/PROTOCOL.md"), "# Old protocol\n");
    writeFileSync(join(tree.root, ".azimuth/project/conventions.md"), conventions);
    const result = initProject(tree.root, { refresh: true });
    expect(readFileSync(join(tree.root, ".azimuth/PROTOCOL.md"), "utf8")).toBe(PROTOCOL);
    expect(readFileSync(join(tree.root, ".azimuth/project/conventions.md"), "utf8")).toBe(
      conventions,
    );
    expect(result.updated).toContain(".azimuth/PROTOCOL.md");
    expect(result.updated).not.toContain(".azimuth/project/conventions.md");
  });

  it("S-028.1.6 writes conventions whose Commits rule names milestones and issues", () => {
    const tree = writeTree({});
    cleanup = tree.cleanup;
    initProject(tree.root);
    const conventions = readFileSync(join(tree.root, ".azimuth/project/conventions.md"), "utf8");
    expect(
      conventions.endsWith(
        "## Commits\nConventional Commits with a `Refs:` trailer naming the task or feature, or the milestone or issue the commit is about.\n",
      ),
    ).toBe(true);
  });
});
