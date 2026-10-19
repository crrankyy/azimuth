import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** F-001: two happy-only stories, one uncovered scenario, and tasks in a cycle unless not. */
function project({ cycle = true } = {}): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    ...featureFiles({
      id: "F-001",
      status: "draft",
      stories: { "ST-001.1": ["happy"], "ST-001.2": ["happy"] },
      tasks: [
        { id: "T-001.1", covers: ["S-001.1.1"], after: ["T-001.2"] },
        { id: "T-001.2", after: cycle ? ["T-001.1"] : [] },
      ],
    }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const lines = (text: string) => text.split("\n");

describe("check lists errors and counts warnings", () => {
  it("S-013.1.1 counts warnings by code without IDs", async () => {
    const r = await runCli(project(), ["check"]);
    expect(lines(r.out)).toEqual([
      "E-TASK-CYCLE .azimuth/features/F-001-thing/plan.md F-001",
      "  Tasks wait for each other in a cycle: T-001.2, T-001.1.",
      "3 warnings: 2 W-NO-NEGATIVE, 1 W-UNCOVERED-SCENARIO (--warnings lists them)",
      "",
      "1 errors, 3 warnings",
      "",
    ]);
    expect(r.code).toBe(1);
  });

  it("S-013.1.2 lists every warning with --warnings", async () => {
    const r = await runCli(project(), ["check", "--warnings"]);
    const out = lines(r.out);
    expect(out.slice(0, 2)).toEqual([
      "E-TASK-CYCLE .azimuth/features/F-001-thing/plan.md F-001",
      "  Tasks wait for each other in a cycle: T-001.2, T-001.1.",
    ]);
    expect(
      out.filter((l) => l.startsWith("W-NO-NEGATIVE .azimuth/features/F-001-thing/stories.md:")),
    ).toHaveLength(2);
    expect(out).toContain("W-UNCOVERED-SCENARIO .azimuth/features/F-001-thing/plan.md S-001.2.1");
    expect(r.out).not.toContain("--warnings lists them");
    expect(r.out.endsWith("1 errors, 3 warnings\n")).toBe(true);
    expect(r.code).toBe(1);
  });

  it("S-013.1.3 lists every warning of the item an ID names", async () => {
    const root = project();
    const all = await runCli(root, ["check", "--warnings"]);
    const r = await runCli(root, ["check", "F-001"]);
    expect(r.out).toBe(all.out);
    expect(r.code).toBe(1);
  });

  it("S-013.1.4 prints one summary and exits 0 when only warnings remain", async () => {
    const r = await runCli(project({ cycle: false }), ["check"]);
    expect(r.out).toBe(
      "3 warnings: 2 W-NO-NEGATIVE, 1 W-UNCOVERED-SCENARIO (--warnings lists them)\n\n0 errors, 3 warnings\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-013.1.5 still lists every problem with --json", async () => {
    const r = await runCli(project(), ["check", "--json"]);
    const problems = JSON.parse(r.out) as { severity: string }[];
    expect(problems).toHaveLength(4);
    expect(problems.filter((p) => p.severity === "error")).toHaveLength(1);
    expect(problems.filter((p) => p.severity === "warning")).toHaveLength(3);
    expect(r.code).toBe(1);
  });
});
