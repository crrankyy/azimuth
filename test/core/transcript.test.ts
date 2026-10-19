import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { AzimuthError } from "../../src/core/errors";
import { normalizeTranscript, readTranscriptWindow } from "../../src/core/transcript";
import type { TranscriptEntry } from "../../src/core/types";
import { writeTree } from "../helpers/tree";

const FIXTURES = new URL("../fixtures/transcripts/", import.meta.url);
const fixtureLines = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, FIXTURES)), "utf8")
    .split("\n")
    .slice(0, -1);
const PLACES = { root: "/work/demo", home: "/home/dev" };

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

/** A temp file holding `text`. */
function file(text: string): string {
  const tree = writeTree({ "t.jsonl": text });
  cleanup = tree.cleanup;
  return `${tree.root}/t.jsonl`;
}

const THREE = '{"n":1}\n{"n":2}\n{"n":3}\n';

describe("F-014 transcript windows", () => {
  it("S-014.8.1 reads the tail of a small transcript whole", () => {
    expect(readTranscriptWindow(file(THREE), null)).toEqual({
      lines: ['{"n":1}', '{"n":2}', '{"n":3}'],
      next: 24,
      skipped: false,
    });
  });

  it("S-014.8.2 leaves a line still being written for later", () => {
    expect(readTranscriptWindow(file('{"n":1}\n{"n":2}\n{"n":'), null)).toEqual({
      lines: ['{"n":1}', '{"n":2}'],
      next: 16,
      skipped: false,
    });
  });

  it("S-014.8.3 starts a tail window at a line boundary", () => {
    expect(readTranscriptWindow(file(THREE), null, 12)).toEqual({
      lines: ['{"n":3}'],
      next: 24,
      skipped: true,
    });
  });

  it("S-014.8.4 reads on from an offset", () => {
    expect(readTranscriptWindow(file(THREE), 8)).toEqual({
      lines: ['{"n":2}', '{"n":3}'],
      next: 24,
      skipped: false,
    });
  });

  it("S-014.8.5 stops reading forward at the window", () => {
    expect(readTranscriptWindow(file(THREE), 0, 12)).toEqual({
      lines: ['{"n":1}'],
      next: 8,
      skipped: false,
    });
  });

  it("S-014.8.6 skips a line longer than the window whole", () => {
    const path = file(`{"x":"${"a".repeat(30)}"}\n{"n":2}\n`);
    expect(readTranscriptWindow(path, 0, 16)).toEqual({ lines: [], next: 39, skipped: true });
    expect(readTranscriptWindow(path, 39, 16)).toEqual({
      lines: ['{"n":2}'],
      next: 47,
      skipped: false,
    });
  });

  it("S-014.8.7 refuses an offset past the end", () => {
    const read = () => readTranscriptWindow(file(THREE), 25);
    expect(read).toThrow(AzimuthError);
    expect(read).toThrow("after must be a byte offset between 0 and 24.");
    try {
      read();
    } catch (e) {
      expect((e as AzimuthError).code).toBe("invalid");
    }
  });

  it("reads nothing at the end of the file or from an empty one", () => {
    expect(readTranscriptWindow(file(THREE), 24)).toEqual({ lines: [], next: 24, skipped: false });
    expect(readTranscriptWindow(file(""), null)).toEqual({ lines: [], next: 0, skipped: false });
  });
});

type Of<K extends TranscriptEntry["kind"]> = Extract<TranscriptEntry, { kind: K }>;
const byId = (entries: TranscriptEntry[], id: string) =>
  entries.find((e) => "tool_use_id" in e && e.tool_use_id === id);

/** One assistant call and its result, as Claude Code writes them. */
function call(name: string, input: Record<string, unknown>, toolUseResult: unknown): string[] {
  const base = { sessionId: "c9", isSidechain: false, parentUuid: null };
  return [
    JSON.stringify({
      ...base,
      type: "assistant",
      uuid: "x1",
      timestamp: "2026-10-20T11:00:00.000Z",
      message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_x", name, input }] },
    }),
    JSON.stringify({
      ...base,
      type: "user",
      uuid: "x2",
      timestamp: "2026-10-20T11:00:01.000Z",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_x", content: "done" }],
      },
      toolUseResult,
    }),
  ];
}

