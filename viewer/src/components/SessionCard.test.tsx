import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Session } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { FIXTURE_NOW, fixtureIndex, timelineLive } from "../../../test/fixtures/live/timeline";
import { IndexContext } from "../data/IndexProvider";
import type { ActivityKind } from "../screens/activity/feed";
import { activityData } from "../screens/activity/sessions";
import { sessionThreads, type SessionThread } from "../screens/activity/thread";
import { SessionCard } from "./SessionCard";
import { UiProvider } from "./Ui";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const index = structuredClone(expectedIndex) as unknown as Index;
const base = index.sessions[0] as Session;

const ALL_KINDS: ReadonlySet<ActivityKind> = new Set([
  "session",
  "subagent",
  "commit",
  "run",
  "action",
]);

/** The thread sessionThreads gives the session `id` of `shown` at `now`. */
function threadOf(shown: Index, id: string, now: number): SessionThread {
  const data = activityData(shown, now);
  const thread = sessionThreads(shown, data, { now, kinds: ALL_KINDS }).get(id);
  if (!thread) throw new Error(`No thread for ${id}`);
  return thread;
}

function sessionOf(shown: Index, id: string): Session {
  const session = shown.sessions.find((s) => s.id === id);
  if (!session) throw new Error(`No session ${id}`);
  return session;
}

interface RenderOptions {
  /** The index the card reads; the sample index by default. */
  index?: Index;
  now?: number;
  /** The session's thread in `index` at `now` by default. */
  thread?: SessionThread;
  expanded?: boolean;
  dated?: boolean;
}

