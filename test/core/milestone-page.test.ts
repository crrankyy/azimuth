import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { milestonePage } from "../../src/core/milestone-page";
import { featureFiles, loadTree } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** The page project of F-026's stories, as files. */
const pageFiles = (): Record<string, string> => ({
  ".azimuth/milestones/M-01-first.md":
    "---\nid: M-01\ntitle: First\nstatus: active\ntarget: 2026-11-15\ngoal: Ship the login flow.\n---\n",
  ...featureFiles({
    id: "F-001",
    status: "in-progress",
    title: "Login",
    extra: { milestone: "M-01", priority: "P1" },
  }),
  ...featureFiles({
    id: "F-002",
    status: "approved",
    title: "Logout",
    extra: { milestone: "M-01" },
  }),
  ...featureFiles({ id: "F-003", status: "done", title: "Signup", extra: { milestone: "M-01" } }),
  ...featureFiles({
    id: "F-004",
    status: "deferred",
    title: "Export",
    ideaOnly: true,
    extra: { milestone: "M-01", priority: "P3" },
  }),
  ...featureFiles({
    id: "F-005",
    status: "cancelled",
    title: "Import",
    ideaOnly: true,
    extra: { milestone: "M-01" },
  }),
  ...featureFiles({
    id: "F-006",
    status: "in-progress",
    title: "Reset password",
    extra: { milestone: "M-01", priority: "P0" },
  }),
  ...featureFiles({ id: "F-007", status: "in-progress" }),
});

describe("the milestone page's data", () => {
  it("S-026.3.1 groups the milestone's features by status, then priority", () => {
    const tree = loadTree(pageFiles());
    cleanup = tree.cleanup;
    const { index } = buildIndex(tree.root);
    expect(milestonePage(index, "M-01")).toEqual({
      milestone: index.milestones[0],
      groups: [
        {
          status: "in-progress",
          counted: true,
          features: [
            { id: "F-006", priority: "P0", title: "Reset password" },
            { id: "F-001", priority: "P1", title: "Login" },
          ],
        },
        {
          status: "approved",
          counted: true,
          features: [{ id: "F-002", priority: "P2", title: "Logout" }],
        },
        {
          status: "deferred",
          counted: true,
          features: [{ id: "F-004", priority: "P3", title: "Export" }],
        },
        {
          status: "done",
          counted: true,
          features: [{ id: "F-003", priority: "P2", title: "Signup" }],
        },
        {
          status: "cancelled",
          counted: false,
          features: [{ id: "F-005", priority: "P2", title: "Import" }],
        },
      ],
      blocking: ["F-006", "F-001", "F-002", "F-004"],
      ready: false,
      started_while_planned: false,
    });
    expect(index.milestones[0]?.id).toBe("M-01");
    expect(milestonePage(index, "M-09")).toBeNull();
  });
});
