import { useState } from "react";
import type { Decision, Index } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { Button, Eyebrow } from "../../components/primitives";
import { StatusGlyph, StatusPill } from "../../components/Status";
import { useAction } from "../../components/Ui";
import { useIndexState } from "../../data/IndexProvider";
import { describe, taskById } from "../../data/selectors";
import { dateTime, shortDate } from "../../lib/format";
import { Prose } from "../../lib/markdown";
import { routeForId } from "../../lib/router";
import { DECISION_LOOK } from "../../lib/status";
import { SupersessionChain } from "./SupersessionChain";

const SECTIONS = [
  ["Context", "context"],
  ["Options", "options"],
  ["Decision", "decision"],
  ["Consequences", "consequences"],
] as const;

/** The four body sections as one Markdown document, skipping empty ones. */
function adrMarkdown(d: Decision): string {
  return SECTIONS.filter(([, key]) => d.body[key].trim())
    .map(([title, key]) => `## ${title}\n\n${d.body[key].trim()}`)
    .join("\n\n");
}

/** An agent's accept or reject that you haven't reviewed yet. */
function needsReview(d: Decision): boolean {
  return (
    d.decided_by === "agent" &&
    !d.review_ack_at &&
    (d.status === "accepted" || d.status === "rejected")
  );
}

export function AdrView({ decision: d }: { decision: Decision }) {
  const { index, changed } = useIndexState();
  if (!index) return null;
  const body = adrMarkdown(d);
  return (
    <article className={`adr ${changed.has(d.id) ? "az-flash" : ""}`.trim()} aria-label={d.id}>
      <div className="adr-main">
        <header className="adr-head">
          <div className="adr-head-row">
            <span className="az-id lg adr-id">{d.id}</span>
            <StatusPill look={DECISION_LOOK[d.status]} />
            <AdrMeta index={index} decision={d} />
          </div>
          <h1 className="adr-title">{d.title}</h1>
        </header>
        {d.status === "proposed" && <DecideBar decision={d} />}
        {needsReview(d) && <AutoReviewBar decision={d} />}
        {d.decision_note && (
          <section aria-label="Decision note" className="az-card adr-bar note">
            <span className="adr-bar-label">
              {d.decided_by === "agent" ? "Agent's note" : "Your note"}
            </span>
            <span className="adr-bar-text">{d.decision_note}</span>
          </section>
        )}
        {body ? (
          <Prose text={body} options={{ terms: index.knowledge.glossary }} className="adr-prose" />
        ) : (
          <p className="muted">This ADR has no body yet.</p>
        )}
      </div>
      <aside className="adr-side" aria-label="Linked">
        <LinkedItems index={index} decision={d} />
        <SupersessionChain decision={d} />
        <section className="adr-section">
          <Eyebrow>File</Eyebrow>
          <span className="az-mono adr-file">{d.file}</span>
        </section>
      </aside>
    </article>
  );
}

function AdrMeta({ index, decision: d }: { index: Index; decision: Decision }) {
  const proposer = index.sessions.find((s) => s.raised.includes(d.id));
  const verb = d.status === "accepted" || d.status === "rejected" ? d.status : "decided";
  const decidedOn = d.decided_at ? shortDate(d.decided_at) : null;
  return (
    <span className="adr-meta">
      {shortDate(d.date)}
      {proposer && (
        <>
          {" · proposed by "}
          <a className="az-mono adr-meta-id" href={routeForId(proposer.id)}>
            {proposer.id}
          </a>
        </>
      )}
      {d.decided_by && (
        <>
          {` · ${verb} by ${d.decided_by === "you" ? "you" : "an agent"}`}
          {decidedOn && decidedOn !== shortDate(d.date) ? ` on ${decidedOn}` : ""}
        </>
      )}
    </span>
  );
}

