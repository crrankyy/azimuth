import { afterEach, describe, expect, it } from "vitest";
import type { NextItem, TaskGroup } from "../../src/core/next";
import type { Index } from "../../src/core/types";
import { runCli } from "../helpers/cli";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

function project(config: string, files: Record<string, string> = {}): string {
  const tree = writeTree({ ".azimuth/config.yaml": config, ...files });
  cleanup = tree.cleanup;
  return tree.root;
}

const SHARED_CONFIG = `${MINIMAL_CONFIG}parallel:\n  shared_files: [src/registry.ts]\n`;

describe("project.shared_files in the index", () => {
  it("S-010.1.4 carries the configured globs", async () => {
    const r = await runCli(project(SHARED_CONFIG), ["status", "--json"]);
    expect((JSON.parse(r.out) as Index).project.shared_files).toEqual(["src/registry.ts"]);
    expect(r.code).toBe(0);
  });

  it("S-010.1.5 carries an empty list by default", async () => {
    const r = await runCli(project(MINIMAL_CONFIG), ["status", "--json"]);
    expect((JSON.parse(r.out) as Index).project.shared_files).toEqual([]);
  });
});

/** F-001 in progress with `tasks`, under `config`. */
function inProgress(tasks: TaskSpec[], config = SHARED_CONFIG): string {
  return project(config, featureFiles({ id: "F-001", status: "in-progress", tasks }));
}

/** Three todo tasks: T-001.2 and T-001.3 share only src/registry.ts, T-001.4 shares src/a.ts. */
const REGISTRY_TASKS: TaskSpec[] = [
  { id: "T-001.2", files: ["src/a.ts", "src/registry.ts"] },
  { id: "T-001.3", files: ["src/b.ts", "src/registry.ts"] },
  { id: "T-001.4", files: ["src/a.ts"] },
];

const lastLines = (out: string, n: number) => out.trimEnd().split("\n").slice(-n);

describe("next F-NNN says which ready tasks can run together", () => {
  it("S-010.4.1 prints the group lines after the ready tasks", async () => {
    const r = await runCli(inProgress(REGISTRY_TASKS), ["next", "F-001"]);
    expect(lastLines(r.out, 2)).toEqual([
      "Can run together: T-001.2, T-001.3 (shared: src/registry.ts)",
      "On its own: T-001.4",
    ]);
    expect(r.code).toBe(0);
  });

  it("S-010.4.2 carries the groups in --json", async () => {
    const r = await runCli(inProgress(REGISTRY_TASKS), ["next", "F-001", "--json"]);
    const parsed = JSON.parse(r.out) as { items: NextItem[]; groups: TaskGroup[] };
    expect(parsed.items.map((i) => i.ref)).toEqual(["T-001.2", "T-001.3", "T-001.4"]);
    expect(parsed.groups).toEqual([
      { tasks: ["T-001.2", "T-001.3"], shared: ["src/registry.ts"] },
      { tasks: ["T-001.4"], shared: [] },
    ]);
  });

  it("S-010.4.3 names no shared files for a group without them", async () => {
    const root = inProgress([
      { id: "T-001.2", files: ["src/a.ts"] },
      { id: "T-001.3", files: ["src/b.ts"] },
    ]);
    const r = await runCli(root, ["next", "F-001"]);
    expect(lastLines(r.out, 1)).toEqual(["Can run together: T-001.2, T-001.3"]);
  });

  it("S-010.4.4 prints no group line for a single ready task", async () => {
    const root = inProgress(
      [
        { id: "T-001.1", status: "done" },
        { id: "T-001.2", after: ["T-001.1"], files: ["src/a.ts"] },
      ],
      MINIMAL_CONFIG,
    );
    const r = await runCli(root, ["next", "F-001"]);
    expect(r.out).toBe("T-001.2 azimuth move T-001.2 in-progress\n  F-001\n");
    expect(r.code).toBe(0);
  });

  it("S-010.4.5 keeps the JSON array of next without an ID", async () => {
    const r = await runCli(inProgress(REGISTRY_TASKS), ["next", "--json"]);
    const parsed = JSON.parse(r.out) as NextItem[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.map((i) => i.ref)).toEqual(["T-001.2", "T-001.3", "T-001.4"]);
  });
});

