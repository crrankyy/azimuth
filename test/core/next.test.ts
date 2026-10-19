import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { parallelGroups, taskGroups } from "../../src/core/next";
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
