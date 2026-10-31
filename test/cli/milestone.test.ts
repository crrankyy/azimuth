import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const milestone = (id: string, title: string, status: string) =>
  `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n---\n`;

function project(files: Record<string, string>): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    ...files,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

/** M-01 (planned) whose two features are both done. */
const readyProject = () =>
  project({
    ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
    ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
    ...featureFiles({ id: "F-002", status: "done", extra: { milestone: "M-01" } }),
  });

describe("milestones ready for release on the command line", () => {
  it("S-023.5.4 check on the milestone prints its release warning", async () => {
    const r = await runCli(readyProject(), ["check", "M-01"]);
    expect(r.out).toBe(
      "W-MILESTONE-READY .azimuth/milestones/M-01-first.md M-01\n  Every feature of M-01 is done but it is still planned; ask the user to release it.\n\n0 errors, 1 warnings\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-023.6.2 next prints the release item, as text and as JSON", async () => {
    const root = readyProject();
    const r = await runCli(root, ["next"]);
    expect(r.out).toBe(
      "M-01 Ask the user to release M-01 in the viewer\n  Every feature is done; only the user releases a milestone\n",
    );
    expect(r.code).toBe(0);
    const json = await runCli(root, ["next", "--json"]);
    expect(JSON.parse(json.out)).toEqual([
      {
        ref: "M-01",
        title: "First",
        action: "Ask the user to release M-01 in the viewer",
        reason: "Every feature is done; only the user releases a milestone",
      },
    ]);
  });

  it("S-023.6.3 next offers no release for an unfinished milestone nor for one feature", async () => {
    const unfinished = project({
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
    const all = await runCli(unfinished, ["next", "--json"]);
    const items = JSON.parse(all.out) as { ref: string }[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.filter((i) => i.ref.startsWith("M-"))).toEqual([]);
    expect(all.code).toBe(0);
    cleanup?.();

    const one = await runCli(readyProject(), ["next", "F-001"]);
    expect(one.out).toBe("Nothing to do: no unblocked work.\n");
    expect(one.code).toBe(0);
  });
});

describe("planned milestones with started work on the command line", () => {
  it("S-026.2.4 check on the milestone prints its planned warning", async () => {
    const root = project({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "in-progress", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-002",
        status: "idea",
        ideaOnly: true,
        extra: { milestone: "M-01" },
      }),
    });
    const r = await runCli(root, ["check", "M-01"]);
    expect(r.out).toBe(
      "W-MILESTONE-PLANNED .azimuth/milestones/M-01-first.md M-01\n  M-01 is still planned with work started on 1 of its 2 features; move it to active (`azimuth move M-01 active`).\n\n0 errors, 1 warnings\n",
    );
    expect(r.code).toBe(0);
  });
});
