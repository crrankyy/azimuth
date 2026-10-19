import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { loadProject } from "../../src/core/model";
import { recordInSession } from "../../src/core/session";
import { TEMPLATES } from "../../src/core/templates";
import { runCli } from "../helpers/cli";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

// A real lock conflict can't be timed to fall between creating the file and recording the ID.
vi.mock("../../src/core/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/session")>();
  return { ...actual, recordInSession: vi.fn(actual.recordInSession) };
});

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

function project(files: Record<string, string> = {}): string {
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("new prints only the ID", () => {
  it("S-013.3.1 prints the ID on stdout and the file on stderr", async () => {
    const r = await runCli(project(), ["new", "issue", "Crash on save"]);
    expect(r.out).toBe("BUG-0001\n");
    expect(r.err).toBe("created .azimuth/issues/BUG-0001-crash-on-save.md\n");
    expect(r.code).toBe(0);
  });

  it("S-013.3.2 joins several files on one stderr line", async () => {
    const r = await runCli(project(), ["new", "feature", "Pay by card"]);
    expect(r.out).toBe("F-001\n");
    expect(r.err).toBe(
      "created .azimuth/features/F-001-pay-by-card/feature.md, .azimuth/features/F-001-pay-by-card/log.md\n",
    );
    expect(r.code).toBe(0);
  });

  it("S-013.3.3 prints each chained creation's own ID", async () => {
    const root = project();
    const first = await runCli(root, ["new", "question", "Which card brands?"]);
    const second = await runCli(root, ["new", "question", "Which currency?"]);
    expect([first.out, second.out]).toEqual(["Q-0001\n", "Q-0002\n"]);
    expect(loadProject(root).questions.find((q) => q.id === "Q-0002")?.title).toBe(
      "Which currency?",
    );
  });

  it("S-013.3.4 keeps the --json output", async () => {
    const r = await runCli(project(), ["new", "issue", "Crash on save", "--json"]);
    expect(JSON.parse(r.out)).toEqual({
      id: "BUG-0001",
      files: [".azimuth/issues/BUG-0001-crash-on-save.md"],
    });
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
  });

  it("S-013.3.5 still prints the ID when recording it in the session fails", async () => {
    vi.mocked(recordInSession).mockImplementationOnce(() => {
      throw new AzimuthError("busy", "Another Azimuth command is writing; try again in a moment.");
    });
    const root = project();
    const r = await runCli(root, ["new", "issue", "Crash on save"]);
    expect(r.out).toBe("BUG-0001\n");
    expect(r.err).toBe(
      "created .azimuth/issues/BUG-0001-crash-on-save.md\n✗ Another Azimuth command is writing; try again in a moment.\n",
    );
    expect(r.code).toBe(1);
    expect(existsSync(join(root, ".azimuth/issues/BUG-0001-crash-on-save.md"))).toBe(true);
  });

  it("S-013.3.6 leaves no file and uses no ID when the fields can't be written", async () => {
    const template = (TEMPLATES["issue-bug.md"] as string).replace(
      "title: {{title_yaml}}",
      'title: "{{title}}',
    );
    const root = project({ ".azimuth/templates/issue-bug.md": template });
    const r = await runCli(root, ["new", "issue", "Crash on save", "--files", "src/app.ts"]);
    expect(r.out).toBe("");
    expect(r.code).toBe(3);
    const issues = join(root, ".azimuth/issues");
    expect(existsSync(issues) ? readdirSync(issues) : []).toEqual([]);

    rmSync(join(root, ".azimuth/templates/issue-bug.md"));
    const retry = await runCli(root, ["new", "issue", "Crash on save"]);
    expect(retry.out).toBe("BUG-0001\n");
  });
});
