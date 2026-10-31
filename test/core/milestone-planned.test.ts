import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { derive } from "../../src/core/derive";
import { milestoneStartedWhilePlanned, startedCount } from "../../src/core/flows";
import { validate } from "../../src/core/validate";
import { featureFiles, loadTree, makeFacts } from "../helpers/project";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const milestone = (id: string, title: string, status: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n${extra}---\n`;

/** The project's W-MILESTONE* problems from validate, and its built index. */
function analyzed(files: Record<string, string>) {
  const tree = loadTree(files);
  cleanup = tree.cleanup;
  const facts = makeFacts();
  const problems = validate(tree.model, facts, derive(tree.model, facts));
  const { index } = buildIndex(tree.root);
  return {
    planned: problems.filter((p) => p.code === "W-MILESTONE-PLANNED"),
    milestone: problems.filter((p) => p.code.startsWith("W-MILESTONE")),
    index,
  };
}

type Index = ReturnType<typeof buildIndex>["index"];

const startedWhilePlanned = (index: Index) =>
  index.milestones.map((m) => [m.id, milestoneStartedWhilePlanned(m)]);

describe("planned milestones with started work", () => {
  it("S-026.2.1 warns about each planned milestone whose work has started", () => {
    const { planned, index } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "planned"),
      ...featureFiles({ id: "F-001", status: "in-progress", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-002",
        status: "idea",
        ideaOnly: true,
        extra: { milestone: "M-01" },
      }),
      ...featureFiles({ id: "F-003", status: "verifying", extra: { milestone: "M-02" } }),
      ...featureFiles({ id: "F-004", status: "done", extra: { milestone: "M-02" } }),
      ...featureFiles({
        id: "F-005",
        status: "deferred",
        ideaOnly: true,
        extra: { milestone: "M-02" },
      }),
      ...featureFiles({
        id: "F-006",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-02" },
      }),
    });
    expect(planned).toEqual([
      {
        code: "W-MILESTONE-PLANNED",
        severity: "warning",
        file: ".azimuth/milestones/M-01-first.md",
        line: null,
        ref: "M-01",
        message:
          "M-01 is still planned with work started on 1 of its 2 features; move it to active (`azimuth move M-01 active`).",
      },
      {
        code: "W-MILESTONE-PLANNED",
        severity: "warning",
        file: ".azimuth/milestones/M-02-second.md",
        line: null,
        ref: "M-02",
        message:
          "M-02 is still planned with work started on 2 of its 3 features; move it to active (`azimuth move M-02 active`).",
      },
    ]);
    expect(index.milestones.map((m) => [m.id, startedCount(m)])).toEqual([
      ["M-01", 1],
      ["M-02", 2],
    ]);
    expect(startedWhilePlanned(index)).toEqual([
      ["M-01", true],
      ["M-02", true],
    ]);
  });

  it("S-026.2.2 stays quiet without started work or when the milestone isn't planned", () => {
    const { planned, index } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "active"),
      ".azimuth/milestones/M-03-third.md": milestone(
        "M-03",
        "Third",
        "released",
        "released_at: 2026-10-01\n",
      ),
      ...featureFiles({ id: "F-001", status: "approved", extra: { milestone: "M-01" } }),
      ...featureFiles({ id: "F-002", status: "draft", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-003",
        status: "deferred",
        ideaOnly: true,
        extra: { milestone: "M-01" },
      }),
      ...featureFiles({ id: "F-004", status: "in-progress", extra: { milestone: "M-02" } }),
      ...featureFiles({ id: "F-005", status: "in-progress", extra: { milestone: "M-03" } }),
    });
    expect(planned).toEqual([]);
    expect(startedWhilePlanned(index)).toEqual([
      ["M-01", false],
      ["M-02", false],
      ["M-03", false],
    ]);
  });

  it("S-026.2.3 gives a finished planned milestone only the ready warning", () => {
    const { milestone: problems, index } = analyzed({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "planned"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-002",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-01" },
      }),
      ...featureFiles({
        id: "F-003",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-02" },
      }),
    });
    expect(problems).toEqual([
      {
        code: "W-MILESTONE-READY",
        severity: "warning",
        file: ".azimuth/milestones/M-01-first.md",
        line: null,
        ref: "M-01",
        message:
          "Every feature of M-01 is done but it is still planned; ask the user to release it.",
      },
    ]);
    expect(startedWhilePlanned(index)).toEqual([
      ["M-01", false],
      ["M-02", false],
    ]);
  });
});
