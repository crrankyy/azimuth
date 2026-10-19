import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Index, LiveSession, TranscriptEntry } from "../../../../src/core/types";
import {
  AGENTS_NOW,
  agentsLive,
  indexWithLive,
  transcriptPage1,
} from "../../../../test/fixtures/live/agents";
import { Screen } from "../../App";
import { UiProvider } from "../../components/Ui";
import { IndexContext, type Connection } from "../../data/IndexProvider";
import { applyTranscript, EMPTY_TRANSCRIPT, type TranscriptState } from "../../data/transcript";
import { parseRoute } from "../../lib/router";
import { AgentTranscript, type AgentTranscriptProps } from "./AgentTranscript";

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

function withIndex(index: Index, connection: Connection, children: ReactNode): string {
  const value = {
    index,
    connection,
    attempts: 0,
    lastUpdate: AGENTS_NOW,
    changed: new Set<string>(),
    now: AGENTS_NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>{children}</IndexContext.Provider>
    </UiProvider>,
  );
}

const loaded = (entries: TranscriptEntry[] = transcriptPage1.entries): TranscriptState =>
  applyTranscript(EMPTY_TRANSCRIPT, {
    ok: true,
    page: { ...structuredClone(transcriptPage1), entries: structuredClone(entries) },
  });

/** AgentTranscript for one fixture session, with c1201's first page loaded by default. */
function renderTranscript(
  over: Partial<Omit<AgentTranscriptProps, "index" | "session">> & {
    claudeSession?: string;
    live?: LiveSession[];
  } = {},
): string {
  const { claudeSession = "c1201", live = agentsLive(), ...props } = over;
  const index = indexWithLive(live);
  const session = index.live.find((s) => s.claude_session === claudeSession);
  if (!session) throw new Error(`No fixture session ${claudeSession}`);
  return withIndex(
    index,
    "live",
    <AgentTranscript
      index={index}
      session={session}
      agentId={null}
      transcript={loaded()}
      now={AGENTS_NOW}
      follow={true}
      onFollow={() => {}}
      showAll={false}
      onShowAll={() => {}}
      {...props}
    />,
  );
}

const renderRoute = (hash: string, connection: Connection, live = agentsLive()) =>
  withIndex(indexWithLive(live), connection, <Screen route={parseRoute(hash)} />);

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** The markup of each transcript item (entries, then the now line), in order. */
const items = (html: string) => {
  const list = /<ol class="tr-entries"[^>]*>(.*?)<\/ol>/s.exec(html)?.[1] ?? "";
  const start = '<li class="tr-entry';
  return list
    .split(start)
    .slice(1)
    .map((i) => start + i);
};

/** The one item (of a kind: "tr-tool", "tr-spawn-entry"…) whose text contains `needle`. */
const item = (html: string, needle: string, kind = "") => {
  const found = items(html).filter(
    (i) => text(i).includes(needle) && /^<li class="([^"]*)"/.exec(i)?.[1]?.includes(kind),
  );
  expect(found, `items containing ${needle}`).toHaveLength(1);
  return found[0] ?? "";
};

/** An element's opening tag, found by a fragment of it. */
const openTag = (html: string, fragment: string) =>
  new RegExp(`<[a-z]+[^>]*${fragment}[^>]*>`).exec(html)?.[0] ?? "";

/** A side-panel group's text, from its eyebrow to the next group. */
const group = (html: string, eyebrow: string) => {
  const aside = /<aside[^>]*>(.*?)<\/aside>/s.exec(html)?.[1] ?? "";
  const groups = aside.split('<section class="tr-group">').slice(1).map(text);
  return groups.find((g) => g.startsWith(eyebrow)) ?? "";
};

