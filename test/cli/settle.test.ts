import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const SES = "SES-20261020-0900";
const DIR = ".azimuth/features/F-001-thing";

/** F-001 whose S-001.1.1 ends with `lines`, and an open session with nothing touched. */
function project(...lines: string[]): string {
  const stories = [
    "## ST-001.1 · Headings",
    "**Intent:** As a reader, I want headings found.",
    "",
    "### S-001.1.1 · Finds the heading {happy}",
    "- **GIVEN** the text `# Hi`",
    "- **WHEN** it is parsed",
    ...lines,
    "",
    "### S-001.1.2 · No heading {negative}",
    "- **GIVEN** the text `Hi`",
    "- **WHEN** it is parsed",
    "- **THEN** it returns `null`",
    "",
  ].join("\n");
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    [`${DIR}/stories.md`]: stories,
    [`.azimuth/sessions/${SES}.md`]: `---\nid: ${SES}\nstarted_at: 2026-10-20T09:00:00Z\ntouched: []\n---\n## Summary\n`,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const read = (root: string, name: string) => readFileSync(join(root, DIR, name), "utf8");

describe("ST-008.7 azimuth settle on the command line", () => {
  it("S-008.7.2 says how many are left and records the session", async () => {
    const root = project(
      "- **THEN** the heading starts at byte {?}",
      "- **AND** it ends at byte {?}",
    );
    const r = await runCli(root, ["settle", "S-001.1.1", "17"], { AZIMUTH_SESSION: SES });
    expect([r.code, r.out]).toEqual([0, "S-001.1.1: settled 17 (1 placeholder left)\n"]);
    expect(loadProject(root).sessions.find((s) => s.id === SES)?.touched).toEqual([
      "F-001",
      "S-001.1.1",
    ]);
  });

  it("S-008.7.3 exits 1 when nothing is left to settle", async () => {
    const root = project("- **THEN** the heading starts at byte {=17}");
    const before = [read(root, "stories.md"), read(root, "log.md")];
    const r = await runCli(root, ["settle", "S-001.1.1", "18"]);
    expect([r.code, r.err]).toEqual([1, "✗ S-001.1.1 has no {?} left to settle.\n"]);
    expect([read(root, "stories.md"), read(root, "log.md")]).toEqual(before);
  });

  it("S-008.7.4 exits 1 for an unknown scenario", async () => {
    const root = project("- **THEN** the heading starts at byte {?}");
    const log = read(root, "log.md");
    const r = await runCli(root, ["settle", "S-001.1.9", "17"]);
    expect([r.code, r.err]).toEqual([
      1,
      "✗ S-001.1.9 is not a scenario in .azimuth/features/F-001-thing/stories.md.\n",
    ]);
    expect(read(root, "log.md")).toBe(log);
  });

  it("S-008.7.5 exits 1 for a value with a brace", async () => {
    const root = project("- **THEN** the heading starts at byte {?}");
    const stories = read(root, "stories.md");
    const r = await runCli(root, ["settle", "S-001.1.1", "a}b"]);
    expect([r.code, r.err]).toEqual([
      1,
      "✗ A settled value can't be empty or contain {, } or a line break.\n",
    ]);
    expect(read(root, "stories.md")).toBe(stories);
  });
});
