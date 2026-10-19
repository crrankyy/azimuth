import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSession } from "../../src/core/parse/records";
import { runCli } from "../helpers/cli";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const SES = "SES-20261020-0900";

function project(files: Record<string, string> = {}): string {
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  cleanup = tree.cleanup;
  return tree.root;
}

function read(root: string, id: string) {
  const file = `.azimuth/sessions/${id}.md`;
  return parseSession(readFileSync(join(root, file), "utf8"), file).entity;
}

const clock = (date: Date) => date.toISOString().slice(11, 16);

describe("F-011 session start reuses the Claude Code session's session", () => {
  it("S-011.1.6 prints the reused ID", async () => {
    const root = project();
    const env = { CLAUDE_CODE_SESSION_ID: "c1" };
    const first = await runCli(
      root,
      ["session", "start", "--skill", "spec", "--goal", "Spec F-011"],
      env,
    );
    const second = await runCli(
      root,
      ["session", "start", "--skill", "build", "--goal", "Build F-011", "--touch", "F-011"],
      env,
    );
    expect(second.code).toBe(0);
    expect(second.out).toBe(first.out);
    expect(readdirSync(join(root, ".azimuth/sessions"))).toHaveLength(1);
  });
});

describe("F-011 session note", () => {
  it("S-011.3.4 appends to the current session", async () => {
    const root = project();
    const env = { CLAUDE_CODE_SESSION_ID: "c1" };
    const id = (
      await runCli(root, ["session", "start", "--skill", "build", "--goal", "Build F-011"], env)
    ).out.trim();
    const before = new Date();
    const r = await runCli(root, ["session", "note", "T-011.2 green"], env);
    const after = new Date();
    expect([r.code, r.out]).toEqual([0, `Updated .azimuth/sessions/${id}.md\n`]);
    expect([before, after].map((t) => `- ${clock(t)} · T-011.2 green`)).toContain(
      read(root, id)?.notes,
    );
  });

  it("S-011.3.5 needs a current session", async () => {
    const r = await runCli(project(), ["session", "note", "T-011.2 green"]);
    expect(r.code).toBe(1);
    expect(r.err).toBe(
      "✗ No current session. Start one with `azimuth session start` or pass --id.\n",
    );
  });

  it("S-011.3.6 needs text", async () => {
    const root = project({
      [`.azimuth/sessions/${SES}.md`]: `---\nid: ${SES}\nagent: claude-code\nskill: build\nstarted_at: 2026-10-20T09:00:00Z\nended_at: null\ngoal: Build F-011\ntouched: []\ncommits: []\nraised: []\n---\n## Summary\n\n## Handoff\n`,
    });
    const r = await runCli(root, ["session", "note", "--id", SES]);
    expect(r.code).toBe(2);
    expect(r.err.split("\n")[0]).toBe('session note needs "<text>".');
  });

  it("S-011.3.7 names note among the actions of an unknown one", async () => {
    const r = await runCli(project(), ["session", "pause"]);
    expect(r.code).toBe(2);
    expect(r.err.split("\n")[0]).toBe(
      'Unknown session action "pause". Use start, note, handoff or close.',
    );
  });
});
