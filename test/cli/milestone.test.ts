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

/** The page project of F-026's stories: M-01 active with six features, and F-007 outside it. */
const pageProject = () =>
  project({
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

describe("the milestone page in show", () => {
  it("S-026.3.2 show prints the milestone's page", async () => {
    const r = await runCli(pageProject(), ["show", "M-01"]);
    expect(r.out).toBe(
      "M-01 First\nStatus: active, target 2026-11-15\nGoal: Ship the login flow.\nProgress: 1/5 done\n\nin-progress (2)\n  F-006 P0 Reset password\n  F-001 P1 Login\napproved (1)\n  F-002 P2 Logout\ndeferred (1)\n  F-004 P3 Export\ndone (1)\n  F-003 P2 Signup\ncancelled (1, not counted)\n  F-005 P2 Import\n\nKeeping it from being ready: F-006, F-001, F-002, F-004\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-026.3.3 the page of a ready milestone says it is ready", async () => {
    const root = project({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
      ...featureFiles({
        id: "F-002",
        status: "cancelled",
        ideaOnly: true,
        extra: { milestone: "M-01" },
      }),
    });
    const r = await runCli(root, ["show", "M-01"]);
    expect(r.out).toBe(
      "M-01 First\nStatus: planned\nProgress: 1/1 done\n\ndone (1)\n  F-001 P2 Feature F-001\ncancelled (1, not counted)\n  F-002 P2 Feature F-002\n\nReady: every feature is done; ask the user to release M-01.\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-026.3.4 the page of a planned milestone with started work gives the move", async () => {
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
    const r = await runCli(root, ["show", "M-01"]);
    expect(r.out).toBe(
      "M-01 First\nStatus: planned\nProgress: 0/2 done\n\nin-progress (1)\n  F-001 P2 Feature F-001\nidea (1)\n  F-002 P2 Feature F-002\n\nKeeping it from being ready: F-001, F-002\nWork has started on its features but it is still planned: azimuth move M-01 active\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-026.3.5 the page of a released milestone shows its dates and no readiness", async () => {
    const root = project({
      ".azimuth/milestones/M-01-first.md":
        "---\nid: M-01\ntitle: First\nstatus: released\ntarget: 2026-10-20\nreleased_at: 2026-10-21\n---\n",
      ...featureFiles({ id: "F-001", status: "done", extra: { milestone: "M-01" } }),
    });
    const r = await runCli(root, ["show", "M-01"]);
    expect(r.out).toBe(
      "M-01 First\nStatus: released 2026-10-21, target 2026-10-20\nProgress: 1/1 done\n\ndone (1)\n  F-001 P2 Feature F-001\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-026.3.6 the page of a milestone without features says none count yet", async () => {
    const root = project({
      ".azimuth/milestones/M-01-first.md": milestone("M-01", "First", "planned"),
      ".azimuth/milestones/M-02-second.md": milestone("M-02", "Second", "planned"),
      ...featureFiles({ id: "F-001", status: "in-progress", extra: { milestone: "M-01" } }),
    });
    const r = await runCli(root, ["show", "M-02"]);
    expect(r.out).toBe(
      "M-02 Second\nStatus: planned\nProgress: 0/0 done\n\nNo features count toward it yet.\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-026.4.1 show --brief of a milestone stays one line", async () => {
    const r = await runCli(pageProject(), ["show", "M-01", "--brief"]);
    expect(r.out).toBe("M-01 active First: 1/5 done, target 2026-11-15\n");
    expect(r.code).toBe(0);
  });

  it("S-026.4.2 show --json of a milestone stays the index entity", async () => {
    const r = await runCli(pageProject(), ["show", "M-01", "--json"]);
    expect(JSON.parse(r.out)).toEqual({
      id: "M-01",
      title: "First",
      status: "active",
      target: "2026-11-15",
      released_at: null,
      goal: "Ship the login flow.",
      features: ["F-001", "F-002", "F-003", "F-004", "F-005", "F-006"],
      progress: {
        done: 1,
        total: 5,
        by_status: { "in-progress": 2, approved: 1, done: 1, deferred: 1 },
      },
      file: ".azimuth/milestones/M-01-first.md",
    });
    expect(r.code).toBe(0);
  });

  it("S-026.4.3 show refuses an unknown milestone", async () => {
    const r = await runCli(pageProject(), ["show", "M-09"]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("");
    expect(r.err.split("\n")[0]).toBe("M-09 not found.");
  });
});