describe("F-014 normalised transcript entries", () => {
  const EDIT_DIFF = {
    lines: ["@@ -1,3 +1,4 @@", " a", "-b", "+c", "+d", " e"],
    added: 2,
    removed: 1,
    truncated: false,
  };

  it("S-014.9.1 turns the main fixture into messages, tools and a subagent card", () => {
    const entries = normalizeTranscript(fixtureLines("c1.jsonl"), PLACES);
    expect(entries.map((e) => e.kind)).toEqual([
      "message",
      "message",
      "tool",
      "tool",
      "tool",
      "spawn",
      "tool",
      "tool",
    ]);
    expect(byId(entries, "toolu_read")).toMatchObject({ target: "src/a.ts", status: "ok" });
    expect((byId(entries, "toolu_edit") as Of<"tool">).diff).toEqual(EDIT_DIFF);
    expect(byId(entries, "toolu_bash")).toMatchObject({
      summary: "Run the tests",
      output: { lines: ["RUN v3", "✓ S-001.1.1 adds", "Test Files 1 passed"], truncated: false },
    });
    expect(byId(entries, "toolu_agent")).toMatchObject({
      kind: "spawn",
      description: "Find callers",
      agent_type: "Explore",
      agent_id: "a1",
      status: "ok",
      output: { lines: ["Found 1 caller: src/b.ts"], truncated: false },
    });
    expect(byId(entries, "toolu_fail")).toMatchObject({
      status: "error",
      output: { lines: ["Exit code 1", "src/a.ts:3 error"] },
    });
    expect(byId(entries, "toolu_run")).toMatchObject({ status: "running", output: null });
  });

  it("S-014.9.2 never passes thinking, unknown entries, malformed lines or file contents", () => {
    const text = JSON.stringify(normalizeTranscript(fixtureLines("c1.jsonl"), PLACES));
    for (const secret of [
      "FIXTURE-THINKING",
      "FIXTURE-ATTACHMENT",
      "FIXTURE-FILE-TEXT",
      "FIXTURE-ORIGINAL-FILE",
      "FIXTURE-SUMMARY",
    ])
      expect(text).not.toContain(secret);
  });

  it("S-014.9.3 makes a result whose call is outside the page a result entry", () => {
    const entries = normalizeTranscript(fixtureLines("c1.jsonl").slice(6), PLACES);
    expect(entries[0]).toEqual({
      kind: "result",
      tool_use_id: "toolu_edit",
      status: "ok",
      diff: EDIT_DIFF,
      output: null,
      agent_id: null,
      at: "2026-10-20T10:00:11.000Z",
    });
  });

  it("S-014.9.4 caps long diffs and outputs", () => {
    const stdout = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
    const bash = normalizeTranscript(
      call("Bash", { command: "seq" }, { stdout, stderr: "" }),
      PLACES,
    )[0] as Of<"tool">;
    expect(bash.output?.lines).toHaveLength(40);
    expect(bash.output?.lines[0]).toBe("line 61");
    expect(bash.output?.lines.at(-1)).toBe("line 100");
    expect(bash.output?.truncated).toBe(true);
    const lines = Array.from({ length: 120 }, (_, i) => `+n${i + 1}`);
    const patch = [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 120, lines }];
    const edit = normalizeTranscript(
      call("Edit", { file_path: "/work/demo/a.ts" }, { structuredPatch: patch }),
      PLACES,
    )[0] as Of<"tool">;
    expect(edit.diff?.lines).toHaveLength(80);
    expect(edit.diff).toMatchObject({ added: 120, removed: 0, truncated: true });
    expect(edit.diff?.lines[0]).toBe("@@ -1,0 +1,120 @@");
  });

  it("S-014.9.5 shows a created file's content as added lines", () => {
    const entries = normalizeTranscript(
      call(
        "Write",
        { file_path: "/work/demo/b.ts", content: "x\ny\n" },
        { type: "create", filePath: "/work/demo/b.ts", content: "x\ny\n", structuredPatch: [] },
      ),
      PLACES,
    );
    expect(entries[0]).toMatchObject({
      kind: "tool",
      target: "b.ts",
      diff: { lines: ["+x", "+y"], added: 2, removed: 0, truncated: false },
    });
  });

  it("S-014.9.6 normalises a subagent's transcript", () => {
    const entries = normalizeTranscript(fixtureLines("c1/subagents/agent-a1.jsonl"), PLACES);
    expect(entries.map((e) => e.kind)).toEqual(["message", "tool", "message"]);
    expect(entries[1]).toMatchObject({ name: "Grep", target: "decide\\(", status: "ok" });
    expect(entries[2]).toMatchObject({ role: "assistant", text: "Found 1 caller: src/b.ts" });
  });
});
