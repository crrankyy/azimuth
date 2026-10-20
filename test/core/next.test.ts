import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { createQuestion } from "../../src/core/create";
import { crossFeatureGroups, parallelGroups, taskGroups } from "../../src/core/next";
import type { Feature, Task } from "../../src/core/types";
import { featureFiles, type FeatureSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const task = (id: string, files: string[]): Task => ({
  id,
  title: `Task ${id}`,
  status: "todo",
  after: [],
  covers: [],
  files,
  verify: "pnpm test",
  note: null,
  last_run: null,
});

/** F-001 written as a project and read back from the built index. */
function builtFeature(spec: FeatureSpec) {
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...featureFiles(spec) });
  cleanup = tree.cleanup;
  const { index } = buildIndex(tree.root);
  return { index, f: index.features.find((x) => x.id === "F-001") as Feature };
}

/** The features written as one project, removed after the test. */
function project(specs: FeatureSpec[]): string {
  const files = Object.assign({}, ...specs.map(featureFiles)) as Record<string, string>;
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("parallelGroups", () => {
  it("S-010.3.1 puts tasks that share only a shared file in one group", () => {
    const tasks = [
      task("T-001.2", ["src/a.ts", "src/registry.ts"]),
      task("T-001.3", ["src/b.ts", "src/registry.ts"]),
    ];
    expect(parallelGroups(tasks, ["src/registry.ts"])).toEqual([
      { tasks: ["T-001.2", "T-001.3"], shared: ["src/registry.ts"] },
    ]);
  });

  it("S-010.3.2 keeps two tasks apart over a common file outside the list", () => {
    const tasks = [
      task("T-001.2", ["src/a.ts", "src/registry.ts"]),
      task("T-001.3", ["src/a.ts"]),
      task("T-001.4", ["src/c.ts", "src/registry.ts"]),
    ];
    expect(parallelGroups(tasks, ["src/registry.ts"])).toEqual([
      { tasks: ["T-001.2", "T-001.4"], shared: ["src/registry.ts"] },
      { tasks: ["T-001.3"], shared: [] },
    ]);
  });

  it("S-010.3.3 gives a task without files a group of its own", () => {
    const tasks = [
      task("T-001.2", ["src/a.ts"]),
      task("T-001.3", []),
      task("T-001.4", ["src/b.ts"]),
    ];
    expect(parallelGroups(tasks, [])).toEqual([
      { tasks: ["T-001.2", "T-001.4"], shared: [] },
      { tasks: ["T-001.3"], shared: [] },
    ]);
  });

  it("S-010.3.4 names only the shared files two of its tasks list, sorted", () => {
    const tasks = [
      task("T-001.2", ["src/registry.ts", "keymaps/default.toml", "src/a.ts"]),
      task("T-001.3", ["keymaps/default.toml", "src/registry.ts", "src/action.ts", "src/b.ts"]),
    ];
    expect(parallelGroups(tasks, ["src/registry.ts", "src/action.ts", "keymaps/*.toml"])).toEqual([
      { tasks: ["T-001.2", "T-001.3"], shared: ["keymaps/default.toml", "src/registry.ts"] },
    ]);
  });
});

describe("taskGroups", () => {
  it("S-010.3.5 leads with the tasks already in progress", () => {
    const { index, f } = builtFeature({
      id: "F-001",
      status: "in-progress",
      tasks: [
        { id: "T-001.1", status: "done" },
        { id: "T-001.2", after: ["T-001.1"], files: ["src/a.ts"] },
        { id: "T-001.3", status: "in-progress", files: ["src/a.ts"] },
        { id: "T-001.4", files: ["src/b.ts"] },
        { id: "T-001.5", after: ["T-001.4"], files: ["src/c.ts"] },
      ],
    });
    expect(taskGroups(index, f)).toEqual([
      { tasks: ["T-001.3", "T-001.4"], shared: [] },
      { tasks: ["T-001.2"], shared: [] },
    ]);
  });

  it("S-010.3.6 gives a feature that isn't in progress no groups", () => {
    const { index, f } = builtFeature({
      id: "F-001",
      status: "approved",
      tasks: [
        { id: "T-001.1", files: ["src/a.ts"] },
        { id: "T-001.2", files: ["src/b.ts"] },
      ],
    });
    expect(taskGroups(index, f)).toEqual([]);
  });
});

describe("crossFeatureGroups", () => {
  it("S-024.3.1 groups two features' ready tasks, the higher priority's first", () => {
    const root = project([
      {
        id: "F-001",
        status: "in-progress",
        extra: { priority: "P2" },
        tasks: [
          { id: "T-001.2", files: ["src/a.ts"] },
          { id: "T-001.3", status: "in-progress", files: ["src/c.ts"] },
        ],
      },
      {
        id: "F-002",
        status: "in-progress",
        extra: { priority: "P0" },
        tasks: [{ id: "T-002.1", files: ["src/a.ts"] }],
      },
    ]);
    expect(crossFeatureGroups(buildIndex(root).index)).toEqual({
      features: ["F-002", "F-001"],
      groups: [
        { tasks: ["T-002.1", "T-001.3"], shared: [] },
        { tasks: ["T-001.2"], shared: [] },
      ],
    });
  });

  it("S-024.3.2 gives no cross-feature groups when only one feature has ready tasks", () => {
    const root = project([
      {
        id: "F-001",
        status: "in-progress",
        tasks: [
          { id: "T-001.2", files: ["src/a.ts"] },
          { id: "T-001.3", files: ["src/b.ts"] },
        ],
      },
      {
        id: "F-002",
        status: "in-progress",
        tasks: [{ id: "T-002.1", status: "blocked", note: "Waiting on the user" }],
      },
      { id: "F-003", status: "approved", tasks: [{ id: "T-003.1", files: ["src/c.ts"] }] },
    ]);
    expect(crossFeatureGroups(buildIndex(root).index)).toBeNull();
  });

  it("S-024.3.3 leaves out a feature an open blocking question holds", () => {
    const root = project([
      { id: "F-001", status: "in-progress", tasks: [{ id: "T-001.1", files: ["src/a.ts"] }] },
      { id: "F-002", status: "in-progress", tasks: [{ id: "T-002.1", files: ["src/b.ts"] }] },
      { id: "F-003", status: "in-progress", tasks: [{ id: "T-003.1", files: ["src/c.ts"] }] },
    ]);
    createQuestion(
      root,
      { title: "Which?", feature: "F-002", blocking: true },
      { actor: "agent", session: null },
    );
    const { index } = buildIndex(root);
    expect(index.features.find((f) => f.id === "F-002")?.derived.blocked_by).toEqual([
      { kind: "question", id: "Q-0001" },
    ]);
    expect(crossFeatureGroups(index)).toEqual({
      features: ["F-001", "F-003"],
      groups: [{ tasks: ["T-001.1", "T-003.1"], shared: [] }],
    });
  });
});
