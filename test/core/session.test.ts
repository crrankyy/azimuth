import { appendFileSync, readdirSync, readFileSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derive } from "../../src/core/derive";
import { appendLive, liveFile, readLiveMeta, updateLiveMeta } from "../../src/core/live";
import { loadProject } from "../../src/core/model";
import { parseSession } from "../../src/core/parse/records";
import {
  appendNote,
  closeSession,
  closeStaleSessions,
  currentSession,
  linkedSession,
  linkOpen,
  startSession,
  writeHandoff,
} from "../../src/core/session";
import { validate } from "../../src/core/validate";
import { loadTree, makeFacts } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

// Closing must not load the whole project: SessionEnd has 1.5 s.
vi.mock("../../src/core/model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/model")>();
  return { ...actual, loadProject: vi.fn(actual.loadProject) };
});

const FILE = ".azimuth/sessions/SES-20261020-0900.md";
const FRONTMATTER =
  "---\nid: SES-20261020-0900\nagent: claude-code\nskill: spec\nstarted_at: 2026-10-20T09:00:00Z\nended_at: null\ngoal: Spec F-011\ntouched: [F-011]\ncommits: []\nraised: []\n---\n";

const at = (time: string) => new Date(`2026-10-20T${time}Z`);

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

function project(files: Record<string, string> = {}): string {
  const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG, ...files });
  cleanup = tree.cleanup;
  return tree.root;
}

/** The session as its own file says, read without loadProject's cache. */
function read(root: string, id: string) {
  const file = `.azimuth/sessions/${id}.md`;
  return parseSession(readFileSync(join(root, file), "utf8"), file).entity;
}

const sessionFiles = (root: string) => readdirSync(join(root, ".azimuth/sessions"));

describe("F-011 Goals and Notes sections", () => {
  it("S-011.6.1 parses the Goals and Notes sections", () => {
    const text = `${FRONTMATTER}## Summary\n\n## Handoff\nBuild T-011.3 next.\n\n## Goals\n- 10:15 · build · Build F-011\n\n## Notes\n- 10:30 · T-011.2 green\n`;
    const { entity, problems } = parseSession(text, FILE);
    expect(entity?.goals).toBe("- 10:15 · build · Build F-011");
    expect(entity?.notes).toBe("- 10:30 · T-011.2 green");
    expect(problems).toEqual([]);
  });

  it("S-011.6.2 parses a session without them as before", () => {
    const { entity, problems } = parseSession(`${FRONTMATTER}## Summary\n\n## Handoff\n`, FILE);
    expect(entity?.goals).toBe("");
    expect(entity?.notes).toBe("");
    expect(problems).toEqual([]);
  });
});

