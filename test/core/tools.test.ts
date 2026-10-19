import { describe, expect, it } from "vitest";
import { editSize, lineCount, patchLines, toolTarget } from "../../src/core/tools";

describe("F-014 edit sizes", () => {
  it("S-014.3.1 lets the structured patch decide an edit's size", () => {
    const response = {
      structuredPatch: [
        { oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [" a", "-b", "+c", "+d"] },
        { oldStart: 9, oldLines: 2, newStart: 10, newLines: 1, lines: ["-e", " f"] },
      ],
    };
    expect(editSize("Edit", { old_string: "x", new_string: "y" }, response)).toEqual({
      added: 2,
      removed: 2,
    });
  });

  it("S-014.3.2 counts a created file's content", () => {
    const input = { file_path: "a.ts", content: "x\ny\nz\n" };
    expect(editSize("Write", input, { type: "create", structuredPatch: [] })).toEqual({
      added: 3,
      removed: 0,
    });
  });

  it("S-014.3.3 counts the input without a response", () => {
    const input = {
      edits: [
        { old_string: "a", new_string: "b\nc" },
        { old_string: "d\ne", new_string: "" },
      ],
    };
    expect(editSize("MultiEdit", input, undefined)).toEqual({ added: 2, removed: 3 });
  });

  it("S-014.3.4 gives no size for tools that don't edit text", () => {
    expect(editSize("NotebookEdit", { notebook_path: "n.ipynb", new_source: "x" }, undefined)).toBe(
      null,
    );
    expect(editSize("Read", { file_path: "a.ts" }, undefined)).toBeNull();
  });

  it("counts lines without a final newline's extra line", () => {
    expect([lineCount(""), lineCount("a"), lineCount("a\n"), lineCount("a\nb")]).toEqual([
      0, 1, 1, 2,
    ]);
  });

  it("turns a patch into diff lines with hunk headers", () => {
    const hunk = { oldStart: 1, oldLines: 3, newStart: 1, newLines: 4 };
    expect(patchLines([{ ...hunk, lines: [" a", "-b", "+c", "+d", " e"] }])).toEqual({
      lines: ["@@ -1,3 +1,4 @@", " a", "-b", "+c", "+d", " e"],
      added: 2,
      removed: 1,
    });
    expect(patchLines([])).toBeNull();
    expect(patchLines([{ lines: "-b" }])).toBeNull();
    expect(patchLines("@@")).toBeNull();
  });
});

describe("F-014 tool targets", () => {
  it("S-014.3.5 names what each call acts on", () => {
    const root = "/home/dev/work/tally";
    const places = { home: "/home/dev" };
    const target = (tool: string, input: Record<string, unknown>) =>
      toolTarget(root, tool, input, places);
    expect(target("Bash", { command: "cat /home/dev/work/tally/src/a.ts\nls" })).toBe(
      "cat src/a.ts",
    );
    expect(target("Edit", { file_path: "/home/dev/notes.md" })).toBe("~/notes.md");
    expect(target("WebFetch", { url: "https://prometheus.io/docs/" })).toBe("prometheus.io");
    expect(target("Agent", { description: "Find callers" })).toBe("Find callers");
    expect(target("Skill", { skill: "x" })).toBe("");
  });

  it("prefers Grep's pattern over its path, and clips long targets", () => {
    const places = { home: "/home/dev" };
    expect(toolTarget("/w", "Grep", { pattern: "decide\\(", path: "/w/src" }, places)).toBe(
      "decide\\(",
    );
    expect(toolTarget("/w", "WebSearch", { query: "q".repeat(200) }, places)).toHaveLength(120);
  });
});
