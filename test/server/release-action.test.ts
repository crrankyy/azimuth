import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAction } from "../../src/server/actions";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const M01 = ".azimuth/milestones/M-01-mvp.md";

const PLANNED =
  "---\nid: M-01\ntitle: MVP\nstatus: planned\ntarget: null\nreleased_at: null\ngoal: Ship it.\n---\n## Scope notes\n";

/** A git project with M-01 planned and no features, committed once; returns HEAD too. */
function gitProject(): { root: string; head: string } {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    [M01]: PLANNED,
  });
  cleanup = tree.cleanup;
  initRepo(tree.root);
  return { root: tree.root, head: commitAll(tree.root, "chore: init") };
}

const readAt = (root: string, file: string) => readFileSync(join(root, file), "utf8");

describe("the viewer's release action", () => {
  it("S-028.6.7 releases a planned milestone through the server", () => {
    const { root, head } = gitProject();
    const today = new Date().toISOString().slice(0, 10);
    const response = runAction(root, { action: "release", ref: "M-01", expect: "planned" });
    expect(response).toEqual({
      result: {
        ref: "M-01",
        from: "planned",
        to: "released",
        changed: [M01],
        auto: false,
        message: `M-01: planned → active → released (at ${head})`,
        tag: null,
        released_commit: head,
        tag_found: null,
      },
    });
    expect(readAt(root, M01)).toBe(
      `---\nid: M-01\ntitle: MVP\nstatus: released\ntarget: null\nreleased_at: ${today}\ngoal: Ship it.\ntag: null\nreleased_commit: ${head}\n---\n## Scope notes\n`,
    );
  });

  it("S-028.6.8 answers a stale release with 409 and writes nothing", () => {
    const { root } = gitProject();
    const response = runAction(root, { action: "release", ref: "M-01", expect: "active" });
    expect(response).toEqual({
      status: 409,
      body: {
        ok: false,
        error: "conflict",
        message: "M-01 is now planned, not active. Reload to see the latest state.",
      },
    });
    expect(readAt(root, M01)).toBe(PLANNED);
  });
});
