import type { Index } from "../../../../src/core/types";

/** One line of the Overview's recent-activity card. */
export interface ActivityLine {
  at: string;
  /** Status glyph class, or "commit" for the hollow commit dot. */
  glyph: string;
  lead: string;
  id: string;
  rest: string;
  kind: string;
}

const firstSentence = (text: string) =>
  (text.replace(/`/g, "").split(/(?<=\.)\s/)[0] ?? "").replace(/\.$/, "").trim();

/** Sessions, runs, commits, questions and decisions, newest first. */
export function recentActivity(index: Index, limit: number): ActivityLine[] {
  const lines: ActivityLine[] = [];
  for (const s of index.sessions) {
    const kind = s.skill ?? s.agent;
    if (s.ended_at) {
      const summary = firstSentence(s.summary);
      lines.push({
        at: s.ended_at,
        glyph: "s-done",
        lead: "Session",
        id: s.id,
        rest: summary ? `ended · ${summary}` : "ended",
        kind,
      });
    } else {
      lines.push({
        at: s.started_at,
        glyph: "s-active",
        lead: "Session",
        id: s.id,
        rest: `started · ${s.goal}`,
        kind,
      });
    }
  }
  for (const r of index.runs) {
    lines.push({
      at: r.at,
      glyph: r.ok ? "s-done" : "s-failing",
      lead: "Run",
      id: r.id,
      rest: `${r.ok ? "passed" : "failed"} on ${r.target}`,
      kind: "verify",
    });
  }
  for (const c of index.commits) {
    lines.push({ at: c.at, glyph: "commit", lead: "", id: c.sha, rest: c.subject, kind: "commit" });
  }
  for (const q of index.questions) {
    const who = q.raised_by === "you" ? "You raised" : "Agent raised";
    const blocking = q.blocking && q.feature ? `(blocking ${q.feature})` : null;
    lines.push({
      at: q.raised_at,
      glyph: q.blocking ? "s-blocked" : "s-open",
      lead: who,
      id: q.id,
      rest: blocking ?? q.title,
      kind: "question",
    });
    if (q.answer) {
      lines.push({
        at: q.answer.answered_at,
        glyph: "s-verifying",
        lead: "You answered",
        id: q.id,
        rest: q.title,
        kind: "question",
      });
    }
  }
  const proposedAt = new Map(
    index.inbox.flatMap((i) => (i.kind === "review-adr" && i.ref ? [[i.ref, i.since]] : [])),
  );
  for (const d of index.decisions) {
    if (d.status === "proposed") {
      lines.push({
        at: proposedAt.get(d.id) ?? d.date,
        glyph: "s-proposed",
        lead: "Agent proposed",
        id: d.id,
        rest: d.title,
        kind: "decision",
      });
    } else if (d.decided_at && (d.status === "accepted" || d.status === "rejected")) {
      const verb = d.status === "accepted" ? "accepted" : "rejected";
      lines.push({
        at: d.decided_at,
        glyph: d.status === "accepted" ? "s-done" : "s-muted",
        lead: d.decided_by === "agent" ? `Auto-${verb}` : `You ${verb}`,
        id: d.id,
        rest: d.title,
        kind: "decision",
      });
    }
  }
  const time = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return lines.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}