/** F-001 and F-002 in progress with their tasks, under `config`. */
function twoFeatures(f1: TaskSpec[], f2: TaskSpec[], config = MINIMAL_CONFIG): string {
  return project(config, {
    ...featureFiles({ id: "F-001", status: "in-progress", tasks: f1 }),
    ...featureFiles({ id: "F-002", status: "in-progress", tasks: f2 }),
  });
}

/** S-024.4.1's project: T-002.2 lists the file T-001.1 lists. */
const ACROSS_TASKS: [TaskSpec[], TaskSpec[]] = [
  [{ id: "T-001.1", files: ["src/a.ts"] }],
  [
    { id: "T-002.1", files: ["src/b.ts"] },
    { id: "T-002.2", files: ["src/a.ts"] },
  ],
];

describe("next without an ID groups ready tasks across features", () => {
  it("S-024.4.1 follows the items with the groups of both features", async () => {
    const r = await runCli(twoFeatures(...ACROSS_TASKS), ["next"]);
    expect(r.out).toBe(
      "T-001.1 azimuth move T-001.1 in-progress\n  F-001\n" +
        "T-002.1 azimuth move T-002.1 in-progress\n  F-002\n" +
        "T-002.2 azimuth move T-002.2 in-progress\n  F-002\n" +
        "Across F-001, F-002:\n" +
        "Can run together: T-001.1, T-002.1\n" +
        "On its own: T-002.2\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-024.4.2 prints no cross-feature lines when one feature has ready tasks", async () => {
    const root = twoFeatures(
      [
        { id: "T-001.2", files: ["src/a.ts"] },
        { id: "T-001.3", files: ["src/b.ts"] },
      ],
      [{ id: "T-002.1", status: "blocked", note: "Waiting on the user" }],
    );
    const r = await runCli(root, ["next"]);
    expect(r.out).toBe(
      "T-001.2 azimuth move T-001.2 in-progress\n  F-001\n" +
        "T-001.3 azimuth move T-001.3 in-progress\n  F-001\n" +
        "F-002 Unblock a task\n  Blocked tasks: T-002.1\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-024.4.3 runs tasks sharing only a shared file together across features", async () => {
    const root = twoFeatures(
      [{ id: "T-001.2", files: ["src/a.ts", "src/registry.ts"] }],
      [{ id: "T-002.1", files: ["src/b.ts", "src/registry.ts"] }],
      SHARED_CONFIG,
    );
    const r = await runCli(root, ["next"]);
    expect(lastLines(r.out, 2)).toEqual([
      "Across F-001, F-002:",
      "Can run together: T-001.2, T-002.1 (shared: src/registry.ts)",
    ]);
  });

  it("S-024.4.4 prints at most six group lines and counts the rest", async () => {
    const task = (id: string): TaskSpec => ({ id, files: ["src/a.ts"] });
    const root = twoFeatures(
      ["T-001.1", "T-001.2", "T-001.3", "T-001.4"].map(task),
      ["T-002.1", "T-002.2", "T-002.3"].map(task),
    );
    const r = await runCli(root, ["next"]);
    expect(lastLines(r.out, 8)).toEqual([
      "Across F-001, F-002:",
      "On its own: T-001.1",
      "On its own: T-001.2",
      "On its own: T-001.3",
      "On its own: T-001.4",
      "On its own: T-002.1",
      "On its own: T-002.2",
      "… and 1 more",
    ]);
  });

  it("S-024.4.5 keeps next --json the array of items across features", async () => {
    const r = await runCli(twoFeatures(...ACROSS_TASKS), ["next", "--json"]);
    const parsed = JSON.parse(r.out) as NextItem[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.map((i) => i.ref)).toEqual(["T-001.1", "T-002.1", "T-002.2"]);
  });

  it("S-024.4.6 prints only the feature's own groups for next F-NNN", async () => {
    const r = await runCli(twoFeatures(...ACROSS_TASKS), ["next", "F-002"]);
    expect(r.out).toBe(
      "T-002.1 azimuth move T-002.1 in-progress\n  F-002\n" +
        "T-002.2 azimuth move T-002.2 in-progress\n  F-002\n" +
        "Can run together: T-002.1, T-002.2\n",
    );
  });
});
