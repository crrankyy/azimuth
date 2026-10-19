import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Session } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { IndexContext } from "../data/IndexProvider";
import { SessionCard } from "./SessionCard";
import { UiProvider } from "./Ui";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const index = structuredClone(expectedIndex) as unknown as Index;
const base = index.sessions[0] as Session;

function render(session: Session): string {
  const value = {
    index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <SessionCard session={session} expanded onToggle={() => undefined} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** Renders with the viewer in time zone `zone`, then restores the process's zone. */
function renderIn(zone: string, session: Session): string {
  const saved = process.env.TZ;
  process.env.TZ = zone;
  try {
    return render(session);
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