describe("F-011 one Azimuth session per Claude Code session", () => {
  /** The session of S-011.1.1: started for the spec, then reused for the build. */
  function reusedOnce(root: string): string[] {
    const first = startSession(root, {
      skill: "spec",
      goal: "Spec F-011",
      touched: ["F-011"],
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    const second = startSession(root, {
      skill: "build",
      goal: "Build F-011",
      touched: ["F-011", "T-011.1"],
      now: at("10:15:00"),
      claudeSession: "c1",
    });
    return [first, second];
  }

  it("S-011.1.1 reuses the open session at a second start in the same Claude Code session", () => {
    const root = project();
    expect(reusedOnce(root)).toEqual(["SES-20261020-0900", "SES-20261020-0900"]);
    expect(sessionFiles(root)).toEqual(["SES-20261020-0900.md"]);
    expect(read(root, "SES-20261020-0900")).toMatchObject({
      goals: "- 10:15 · build · Build F-011",
      skill: "spec",
      goal: "Spec F-011",
      touched: ["F-011", "T-011.1"],
    });
  });

  it("S-011.1.2 adds each reuse's goal below the last", () => {
    const root = project();
    reusedOnce(root);
    const id = startSession(root, {
      skill: null,
      goal: "Triage BUG-0003",
      now: at("11:40:00"),
      claudeSession: "c1",
    });
    expect(id).toBe("SES-20261020-0900");
    expect(read(root, id)?.goals).toBe("- 10:15 · build · Build F-011\n- 11:40 · Triage BUG-0003");
  });

  it("S-011.1.3 doesn't reuse a closed session", () => {
    const root = project();
    const first = startSession(root, {
      skill: "spec",
      goal: "Spec F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    closeSession(root, first, at("09:30:00"));
    const id = startSession(root, {
      skill: "build",
      goal: "Build F-011",
      now: at("10:15:00"),
      claudeSession: "c1",
    });
    expect(id).toBe("SES-20261020-1015");
    expect(readLiveMeta(root, "c1")?.ses).toBe("SES-20261020-1015");
    expect(read(root, first)?.ended_at).toBe("2026-10-20T09:30:00Z");
  });

  it("S-011.1.4 gives another Claude Code session its own session", () => {
    const root = project();
    startSession(root, {
      skill: "spec",
      goal: "Spec F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    const id = startSession(root, {
      skill: null,
      goal: "Review F-012",
      now: at("09:00:30"),
      claudeSession: "c2",
    });
    expect(id).toBe("SES-20261020-0900-2");
  });

  it("S-011.1.5 creates a session at every start without a Claude Code session", () => {
    const root = project();
    const start = () =>
      startSession(root, { skill: null, goal: "Triage", now: at("09:00:00"), claudeSession: null });
    const ids = [start(), start()];
    expect(ids).toEqual(["SES-20261020-0900", "SES-20261020-0900-2"]);
    expect(ids.map((id) => read(root, id)?.goals)).toEqual(["", ""]);
  });
});

describe("F-011 the current session", () => {
  /** S-011.2.5's GIVEN: a session started in c1, then more than 64 KB of tool records. */
  function longSession(root: string): void {
    startSession(root, {
      skill: "build",
      goal: "Build F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    const tool = (i: number) => ({
      kind: "tool",
      at: "2026-10-20T09:30:00Z",
      tool: "Bash",
      file: null,
      summary: `pnpm exec vitest run test/core/session.test.ts --reporter=verbose # step ${i}`,
      agent_id: null,
    });
    // One write: appending record by record would spend most of the test resolving the cache dir.
    const lines = Array.from({ length: 1000 }, (_, i) => `${JSON.stringify(tool(i))}\n`);
    appendFileSync(liveFile(root, "c1"), lines.join(""));
    expect(statSync(liveFile(root, "c1")).size).toBeGreaterThan(64 * 1024);
  }

  it("S-011.2.5 survives a long live log", () => {
    const root = project();
    longSession(root);
    expect(currentSession(root, { CLAUDE_CODE_SESSION_ID: "c1" })).toBe("SES-20261020-0900");
  });

  it("S-011.2.6 lets AZIMUTH_SESSION win", () => {
    const root = project();
    longSession(root);
    expect(
      currentSession(root, { AZIMUTH_SESSION: "SES-20261019-0800", CLAUDE_CODE_SESSION_ID: "c1" }),
    ).toBe("SES-20261019-0800");
  });

  it("S-011.2.7 comes from the tail without a sidecar", () => {
    const root = project();
    appendLive(root, "c2", {
      kind: "session",
      at: "2026-10-20T09:00:00Z",
      ses: "SES-20261020-0900",
    });
    expect(readLiveMeta(root, "c2")).toBeNull();
    expect(currentSession(root, { CLAUDE_CODE_SESSION_ID: "c2" })).toBe("SES-20261020-0900");
  });
});

describe("F-011 session notes", () => {
  const started = (root: string) =>
    startSession(root, { skill: "build", goal: "Build F-011", now: at("09:00:00") });

  it("S-011.3.1 creates the Notes section with the first note", () => {
    const root = project();
    const id = started(root);
    const file = appendNote(root, id, "T-011.2 green; starting T-011.3", at("10:30:00"));
    expect(file).toBe(".azimuth/sessions/SES-20261020-0900.md");
    const ending = "## Notes\n- 10:30 · T-011.2 green; starting T-011.3\n";
    expect(readFileSync(join(root, file), "utf8").slice(-ending.length)).toBe(ending);
  });

  it("S-011.3.2 adds later notes below earlier ones and leaves the other sections alone", () => {
    const root = project();
    const id = started(root);
    appendNote(root, id, "T-011.2 green; starting T-011.3", at("10:30:00"));
    writeHandoff(root, id, { handoff: "Finish T-011.3." });
    appendNote(root, id, "T-011.3 green", at("11:05:00"));
    expect(read(root, id)).toMatchObject({
      notes: "- 10:30 · T-011.2 green; starting T-011.3\n- 11:05 · T-011.3 green",
      handoff: "Finish T-011.3.",
    });
  });

  it("S-011.3.3 makes a note spanning lines one bullet", () => {
    const root = project();
    const id = started(root);
    appendNote(root, id, "Done.\n\n  Next: T-011.4", at("10:30:00"));
    expect(read(root, id)?.notes).toBe("- 10:30 · Done. Next: T-011.4");
  });
});

describe("F-011 closing a session", () => {
  it("S-011.4.5 reads only the session's own file", () => {
    const root = project();
    const id = startSession(root, { skill: "build", goal: "Build F-011", now: at("09:00:00") });
    vi.mocked(loadProject).mockClear();
    closeSession(root, id, at("10:00:00"));
    expect(loadProject).toHaveBeenCalledTimes(0);
    expect(read(root, id)?.ended_at).toBe("2026-10-20T10:00:00Z");
  });
});

describe("F-011 sessions left open", () => {
  const NOW = new Date("2026-10-20T12:00:00Z");
  /** An open session file started at `startedAt`. */
  const openSession = (id: string, startedAt: string) => ({
    [`.azimuth/sessions/${id}.md`]: `---\nid: ${id}\nagent: claude-code\nskill: build\nstarted_at: ${startedAt}\nended_at: null\ngoal: Build\ntouched: []\ncommits: []\nraised: []\n---\n## Summary\n\n## Handoff\n`,
  });
  /** W-SESSION-OPEN problems' sessions, validated at NOW with `lastSeen`. */
  function flagged(files: Record<string, string>, lastSeen: [string, string][]): string[] {
    const tree = loadTree(files);
    cleanup = tree.cleanup;
    const facts = makeFacts({ now: NOW, sesLastSeen: new Map(lastSeen) });
    return validate(tree.model, facts, derive(tree.model, facts))
      .filter((p) => p.code === "W-SESSION-OPEN")
      .map((p) => p.ref ?? "");
  }
  /** A Claude Code session whose sidecar names `ses` and whose live log was last written `at`. */
  function claudeSession(root: string, claude: string, ses: string, at: string): void {
    appendLive(root, claude, { kind: "stop", at });
    utimesSync(liveFile(root, claude), new Date(at), new Date(at));
    updateLiveMeta(root, claude, { ses });
  }

  it("S-011.5.2 doesn't flag a session whose Claude Code session was active within the hour", () => {
    expect(
      flagged(openSession("SES-20261019-2000", "2026-10-19T20:00:00Z"), [
        ["SES-20261019-2000", "2026-10-20T11:30:00Z"],
      ]),
    ).toEqual([]);
  });

  it("S-011.5.3 flags a session whose Claude Code session went quiet", () => {
    const tree = loadTree(openSession("SES-20261019-2000", "2026-10-19T20:00:00Z"));
    cleanup = tree.cleanup;
    const facts = makeFacts({
      now: NOW,
      sesLastSeen: new Map([["SES-20261019-2000", "2026-10-20T10:30:00Z"]]),
    });
    const problems = validate(tree.model, facts, derive(tree.model, facts)).filter(
      (p) => p.code === "W-SESSION-OPEN",
    );
    expect(problems.map((p) => [p.ref, p.message])).toEqual([
      [
        "SES-20261019-2000",
        "SES-20261019-2000 was never closed. Run `azimuth session close --stale`.",
      ],
    ]);
  });

  it("S-011.5.4 keeps the 12-hour rule for a session without a known Claude Code session", () => {
    const files = {
      ...openSession("SES-20261019-2000", "2026-10-19T20:00:00Z"),
      ...openSession("SES-20261020-0100", "2026-10-20T01:00:00Z"),
    };
    expect(flagged(files, [])).toEqual(["SES-20261019-2000"]);
  });

  it("S-011.5.5 close --stale skips an active session", () => {
    const root = project({
      ...openSession("SES-20261019-2000", "2026-10-19T20:00:00Z"),
      ...openSession("SES-20261019-1900", "2026-10-19T19:00:00Z"),
    });
    claudeSession(root, "c1", "SES-20261019-2000", "2026-10-20T11:30:00Z");
    expect(closeStaleSessions(root, NOW)).toEqual([".azimuth/sessions/SES-20261019-1900.md"]);
    expect(read(root, "SES-20261019-1900")?.ended_at).toBe("2026-10-20T07:00:00Z");
    expect(read(root, "SES-20261019-2000")?.ended_at).toBeNull();
  });

  it("S-011.5.6 ends a stale long session at its Claude Code session's last activity", () => {
    const root = project(openSession("SES-20261019-2000", "2026-10-19T20:00:00Z"));
    claudeSession(root, "c1", "SES-20261019-2000", "2026-10-20T10:00:00Z");
    closeStaleSessions(root, NOW);
    expect(read(root, "SES-20261019-2000")?.ended_at).toBe("2026-10-20T10:00:00Z");
  });
});

describe("F-027 the CLI's session with its state", () => {
  const LINKED = ".azimuth/sessions/SES-20261020-1343.md";
  const OPEN =
    "---\nid: SES-20261020-1343\nagent: claude-code\nskill: spec\nstarted_at: 2026-10-20T13:43:00Z\nended_at: null\ngoal: Spec F-050\ntouched: []\ncommits: []\nraised: []\n---\n## Summary\n\n## Handoff\n";
  const CLOSED = OPEN.replace("ended_at: null", "ended_at: 2026-10-21T10:00:00Z");
  const BROKEN = "---\nid: [SES-20261020-1343\n---\n## Summary\n";

  const sidecar = (root: string) =>
    updateLiveMeta(root, "c1", { started_at: "2026-10-20T13:43:00Z", ses: "SES-20261020-1343" });

  it("S-027.1.1 reports an open linked session", () => {
    const root = project({ [LINKED]: OPEN });
    sidecar(root);
    expect(linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })).toEqual({
      id: "SES-20261020-1343",
      state: "open",
      ended_at: null,
    });
    expect(linkOpen(root, "c1")).toBe(true);
  });

  it("S-027.1.2 reports a closed linked session with its end", () => {
    const root = project({ [LINKED]: CLOSED });
    sidecar(root);
    expect(linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })).toEqual({
      id: "SES-20261020-1343",
      state: "closed",
      ended_at: "2026-10-21T10:00:00Z",
    });
    expect(linkOpen(root, "c1")).toBe(false);
  });

  it("S-027.1.3 returns null without a link", () => {
    const root = project({ [LINKED]: OPEN });
    expect(linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c9" })).toBeNull();
    expect(linkOpen(root, "c9")).toBe(false);
    expect(linkedSession(root, {})).toBeNull();
  });

  it("S-027.1.4 reports a linked session without a file as missing", () => {
    const root = project();
    sidecar(root);
    expect(linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })).toEqual({
      id: "SES-20261020-1343",
      state: "missing",
      ended_at: null,
    });
    expect(linkOpen(root, "c1")).toBe(false);
  });

  it("S-027.1.5 reports a linked session whose file doesn't parse as invalid", () => {
    const root = project({ [LINKED]: BROKEN });
    sidecar(root);
    expect(linkedSession(root, { AZIMUTH_CLAUDE_SESSION: "c1" })).toEqual({
      id: "SES-20261020-1343",
      state: "invalid",
      ended_at: null,
    });
    expect(linkOpen(root, "c1")).toBe(false);
  });

  it("S-027.1.6 lets AZIMUTH_SESSION win over the Claude Code session's link", () => {
    const older = CLOSED.replace("id: SES-20261020-1343", "id: SES-20261019-0800").replace(
      "ended_at: 2026-10-21T10:00:00Z",
      "ended_at: 2026-10-19T09:00:00Z",
    );
    const root = project({
      [LINKED]: OPEN,
      ".azimuth/sessions/SES-20261019-0800.md": older,
    });
    sidecar(root);
    expect(
      linkedSession(root, { AZIMUTH_SESSION: "SES-20261019-0800", AZIMUTH_CLAUDE_SESSION: "c1" }),
    ).toEqual({ id: "SES-20261019-0800", state: "closed", ended_at: "2026-10-19T09:00:00Z" });
    expect(linkOpen(root, "c1")).toBe(true);
  });
});
