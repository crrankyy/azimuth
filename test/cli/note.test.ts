import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const SES = "SES-20261020-0900";
const NOTES = ".azimuth/features/F-001-thing/notes.md";

function project(): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    [`.azimuth/sessions/${SES}.md`]: `---\nid: ${SES}\nstarted_at: 2026-10-20T09:00:00Z\ntouched: []\n---\n## Summary\n`,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("ST-008.2 azimuth note on the command line", () => {
  it("S-008.2.1 adds the note and records it in the session", async () => {
    const root = project();
    const r = await runCli(root, ["note", "T-001.1", "Counts the BOM."], { AZIMUTH_SESSION: SES });
    expect([r.code, r.out]).toEqual([0, "T-001.1: note added\n"]);
    const today = new Date().toISOString().slice(0, 10);
    expect(
      readFileSync(join(root, NOTES), "utf8").endsWith(
        `### T-001.1 · ${today}\n\nCounts the BOM.\n`,
      ),
    ).toBe(true);
    expect(loadProject(root).sessions.find((s) => s.id === SES)?.touched).toEqual([
      "F-001",
      "T-001.1",
    ]);
  });

  it("S-008.2.2 exits 1 for a task that isn't in the plan", async () => {
    const root = project();
    const r = await runCli(root, ["note", "T-001.9", "Counts the BOM."]);
    expect(r).toEqual({
      code: 1,
      out: "",
      err: "✗ T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.\n",
    });
    expect(existsSync(join(root, NOTES))).toBe(false);
  });
});