/** "Your call": accept or reject a proposed ADR, with an optional note. */
function DecideBar({ decision: d }: { decision: Decision }) {
  const run = useAction();
  const { canAct, reason } = useCanAct();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "accepted" | "rejected") => {
    setBusy(true);
    const text = note.trim();
    const result = await run(
      "decide",
      d.id,
      text ? { decision, note: text } : { decision },
      d.status,
    );
    setBusy(false);
    if (result.ok) setNote("");
  };
  const title = reason ?? undefined;
  return (
    <section aria-label="Decide" className="az-card adr-bar">
      <span className="adr-bar-label">Your call</span>
      <input
        className="az-input adr-note"
        type="text"
        aria-label="Optional note"
        placeholder="Optional note for the agent"
        value={note}
        disabled={!canAct}
        title={title}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button disabled={!canAct || busy} title={title} onClick={() => decide("rejected")}>
        Reject
      </Button>
      <Button
        variant="primary"
        disabled={!canAct || busy}
        title={title}
        onClick={() => decide("accepted")}
      >
        Accept
      </Button>
    </section>
  );
}

/** An agent decided this ADR on its own (autonomy: auto); you acknowledge it or send it back. */
function AutoReviewBar({ decision: d }: { decision: Decision }) {
  const run = useAction();
  const { canAct, reason } = useCanAct();
  const [busy, setBusy] = useState(false);
  const act = async (action: "acknowledge" | "revert") => {
    setBusy(true);
    await run(action, d.id, undefined, action === "revert" ? d.status : undefined);
    setBusy(false);
  };
  const title = reason ?? undefined;
  return (
    <section aria-label="Review automatic decision" className="az-card adr-bar auto">
      <StatusGlyph glyph={DECISION_LOOK[d.status].glyph} />
      <span className="adr-bar-text">
        <b>{d.status === "accepted" ? "Accepted" : "Rejected"} automatically</b> by an agent
        {d.decided_at ? ` on ${dateTime(d.decided_at)}` : ""}. Acknowledge it, or move it back to
        proposed to make the call yourself.
      </span>
      <span className="adr-bar-actions">
        <Button disabled={!canAct || busy} title={title} onClick={() => act("revert")}>
          Move back to proposed
        </Button>
        <Button
          variant="primary"
          disabled={!canAct || busy}
          title={title}
          onClick={() => act("acknowledge")}
        >
          Acknowledge
        </Button>
      </span>
    </section>
  );
}

function LinkedItems({ index, decision: d }: { index: Index; decision: Decision }) {
  const linked = [...new Set([...d.links, ...d.resolves])];
  const referencing = [
    ...index.issues.filter((i) => i.links.includes(d.id)).map((i) => i.id),
    ...index.questions.filter((q) => q.resolution?.ref === d.id).map((q) => q.id),
  ].filter((id) => !linked.includes(id));
  return (
    <>
      <section className="adr-section">
        <Eyebrow>Linked</Eyebrow>
        {linked.length === 0 && <span className="adr-quiet">No linked items.</span>}
        {linked.map((id) => (
          <LinkedCard key={id} index={index} id={id} decision={d} />
        ))}
      </section>
      {referencing.length > 0 && (
        <section className="adr-section">
          <Eyebrow>Referenced by</Eyebrow>
          {referencing.map((id) => (
            <LinkedCard key={id} index={index} id={id} decision={d} />
          ))}
        </section>
      )}
    </>
  );
}

function LinkedCard({ index, id, decision: d }: { index: Index; id: string; decision: Decision }) {
  const summary = describe(index, id);
  const task = taskById(index, id)?.task;
  const waiting = d.status === "proposed" && task?.status === "blocked";
  return (
    <a className="adr-link" href={routeForId(id)} title={summary?.title}>
      <span className="adr-link-row">
        <span className="az-id">{id}</span>
        <span className="adr-link-title">{summary?.title ?? "Not in the index"}</span>
        {summary?.look?.glyph && (
          <StatusGlyph glyph={summary.look.glyph} label={summary.look.label} />
        )}
      </span>
      {d.resolves.includes(id) && <span className="adr-link-note">Resolved by this decision</span>}
      {waiting && <span className="adr-link-note">Blocked until this is decided</span>}
    </a>
  );
}
