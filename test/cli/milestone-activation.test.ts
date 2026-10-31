import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

describe("milestone activation on the command line", () => {
  it("S-026.1.6 azimuth move prints the activation", async () => {
    const tree = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      "src/app.ts": "export {};\n",
      ".azimuth/milestones/M-01-first.md": "---\nid: M-01\ntitle: First\nstatus: planned\n---\n",
      ...featureFiles({ id: "F-001", status: "approved", extra: { milestone: "M-01" } }),
    });
    cleanup = tree.cleanup;
    const moved = await runCli(tree.root, ["move", "F-001", "in-progress"]);
    expect(moved.code).toBe(0);
    expect(moved.out).toBe("F-001: approved → in-progress (M-01: planned → active)\n");
    const shown = await runCli(tree.root, ["show", "M-01", "--brief"]);
    expect(shown.out).toBe("M-01 active First: 0/1 done\n");
  });
});
