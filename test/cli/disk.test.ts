import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProject } from "../../src/core/model";
import { runCli } from "../helpers/cli";
import { commitAll, gitEnv, initRepo } from "../helpers/git";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

// The commands read the real disk, whose free space no test controls: give them a fixed source.
const disk = vi.hoisted(() => ({ free: 0 }));
vi.mock("../../src/core/disk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/disk")>();
  return { ...actual, diskSpace: (root: string) => actual.diskSpace(root, () => disk.free) };
});

const LOW =
  "Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10). Builds fail when the disk fills up.\n";

const T1: TaskSpec = {
  id: "T-001.1",
  status: "in-progress",
  covers: ["S-001.1.1", "S-001.1.2"],
  files: ["src/a.ts"],
  verify: "echo S-001.1.1 ok",
};

let cleanup: (() => void) | null = null;

beforeEach(() => {
  // task finish runs git with the process environment: keep the developer's hooks and signing out.
  for (const [key, value] of Object.entries(gitEnv())) {
    if (key.startsWith("GIT_") && value !== undefined) vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup?.();
  cleanup = null;
});

/** A project whose F-001 is in progress with T-001.1, config.yaml ending with `config`. */
function project(config = ""): string {
  const tree = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}${config}`,
    ".gitignore": ".azimuth/cache/\n",
    "src/a.ts": "export const a = 0;\n",
    ...featureFiles({ id: "F-001", status: "in-progress", tasks: [T1] }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const lastLine = (out: string) =>
  (out.replace(/\n$/, "").split("\n").at(-1) ?? "").replace(/ in \d+\.\ds\b/, " in <n>s");

describe("ST-018.7 the disk warning on the command line", () => {
  it("S-018.7.5 verify warns on stderr and runs anyway", async () => {
    disk.free = 4_200_000_000;
    const r = await runCli(project(), ["verify", "T-001.1"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe(LOW);
    expect(lastLine(r.out)).toBe("R-0001 T-001.1 passed in <n>s");
  });

  it("S-018.7.6 task finish warns on stderr and finishes anyway", async () => {
    disk.free = 4_200_000_000;
    const root = project();
    initRepo(root);
    commitAll(root, "chore: start");
    writeFileSync(join(root, "src/a.ts"), "export const a = 1;\n");
    const r = await runCli(root, ["task", "finish", "T-001.1", "--commit", "feat(F-001): add a"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe(LOW);
    const task = loadProject(root)
      .features.find((f) => f.id === "F-001")
      ?.tasks.find((t) => t.id === "T-001.1");
    expect(task?.status).toBe("done");
  });

  it("S-018.7.7 verify prints no warning with min_free_gb 0", async () => {
    disk.free = 1;
    const r = await runCli(project("verify:\n  min_free_gb: 0\n"), ["verify", "T-001.1"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
  });
});
