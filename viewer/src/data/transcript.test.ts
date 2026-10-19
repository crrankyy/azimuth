import { describe, expect, it, vi } from "vitest";
import type { TranscriptEntry, TranscriptPage } from "../../../src/core/types";
import { transcriptPage1, transcriptPage2 } from "../../../test/fixtures/live/agents";
import {
  EMPTY_TRANSCRIPT,
  applyTranscript,
  fetchTranscript,
  transcriptUrl,
  type TranscriptState,
} from "./transcript";

/** A fetch that answers every request with `body` as JSON and `status`. */
function answering(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

function applied(...pages: TranscriptPage[]): TranscriptState {
  return pages.reduce((s, page) => applyTranscript(s, { ok: true, page }), EMPTY_TRANSCRIPT);
}

function withSkipped(page: TranscriptPage): TranscriptPage {
  return { ...structuredClone(page), skipped: true };
}

const callId = (e: TranscriptEntry) => ("tool_use_id" in e ? e.tool_use_id : null);

describe("transcript requests", () => {
  it("S-015.5.1 requests the first page with the page's token", async () => {
    const fake = answering(200, transcriptPage1);
    const result = await fetchTranscript(
      { token: "tok", claudeSession: "c1201", agent: null, after: null },
      fake,
    );
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0] ?? [];
    expect(url).toBe("/api/transcript/c1201");
    expect(new Headers(init?.headers).get("x-azimuth-token")).toBe("tok");
    expect(result).toEqual({ ok: true, page: transcriptPage1 });
  });

  it("S-015.5.2 asks a subagent's transcript for what comes after the last page", () => {
    expect(transcriptUrl("c1201", "a1", 48213)).toBe("/api/transcript/c1201?agent=a1&after=48213");
  });

  it("S-015.5.5 keeps the loaded entries when the server refuses a request", async () => {
    const before = applied(transcriptPage1);
    const fake = answering(404, {
      ok: false,
      error: "not-found",
      message: "No transcript recorded for agent a9.",
    });
    const result = await fetchTranscript(
      { token: "tok", claudeSession: "c1201", agent: "a9", after: before.next },
      fake,
    );
    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "No transcript recorded for agent a9.",
    });
    const state = applyTranscript(before, result);
    expect(state.entries).toHaveLength(9);
    expect(state.entries).toEqual(transcriptPage1.entries);
    expect(state.next).toBe(48213);
    expect(state.skipped).toBe(false);
    expect(state.error).toBe("No transcript recorded for agent a9.");
  });

  it("S-015.5.6 names the status without a message, and an unreachable server", async () => {
    const refused = await fetchTranscript(
      { token: "bad", claudeSession: "c1201", agent: null, after: null },
      answering(403, { ok: false, error: "token" }),
    );
    expect(refused).toEqual({ ok: false, status: 403, message: "403 token" });
    const rejecting = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    const unreachable = await fetchTranscript(
      { token: "tok", claudeSession: "c1201", agent: null, after: null },
      rejecting,
    );
    expect(unreachable).toEqual({ ok: false, status: 0, message: "Couldn't reach azimuth view." });
  });
});

describe("applying transcript pages", () => {
  it("S-015.5.3 appends a later page and completes the earlier spawn call", () => {
    const page1 = structuredClone(transcriptPage1);
    const page2 = structuredClone(transcriptPage2);
    const first = applied(transcriptPage1);
    const firstCopy = structuredClone(first);
    const state = applyTranscript(first, { ok: true, page: transcriptPage2 });

    expect(state.entries).toHaveLength(10);
    const runner = state.entries.find((e) => callId(e) === "toolu_runner");
    expect(runner).toMatchObject({
      kind: "spawn",
      status: "ok",
      output: { lines: ["3 passed"] },
      agent_id: "a1",
    });
    expect(state.entries.at(-1)).toMatchObject({
      kind: "message",
      text: "All three scenarios pass.",
    });
    expect(state.entries.some((e) => e.kind === "result")).toBe(false);
    expect(state.next).toBe(50112);
    expect(state.error).toBeNull();
    // The fixtures and the earlier state are shared: applying a page never changes them.
    expect(transcriptPage1).toEqual(page1);
    expect(transcriptPage2).toEqual(page2);
    expect(first).toEqual(firstCopy);
  });

  it("S-015.5.4 drops a result whose call isn't loaded", () => {
    const orphan: TranscriptPage = {
      ...structuredClone(transcriptPage2),
      entries: [
        {
          kind: "result",
          tool_use_id: "toolu_gone",
          status: "ok",
          diff: null,
          output: { lines: ["done"], truncated: false },
          agent_id: null,
          at: "2026-10-18T12:05:20Z",
        },
      ],
      next: 48300,
    };
    const state = applyTranscript(applied(transcriptPage1), { ok: true, page: orphan });
    expect(state.entries).toHaveLength(9);
    expect(state.entries.some((e) => callId(e) === "toolu_gone")).toBe(false);
    expect(state.next).toBe(48300);
  });

  it("S-015.5.7 shows only the first page's skipped flag", () => {
    const skippedFirst = applied(withSkipped(transcriptPage1), withSkipped(transcriptPage2));
    const fromStart = applied(transcriptPage1, withSkipped(transcriptPage2));
    expect(skippedFirst.skipped).toBe(true);
    expect(fromStart.skipped).toBe(false);
  });
});
