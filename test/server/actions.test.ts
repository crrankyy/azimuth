import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { runAction } from "../../src/server/actions";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const M01 = ".azimuth/milestones/M-01-first.md";

/** M-01 planned and F-001 approved in M-01. */
function project(): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    [M01]: "---\nid: M-01\ntitle: First\nstatus: planned\n---\n",
    ...featureFiles({ id: "F-001", status: "approved", extra: { milestone: "M-01" } }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("viewer moves and milestone activation", () => {
  it("S-026.1.7 the viewer's move activates the milestone", () => {
    const root = project();
    const response = runAction(root, {
      action: "move",
      ref: "F-001",
      expect: "approved",
      payload: { to: "in-progress" },
    });
    expect(response).toEqual({
      result: {
        ref: "F-001",
        from: "approved",
        to: "in-progress",
        changed: [
          ".azimuth/features/F-001-thing/feature.md",
          ".azimuth/features/F-001-thing/log.md",
          M01,
        ],
        auto: false,
        message: "F-001: approved → in-progress (M-01: planned → active)",
      },
    });
    expect(readFileSync(join(root, M01), "utf8")).toContain("status: active\n");
  });

  it("S-026.1.8 a stale viewer move writes nothing", () => {
    const root = project();
    const response = runAction(root, {
      action: "move",
      ref: "F-001",
      expect: "draft",
      payload: { to: "in-progress" },
    });
    expect(response).toEqual({
      status: 409,
      body: {
        ok: false,
        error: "conflict",
        message: "F-001 is now approved, not draft. Reload to see the latest state.",
      },
    });
    expect(readFileSync(join(root, M01), "utf8")).toContain("status: planned\n");
    expect(loadProject(root).features.find((f) => f.id === "F-001")?.status).toBe("approved");
  });
});
