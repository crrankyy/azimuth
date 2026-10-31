import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { commitAll, git, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const M01 = ".azimuth/milestones/M-01-mvp.md";
const you = { AZIMUTH_ACTOR: "you" };

const milestone = (status: string) =>
  `---\nid: M-01\ntitle: MVP\nstatus: ${status}\ntarget: null\nreleased_at: null\ngoal: Ship it.\n---\n## Scope notes\n`;

/** A project with M-01 at `status`, committed once; returns the root and HEAD's SHA. */
function gitProject(status = "active"): { root: string; head: string } {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    [M01]: milestone(status),
  });
  cleanup = tree.cleanup;
  initRepo(tree.root);
  return { root: tree.root, head: commitAll(tree.root, "chore: init") };
}

const readAt = (root: string, file: string) => readFileSync(join(root, file), "utf8");

describe("azimuth release", () => {
  it("S-028.5.1 releases at an existing tag and leaves a clean check", async () => {
    const { root, head: s1 } = gitProject();
    git(root, ["tag", "v0.3.1"]);
    expect(commitAll(root, "chore: more")).not.toBe(s1);
    const r = await runCli(root, ["release", "M-01", "--tag", "v0.3.1"], you);
    expect(r).toEqual({ code: 0, out: `M-01: active → released (v0.3.1 at ${s1})\n`, err: "" });
    const check = await runCli(root, ["check", "M-01"]);
    expect(check.out).toBe("No problems.\n");
    expect(check.code).toBe(0);
  });

  it("S-028.5.2 hints at the git tag command for a tag git doesn't have", async () => {
    const { root, head } = gitProject();
    const r = await runCli(root, ["release", "M-01", "--tag", "v0.4.0"], you);
    expect(r).toEqual({
      code: 0,
      out: `M-01: active → released (v0.4.0 at ${head})\n`,
      err: `Tag v0.4.0 doesn't exist yet. Create it with: git tag v0.4.0 ${head}\n`,
    });
  });

  it("S-028.5.3 refuses the agent and leaves the milestone file unchanged", async () => {
    const { root } = gitProject();
    const r = await runCli(root, ["release", "M-01"]);
    expect(r).toEqual({ code: 1, out: "", err: "✗ Only the user releases a milestone.\n" });
    expect(readAt(root, M01)).toBe(milestone("active"));
  });

  it("S-028.5.4 a release without an ID is a usage error", async () => {
    const { root } = gitProject();
    const r = await runCli(root, ["release"], you);
    expect(r.code).toBe(2);
    expect(r.err).toBe("Missing <M-ID>.\nUsage: azimuth release <M-ID> [--tag <name>] [--json]\n");
  });

  it("S-028.5.5 --json prints the release result", async () => {
    const { root, head } = gitProject("planned");
    const r = await runCli(root, ["release", "M-01", "--json"], you);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({
      ref: "M-01",
      from: "planned",
      to: "released",
      changed: [M01],
      auto: false,
      message: `M-01: planned → active → released (at ${head})`,
      tag: null,
      released_commit: head,
      tag_found: null,
    });
  });
});
