import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject, buildIndex } from "../../src/core/build-index";
import { AzimuthError } from "../../src/core/errors";
import { loadProject } from "../../src/core/model";
import { addNote } from "../../src/core/notes";
import { specHash } from "../../src/core/spec-hash";
import { featureFiles } from "../helpers/project";
import { commitAll, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const DIR = ".azimuth/features/F-001-thing";
const NOTES = "# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nCounts the BOM.\n";
const NOW = new Date("2026-10-20T12:00:00Z");

function project(files: Record<string, string> = {}) {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    ...files,
  });
  cleanup = tree.cleanup;
  return tree;
}

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

const notesPath = (root: string) => join(root, DIR, "notes.md");

describe("ST-008.1 notes record what a task taught", () => {
  it("S-008.1.1 creates notes.md with the first note", () => {
    const { root } = project();
    const result = addNote(root, "T-001.1", "Counts the BOM.", {
      actor: "agent",
      now: new Date("2026-10-20T09:00:00Z"),
    });
    expect(readFileSync(notesPath(root), "utf8")).toBe(NOTES);
    expect(result.changed).toEqual([`${DIR}/notes.md`]);
    expect(result.message).toBe("T-001.1: note added");
  });

  it("S-008.1.2 appends a later note as its own section", () => {
    const { root } = project({ [`${DIR}/notes.md`]: NOTES });
    addNote(root, "F-001", "  Split the parser in two.\n", {
      actor: "you",
      now: new Date("2026-10-21T08:00:00Z"),
    });
    expect(readFileSync(notesPath(root), "utf8")).toBe(
      "# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nCounts the BOM.\n\n### F-001 · 2026-10-21\n\nSplit the parser in two.\n",
    );
  });

  it("S-008.1.3 refuses a task that isn't in the plan", () => {
    const { root } = project();
    const error = errorOf(() => addNote(root, "T-001.9", "Counts the BOM.", { actor: "agent" }));
    expect(error.code).toBe("not-found");
    expect(error.message).toBe("T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.");
    expect(existsSync(notesPath(root))).toBe(false);
  });

  it("S-008.1.4 refuses a feature that doesn't exist", () => {
    const { root } = project();
    const error = errorOf(() => addNote(root, "F-009", "Counts the BOM.", { actor: "agent" }));
    expect(error.code).toBe("not-found");
    expect(error.message).toBe("F-009 does not exist.");
  });

  it("S-008.1.5 refuses a scenario ID and a blank note", () => {
    const { root } = project();
    const scenario = errorOf(() =>
      addNote(root, "S-001.1.1", "Counts the BOM.", { actor: "agent" }),
    );
    expect([scenario.code, scenario.message]).toEqual([
      "invalid",
      "S-001.1.1 is not a feature or task.",
    ]);
    const blank = errorOf(() => addNote(root, "T-001.1", "  ", { actor: "agent" }));
    expect([blank.code, blank.message]).toEqual(["invalid", "A note needs some text."]);
    expect(existsSync(notesPath(root))).toBe(false);
  });
});

const detailOf = (root: string, id: string) =>
  buildIndex(root, { now: NOW }).index.features.find((f) => f.id === id)?.detail;

describe("ST-008.3 notes stay outside the spec and inside the index", () => {
  it("S-008.3.1 carries notes in the index without their title", () => {
    const { root } = project({ [`${DIR}/notes.md`]: NOTES });
    expect(detailOf(root, "F-001")?.notes).toBe("### T-001.1 · 2026-10-20\n\nCounts the BOM.");
  });

  it("S-008.3.2 is null without notes.md or without anything under the title", () => {
    const { root } = project({
      ...featureFiles({ id: "F-002", status: "in-progress" }),
      ".azimuth/features/F-002-thing/notes.md": "# F-002: Notes\n",
    });
    expect(detailOf(root, "F-001")?.notes).toBeNull();
    expect(detailOf(root, "F-002")?.notes).toBeNull();
  });

  it("S-008.3.3 raises no problem for notes.md", () => {
    const tree = project();
    const without = analyzeProject(tree.root, NOW).problems;
    tree.write(`${DIR}/notes.md`, NOTES);
    expect(analyzeProject(tree.root, NOW).problems).toEqual(without);
  });

  it("S-008.3.4 never makes the approval stale", () => {
    const tree = project();
    const spec = loadProject(tree.root).features[0]?.spec;
    if (!spec) throw new Error("F-001 has no spec");
    const approved = featureFiles({
      id: "F-001",
      status: "in-progress",
      extra: { approved_by: "agent", approved_at: "2026-10-19", approved_hash: specHash(spec) },
    });
    tree.write(`${DIR}/feature.md`, approved[`${DIR}/feature.md`] as string);
    initRepo(tree.root);
    commitAll(tree.root, "docs(F-001): approve the spec", "2026-10-19T10:00:00Z");
    tree.write(`${DIR}/notes.md`, NOTES);
    const { index } = buildIndex(tree.root, { now: NOW });
    const f001 = index.features.find((f) => f.id === "F-001");
    expect(f001?.derived.modified_since_approval).toBe(false);
    expect(f001?.derived.approval_changes).toEqual([]);
    expect(index.inbox.filter((i) => i.kind === "reapprove-spec")).toEqual([]);
  });
});
