import { afterEach, describe, expect, it } from "vitest";
import { statusBrief } from "../../src/core/brief";
import { buildIndex } from "../../src/core/build-index";
import { derive, milestoneReady } from "../../src/core/derive";
import { nextWork } from "../../src/core/next";
import { validate } from "../../src/core/validate";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const milestone = (id: string, title: string, status: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n${extra}---\n`;

/** The project's W-MILESTONE-READY problems from validate, and its built index. */
function analyzed(files: Record<string, string>) {
  const tree = loadTree(files);
  cleanup = tree.cleanup;
  const facts = makeFacts();
  const problems = validate(tree.model, facts, derive(tree.model, facts));
  const { index } = buildIndex(tree.root);
  return { ready: problems.filter((p) => p.code === "W-MILESTONE-READY"), index };
}

const readiness = (index: ReturnType<typeof buildIndex>["index"]) =>
  index.milestones.map((m) => [m.id, milestoneReady(m)]);

describe("milestones ready for release", () => {
  it("S-023.5.1 warns about a planned and an active milestone whose features are all done", () => {
    const { ready } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "active"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-002", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-003", status: "done", extra: { milestone: "M-02" } }),
      ...featureFiles({
        id: "F-004",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-02" },
      }),
    });
    expect(ready).toEqual([
      {
        code: "W-MILESTONE-READY",
        severity: "warning",
        file: ".azimuth/milestones/M-01-first.md",
        line: null,
        ref: "M-01",
        message:
          "Every feature of M-01 is done but it is still planned; ask the user to release it.",
      },
      {
        code: "W-MILESTONE-READY",
        severity: "warning",
        file: ".azimuth/milestones/M-02-second.md",
        line: null,
        ref: "M-02",
        message:
          "Every feature of M-02 is done but it is still active; ask the user to release it.",
      },
    ]);
  });

  it("S-023.5.2 stays quiet while a feature is in progress or deferred", () => {
    const { ready, index } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "active"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-002", status: "in-progress", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-003", status: "done", extra: { milestone: "M-02" } }),
      ...featureFiles({
        id: "F-004",
        status: "deferred",
        ideaOnly: true,
        extra: { milestone: "M-02" },
      }),
    });
    expect(ready).toEqual([]);
    expect(readiness(index)).toEqual([
      ["M-01", false],
      ["M-02", false],
    ]);
  });

  it("S-023.5.3 never calls a released, empty or retired-only milestone ready", () => {
    const { ready, index } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone(
        "M-01",
        "First",
        "released",
        "released_at: 2026-10-01\n",
      ),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "planned"),
      ".azimuth/milestones/M-03-third.md": milestone("M-03", "Third", "planned"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-004",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-03" },
      }),
    });
    expect(ready).toEqual([]);
    expect(readiness(index)).toEqual([
      ["M-01", false],
      ["M-02", false],
      ["M-03", false],
    ]);
  });

  it("S-023.6.1 offers the release after critical issues and before feature work", () => {
    const { index } = analyzed({
      ".azimuth/issues/BUG-0001-crash.md":
        "---\nid: BUG-0001\ntype: bug\ntitle: Crash\nseverity: critical\ncreated: 2026-10-01\n---\n",
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-002",
        status: "in-progress",
        tasks: [{ id: "T-002.1", covers: ["S-002.1.1", "S-002.1.2"] }],
      }),
    });
    const items = nextWork(index);
    expect(items.map((i) => i.ref)).toEqual(["BUG-0001", "M-01", "T-002.1"]);
    expect(items[1]).toEqual({
      ref: "M-01",
      title: "First",
      action: "Ask the user to release M-01 in the viewer",
      reason: "Every feature is done; only the user releases a milestone",
    });
    expect(statusBrief(index).split("\n")).toContain(
      "  M-01 Ask the user to release M-01 in the viewer — Every feature is done; only the user releases a milestone",
    );
  });
});
