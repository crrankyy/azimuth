import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { releaseMilestone } from "../../src/core/release";
import { setField } from "../../src/core/transitions";
import { featureFiles } from "../helpers/project";
import { commitAll, git, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const now = new Date("2026-10-31T12:00:00Z");
const you = { actor: "you" as const, now };

const M01 = ".azimuth/milestones/M-01-mvp.md";

const milestone = (status: string, releasedAt = "null") =>
  `---\nid: M-01\ntitle: MVP\nstatus: ${status}\ntarget: null\nreleased_at: ${releasedAt}\ngoal: Ship it.\n---\n## Scope notes\n`;

const released = (tag: string, sha: string) =>
  `---\nid: M-01\ntitle: MVP\nstatus: released\ntarget: null\nreleased_at: 2026-10-31\ngoal: Ship it.\ntag: ${tag}\nreleased_commit: ${sha}\n---\n## Scope notes\n`;

function project(files: Record<string, string>): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    ...files,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

/** A project committed once; returns the root and the commit's SHA (HEAD). */
function gitProject(files: Record<string, string>): { root: string; head: string } {
  const root = project(files);
  initRepo(root);
  return { root, head: commitAll(root, "chore: init") };
}

const readAt = (root: string, file: string) => readFileSync(join(root, file), "utf8");

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

const inM01 = (id: string, status: string) =>
  featureFiles({ id, status, extra: { milestone: "M-01" } });

describe("releaseMilestone", () => {
  it("S-028.3.1 records an existing tag and the tag's commit, not HEAD", () => {
    const { root, head: s1 } = gitProject({ [M01]: milestone("active") });
    git(root, ["tag", "v0.3.1"]);
    const head = commitAll(root, "chore: more");
    expect(head).not.toBe(s1);
    const result = releaseMilestone(root, "M-01", { ...you, tag: "v0.3.1" });
    expect(readAt(root, M01)).toBe(released("v0.3.1", s1));
    expect(result).toEqual({
      ref: "M-01",
      from: "active",
      to: "released",
      changed: [M01],
      auto: false,
      message: `M-01: active → released (v0.3.1 at ${s1})`,
      tag: "v0.3.1",
      released_commit: s1,
      tag_found: true,
    });
  });

  it("S-028.3.2 releases a planned milestone through active in one write", () => {
    const { root, head } = gitProject({ [M01]: milestone("planned") });
    const result = releaseMilestone(root, "M-01", you);
    expect(readAt(root, M01)).toBe(released("null", head));
    expect(result).toMatchObject({
      from: "planned",
      to: "released",
      message: `M-01: planned → active → released (at ${head})`,
      tag: null,
      released_commit: head,
      tag_found: null,
    });
  });

  it("S-028.3.3 records a tag git doesn't have with HEAD and creates no tag", () => {
    const { root, head } = gitProject({ [M01]: milestone("active") });
    const result = releaseMilestone(root, "M-01", { ...you, tag: "v0.4.0" });
    const text = readAt(root, M01);
    expect(text).toContain("\ntag: v0.4.0\n");
    expect(text).toContain(`\nreleased_commit: ${head}\n`);
    expect(result.message).toBe(`M-01: active → released (v0.4.0 at ${head})`);
    expect(result.tag_found).toBe(false);
    expect(git(root, ["tag", "--list"])).toBe("");
  });

  it("S-028.3.4 records a null commit outside git", () => {
    const root = project({ [M01]: milestone("active") });
    const result = releaseMilestone(root, "M-01", { ...you, tag: "v0.3.1" });
    const text = readAt(root, M01);
    expect(text).toContain("\ntag: v0.3.1\n");
    expect(text).toContain("\nreleased_commit: null\n");
    expect(result.message).toBe("M-01: active → released (v0.3.1)");
    expect(result.released_commit).toBeNull();
    expect(result.tag_found).toBeNull();
  });

  it("S-028.3.5 cancelled features don't block the release", () => {
    const { root } = gitProject({
      [M01]: milestone("active"),
      ...inM01("F-001", "done"),
      ...inM01("F-002", "cancelled"),
    });
    const result = releaseMilestone(root, "M-01", you);
    expect(result.to).toBe("released");
    expect(readAt(root, M01)).toContain("\nstatus: released\n");
  });

  it("S-028.4.1 refuses an agent and leaves the file unchanged", () => {
    const { root } = gitProject({ [M01]: milestone("active") });
    const before = readAt(root, M01);
    const error = errorOf(() => releaseMilestone(root, "M-01", { actor: "agent", now }));
    expect(error.code).toBe("policy");
    expect(error.message).toBe("Only the user releases a milestone.");
    expect(readAt(root, M01)).toBe(before);
  });

  it("S-028.4.2 refuses while counted features aren't done", () => {
    const { root } = gitProject({
      [M01]: milestone("active"),
      ...inM01("F-001", "done"),
      ...inM01("F-002", "in-progress"),
      ...inM01("F-003", "deferred"),
    });
    const before = readAt(root, M01);
    const error = errorOf(() => releaseMilestone(root, "M-01", you));
    expect(error.code).toBe("invalid");
    expect(error.message).toBe(
      "M-01 has features that aren't done: F-002 (in-progress), F-003 (deferred). Finish them or move them to another milestone (azimuth set <F-ID> milestone <M-ID|none>).",
    );
    expect(readAt(root, M01)).toBe(before);
  });

  it("S-028.4.3 refuses a milestone that is already released", () => {
    const { root } = gitProject({ [M01]: milestone("released", "2026-10-20") });
    const error = errorOf(() => releaseMilestone(root, "M-01", you));
    expect(error.code).toBe("invalid");
    expect(error.message).toBe("M-01 is already released (2026-10-20).");
  });

  it("S-028.4.4 refuses an invalid tag name and leaves the file unchanged", () => {
    const { root } = gitProject({ [M01]: milestone("active") });
    const before = readAt(root, M01);
    const error = errorOf(() => releaseMilestone(root, "M-01", { ...you, tag: "v 1" }));
    expect(error.code).toBe("invalid");
    expect(error.message).toBe('"v 1" is not a valid tag name.');
    expect(readAt(root, M01)).toBe(before);
  });

  it("S-028.4.5 a stale expected status is a conflict", () => {
    const { root } = gitProject({ [M01]: milestone("planned") });
    const error = errorOf(() => releaseMilestone(root, "M-01", { ...you, expectStatus: "active" }));
    expect(error.code).toBe("conflict");
    expect(error.message).toBe("M-01 is now planned, not active. Reload to see the latest state.");
  });

  it("S-028.4.6 refuses an unknown milestone and a non-milestone ID", () => {
    const { root } = gitProject({ [M01]: milestone("active"), ...inM01("F-001", "done") });
    const unknown = errorOf(() => releaseMilestone(root, "M-09", you));
    const other = errorOf(() => releaseMilestone(root, "F-001", you));
    expect([unknown.code, unknown.message]).toEqual(["not-found", "M-09 does not exist."]);
    expect([other.code, other.message]).toEqual(["invalid", "F-001 is not a milestone."]);
  });

  it("S-028.4.7 moving the unfinished features out lets the release through", () => {
    const { root } = gitProject({
      [M01]: milestone("active"),
      ...inM01("F-001", "done"),
      ...inM01("F-002", "in-progress"),
      ...inM01("F-003", "deferred"),
    });
    expect(errorOf(() => releaseMilestone(root, "M-01", you)).code).toBe("invalid");
    setField(root, "F-002", "milestone", null, you);
    setField(root, "F-003", "milestone", null, you);
    const result = releaseMilestone(root, "M-01", you);
    expect(result.to).toBe("released");
    expect(readAt(root, M01)).toContain("\nstatus: released\n");
  });
});