describe("F-015 the live transcript page", () => {
  it("S-015.4.1 shows the session's status, IDs, timing, goal and work in the header", () => {
    const html = renderTranscript();
    const head = /<header class="tr-head">(.*?)<\/header>/s.exec(html)?.[1] ?? "";
    const meta = text(head);
    expect(meta).toContain("Running");
    expect(meta).toContain("SES-20261018-1201");
    expect(meta).toContain("c1201");
    expect(head).toContain('<span class="az-tag">build</span>');
    expect(meta).toContain("started 12:01:04 · 3m 56s · 7 tool calls");
    expect(head).toMatch(/<h1[^>]*>Turn S-005.2.1 green: implement retry exhaustion<\/h1>/);
    expect(meta).toContain("Working on F-005 T-005.4 Exhaustion & policy validation (red → green)");
    expect(head).toMatch(/<button[^>]*>Copy session ID<\/button>/);
  });

  it("S-015.4.2 has a tab per agent, the shown one selected", () => {
    const html = renderTranscript();
    const tabs = [...html.matchAll(/(<a [^>]*role="tab"[^>]*>)(.*?)<\/a>/g)].map(
      ([, open, inner]) => ({ open: open ?? "", text: text(inner ?? "") }),
    );
    expect(tabs).toHaveLength(3);
    const [main, runner, explorer] = tabs;
    expect(main?.text).toContain("Main session");
    expect(main?.open).toContain('aria-selected="true"');
    expect(main?.open).toContain('href="#/agents/c1201"');
    expect(runner?.text).toContain("test-runner 40s");
    expect(runner?.open).toContain('aria-selected="false"');
    expect(runner?.open).toContain('href="#/agents/c1201/a1"');
    expect(explorer?.text).toContain("explorer done");
    expect(explorer?.open).toContain('href="#/agents/c1201/a2"');
  });

  it("S-015.4.4 shows timestamped messages, tool rows, diffs, failures and the now line", () => {
    const html = renderTranscript();
    expect(text(item(html, "Build T-005.4"))).toBe("12:01:04 Build T-005.4");
    expect(text(item(html, "Picking up"))).toBe("12:01:09 Picking up T-005.4 from the handoff.");

    const read = item(html, "Read src/retry/policy.test.ts", "tr-tool");
    expect(text(read)).toContain("Read src/retry/policy.test.ts");
    expect(openTag(read, "aria-expanded")).toContain('aria-expanded="false"');

    const edit = item(html, "Edit src/retry/policy.ts", "tr-tool");
    expect(openTag(edit, "aria-expanded")).toContain('aria-expanded="true"');
    expect(text(edit)).toContain("+4");
    expect(text(edit)).toContain("−1");
    expect(edit).toContain('<span class="diff-hunk">@@ -12,2 +12,5 @@</span>');
    expect(edit).toContain(
      '<span class="diff-del">-  if (attempt &gt; policy.maxAttempts) return exhausted;</span>',
    );
    for (const line of ["+  if (attempt &gt;= policy.maxAttempts) {", "+    return exhausted;"])
      expect(edit).toContain(`<span class="diff-add">${line}</span>`);

    const lint = item(html, "pnpm lint", "tr-tool");
    expect(openTag(lint, "aria-expanded")).toContain('aria-expanded="true"');
    expect(text(lint)).toContain("src/retry/policy.ts:14 error no-unused-vars");
    expect(lint).toContain('aria-label="Failed"');

    expect(text(item(html, "pnpm build", "tr-tool"))).toContain("running 42s");

    const last = items(html).at(-1) ?? "";
    expect(text(last)).toBe("now Waiting for test-runner…");
  });

  it("S-015.4.5 shows subagent cards that link to their transcripts", () => {
    const html = renderTranscript();
    const explorer = item(html, "Find every caller of decideRetry()");
    expect(text(explorer)).toContain("Spawned subagent explorer Done · 1m 12s");
    expect(text(explorer)).toContain("Found 1 caller: src/worker/deliver.ts");
    expect(explorer).toMatch(/<a [^>]*href="#\/agents\/c1201\/a2"[^>]*>Open its transcript →<\/a>/);

    const runner = item(html, "Re-run policy.test.ts after each edit");
    expect(text(runner)).toContain("Spawned subagent test-runner Running · 40s");
    expect(runner).toMatch(/<a [^>]*href="#\/agents\/c1201\/a1"[^>]*>Open its transcript →<\/a>/);
  });

  it("S-015.4.6 shows a subagent card without a link before its ID is known", () => {
    const entries = structuredClone(transcriptPage1.entries);
    const spawn = entries[8];
    if (spawn?.kind !== "spawn") throw new Error("Entry 9 should be a spawn");
    spawn.agent_id = null;
    const html = renderTranscript({ transcript: loaded(entries) });
    const card = item(html, "Re-run policy.test.ts after each edit");
    expect(text(card)).toContain("Spawned subagent test-runner Running");
    expect(text(card)).not.toMatch(/Running ·/);
    expect(card).not.toContain("Open its transcript");
  });

  it("S-015.4.9 expands every tool row with Show all tool output", () => {
    const vitest = "pnpm vitest run src/retry/policy.test.ts";
    const passed = "✓ S-005.2.1 marks delivery exhausted";

    const closed = item(renderTranscript({ showAll: false }), vitest, "tr-tool");
    expect(openTag(closed, "aria-expanded")).toContain('aria-expanded="false"');
    expect(text(closed)).not.toContain(passed);

    const open = item(renderTranscript({ showAll: true }), vitest, "tr-tool");
    expect(openTag(open, "aria-expanded")).toContain('aria-expanded="true"');
    expect(text(open)).toContain(passed);
  });

  it("S-015.4.10 shows following live, and paused", () => {
    const following = renderTranscript({ follow: true });
    expect(following).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*?Following live<\/button>/);
    const livePill = /<div [^>]*role="status"[^>]*>(.*?)<\/div>/s.exec(following)?.[1] ?? "";
    expect(text(livePill)).toBe("Live · new output appears at the bottom Pause");
    expect(livePill).toMatch(/<button[^>]*>Pause<\/button>/);

    const paused = renderTranscript({ follow: false });
    expect(paused).toMatch(/<button[^>]*aria-pressed="false"[^>]*>.*?Follow live<\/button>/);
    const pausedPill = /<div [^>]*role="status"[^>]*>(.*?)<\/div>/s.exec(paused)?.[1] ?? "";
    expect(text(pausedPill)).toBe("Paused Resume");
    expect(pausedPill).toMatch(/<button[^>]*>Resume<\/button>/);
  });

  it("S-015.4.11 lists the session's agents, covers, files and commits beside the transcript", () => {
    const html = renderTranscript();
    const agents = group(html, "Agents in this session");
    expect(agents).toMatch(/Main session 3m 56s/);
    expect(agents).toMatch(/test-runner running/);
    expect(agents).toMatch(/explorer done/);
    expect(group(html, "Covers")).toBe("Covers S-005.2.1 failing S-005.2.2 untested");
    expect(group(html, "Files")).toBe(
      "Files edited src/retry/policy.ts read src/retry/policy.test.ts",
    );
    expect(group(html, "Commits")).toBe("Commits None yet in this session");
  });

  it("S-015.4.12 lists the commits made in the session, newest first", () => {
    const html = renderTranscript({ claudeSession: "c1100", transcript: loaded([]) });
    const commits = group(html, "Commits");
    expect(commits).toContain("9f3c2e1 test(F-005): add red tests for retry exhaustion");
    const order = ["9f3c2e1", "6c0e3d8", "a41f2b9"].map((sha) => commits.indexOf(sha));
    expect(order.every((at) => at > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(group(html, "Covers")).toBe("Covers S-005.2.1 failing S-005.2.2 untested");
  });

  it("S-015.4.13 shows an empty state for snapshots and agents without a transcript", () => {
    const snapshot = text(renderRoute("#/agents/c1201", "export"));
    expect(snapshot).toContain("Transcripts are only available in the live viewer");
    expect(snapshot).toContain(
      "This is a read-only snapshot. Run azimuth view to follow agents live.",
    );

    const live = agentsLive();
    const explorer = live[0]?.agents.find((a) => a.agent_id === "a2");
    if (!explorer) throw new Error("No subagent a2 in c1201");
    explorer.transcript = false;
    const missing = text(renderRoute("#/agents/c1201/a2", "live", live));
    expect(missing).toContain("Transcripts are only available in the live viewer");
    expect(missing).toContain("No transcript was recorded for this agent.");
    expect(missing).not.toContain("read-only snapshot");
  });

  it("S-015.4.14 names unknown sessions and subagents", () => {
    expect(text(renderRoute("#/agents/c9", "live"))).toContain("No live session c9");
    expect(text(renderRoute("#/agents/c1201/a9", "live"))).toContain(
      "No subagent a9 in this session",
    );
  });

  it("S-015.4.15 notes skipped entries and a failed load and keeps the entries", () => {
    const transcript: TranscriptState = {
      ...loaded(),
      skipped: true,
      error: "No transcript recorded for agent a1.",
    };
    const html = renderTranscript({ transcript });
    const note = "Earlier entries aren't shown: this view starts in the transcript's last 512 KiB.";
    expect(text(html)).toContain(note);
    expect(text(html).indexOf(note)).toBeLessThan(text(html).indexOf("12:01:04 Build T-005.4"));
    const alert = /<[a-z]+ [^>]*role="alert"[^>]*>(.*?)<\/[a-z]+>/s.exec(html)?.[1] ?? "";
    expect(text(alert)).toBe("Couldn't load the transcript: No transcript recorded for agent a1.");
    // Nine entries and the now line.
    expect(items(html)).toHaveLength(10);
  });
});