function render(session: Session, options: RenderOptions = {}): string {
  const { index: shown = index, now = NOW, expanded = true, dated = false } = options;
  const thread = options.thread ?? threadOf(shown, session.id, now);
  const value = {
    index: shown,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: now,
    changed: new Set<string>(),
    now,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <SessionCard
          session={session}
          thread={thread}
          expanded={expanded}
          dated={dated}
          onToggle={() => undefined}
        />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** Renders with the viewer in time zone `zone`, then restores the process's zone. */
function renderIn(zone: string, session: Session, options: RenderOptions = {}): string {
  const saved = process.env.TZ;
  process.env.TZ = zone;
  try {
    return render(session, options);
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

/** The text of the section with this aria-label, without markup; "" when there is none. */
function sectionText(html: string, label: string): string {
  const match = new RegExp(`<section [^>]*aria-label="${label}"[^>]*>(.*?)</section>`).exec(html);
  return (match?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Markup without tags, spaces collapsed. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The first element's markup with this class (no nested element of the same tag). */
function elementWith(html: string, tag: string, cls: string): string {
  const match = new RegExp(`<${tag} [^>]*class="${cls}"[^>]*>.*?</${tag}>`).exec(html);
  return match?.[0] ?? "";
}

/** fixtureIndex() with c1100's main transcript served. */
function withTranscript(): Index {
  return fixtureIndex(
    timelineLive().map((l) =>
      l.claude_session === "c1100" ? { ...l, main: { ...l.main, transcript: true } } : l,
    ),
  );
}

describe("F-011 session cards show goals and notes", () => {
  it("S-011.6.3 shows the goals and then the notes after the handoff", () => {
    // In UTC the local times are the times as written.
    const html = renderIn("UTC", {
      ...base,
      handoff: "Build T-011.3 next.",
      goals: "- 10:15 · build · Build F-011",
      notes: "- 10:30 · T-011.2 green",
    });
    expect(sectionText(html, "Goals")).toContain("10:15 · build · Build F-011");
    expect(sectionText(html, "Notes")).toContain("10:30 · T-011.2 green");
    const handoff = html.indexOf('aria-label="Handoff to the next session"');
    const goals = html.indexOf('aria-label="Goals"');
    const notes = html.indexOf('aria-label="Notes"');
    expect(handoff).toBeGreaterThan(-1);
    expect(goals).toBeGreaterThan(handoff);
    expect(notes).toBeGreaterThan(goals);
  });

  it("S-011.6.3 shows goal and note times in the viewer's local time, as the header does", () => {
    const html = renderIn("Asia/Kolkata", {
      ...base,
      started_at: "2026-10-20T09:00:00Z",
      goals: "- 10:15 · build · Build F-011",
      notes: "- 10:30 · T-011.2 green",
    });
    expect(sectionText(html, "Goals")).toBe("Goals 15:45 · build · Build F-011");
    expect(sectionText(html, "Notes")).toBe("Notes 16:00 · T-011.2 green");
  });

  it("S-011.6.3 puts a bullet earlier than the start's UTC time on the next UTC day", () => {
    // Started Oct 31 at 16:30 PDT; 10:15 UTC is then Nov 1, after the switch to PST (UTC-8).
    const html = renderIn("America/Los_Angeles", {
      ...base,
      started_at: "2026-10-31T23:30:00Z",
      goals: "- 23:45 · spec · Spec F-012\n- 10:15 · build · Build F-011",
      notes: "",
    });
    expect(sectionText(html, "Goals")).toBe(
      "Goals 16:45 · spec · Spec F-012 02:15 · build · Build F-011",
    );
  });

  it("S-011.6.4 shows neither without goals or notes", () => {
    const html = render({ ...base, goals: "", notes: "" });
    expect(html).not.toContain('aria-label="Goals"');
    expect(html).not.toContain('aria-label="Notes"');
  });
});

describe("F-016 session cards show the session's thread", () => {
  const live = fixtureIndex();
  const fixtureOptions = { index: live, now: FIXTURE_NOW };

  it("S-016.6.5 shows the thread, the subagent count and who picked up the handoff", () => {
    const html = renderIn("UTC", sessionOf(live, "SES-20261018-1100"), fixtureOptions);
    expect(html).toContain("11:00–11:58 · 58m · 1 subagent");
    const heading = textOf(elementWith(html, "div", "ses-handoff-title"));
    expect(heading).toContain("picked up by");
    expect(heading).toContain("SES-20261018-1201");
    expect(heading).toContain("at 12:01");
    const thread = /<dt[^>]*>Thread<\/dt><dd[^>]*><ol class="ses-thread">(.*?)<\/ol>/.exec(html);
    expect(thread?.[1]?.match(/<li[ >]/g)).toHaveLength(9);
    expect(html).toContain("R-0142 failed · 2.1 s");
    expect(html).toContain("map retry call sites");
    expect(thread?.[1]).toContain(">4m<");
    expect(html).toMatch(/<dt[^>]*>Touched<\/dt>/);
    expect(html).not.toMatch(/<dt[^>]*>Raised<\/dt>/);
    expect(html).not.toMatch(/<dt[^>]*>Commits<\/dt>/);
  });

  it("S-016.6.6 tallies a collapsed card's commits, runs and raised items", () => {
    const collapsed = { ...fixtureOptions, expanded: false };
    const today = renderIn("UTC", sessionOf(live, "SES-20261018-1100"), collapsed);
    expect(textOf(today)).toContain("11:00–11:58 · 3 commits · 3 runs (1 failed) · raised");
    expect(today).toMatch(/<a class="az-id"[^>]*>Q-0002<\/a>/);
    expect(today).toMatch(/<a class="az-id"[^>]*>ADR-0004<\/a>/);
    expect(today).toMatch(/class="az-g s-done"[^>]*aria-label="Done"/);

    const yesterday = renderIn("UTC", sessionOf(live, "SES-20261017-1430"), collapsed);
    expect(textOf(yesterday)).toContain("14:30–16:45 · 2 commits · 2 runs (1 failed) · raised");
    expect(yesterday).toMatch(/<a class="az-id"[^>]*>DEBT-0001<\/a>/);

    const earlier = renderIn("UTC", sessionOf(live, "SES-20261016-1320"), {
      ...collapsed,
      dated: true,
    });
    expect(textOf(earlier)).toContain("Oct 16, 13:20–13:40 · 1 commit");
    expect(earlier).toContain("Changed an approved spec");
  });

  it("S-016.6.7 links the header to the transcript only while it can be served", () => {
    const served = withTranscript();
    const withLink = renderIn("UTC", sessionOf(served, "SES-20261018-1100"), {
      index: served,
      now: FIXTURE_NOW,
    });
    expect(elementWith(withLink, "div", "ses-head")).toMatch(
      /<a [^>]*href="#\/agents\/c1100"[^>]*>Transcript<\/a>/,
    );
    const without = renderIn("UTC", sessionOf(live, "SES-20261018-1100"), fixtureOptions);
    expect(elementWith(without, "div", "ses-head")).not.toBe("");
    expect(elementWith(without, "div", "ses-head")).not.toContain("Transcript");
  });
});
