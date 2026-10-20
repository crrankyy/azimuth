import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { runCli } from "../helpers/cli";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const BUG = ".azimuth/issues/BUG-0001-x.md";

function project(): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    [BUG]:
      "---\nid: BUG-0001\ntype: bug\ntitle: X\nseverity: low\ncreated: 2026-10-01\n---\n## Repro\nRun it.\n",
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("F-024 azimuth log on an issue", () => {
  it("S-024.1.3 logs a note on a bug that check accepts", async () => {
    const root = project();
    const r = await runCli(root, ["log", "BUG-0001", "Reproduced with a BOM"]);
    expect([r.code, r.out]).toEqual([0, "BUG-0001: note added\n"]);
    const last = readFileSync(join(root, BUG), "utf8").trimEnd().split("\n").at(-1) ?? "";
    expect(last).toMatch(
      /^- \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z · agent · Reproduced with a BOM$/,
    );
    const check = await runCli(root, ["check", "BUG-0001"]);
    expect([check.code, check.out]).toEqual([0, "No problems.\n"]);
  });

  it("S-024.1.4 refuses a question and names the kinds log takes", async () => {
    const root = project();
    expect((await runCli(root, ["new", "question", "Which one?"])).code).toBe(0);
    const file = join(root, loadProject(root).questions.find((q) => q.id === "Q-0001")!.file);
    const before = readFileSync(file, "utf8");
    const r = await runCli(root, ["log", "Q-0001", "Asked again"]);
    expect(r).toEqual({
      code: 1,
      out: "",
      err: "✗ Q-0001 is not a feature, story, scenario, task or issue.\n",
    });
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
