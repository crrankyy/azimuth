import type { ReactNode } from "react";
import type { Decision, Feature, Index, Issue, Question } from "../../../../src/core/types";
import { Eyebrow, SegmentBar } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { featureById, milestoneById, questionLook, taskById } from "../../data/selectors";
import { daysUntil, shortDate } from "../../lib/format";
import { href, routeForId } from "../../lib/router";
import {
  DECISION_LOOK,
  FEATURE_LOOK,
  ISSUE_LOOK,
  LIFECYCLE,
  MILESTONE_LOOK,
  type StatusLook,
} from "../../lib/status";
import { relatedDecisions, relatedIssues, relatedQuestions } from "./featureData";

function SmallPill({ look }: { look: StatusLook }) {
  return (
    <span className="az-pill fd-pill-sm">
      <StatusGlyph glyph={look.glyph} />
      {look.label}
    </span>
  );
}

/** Why a blocked feature is listed under "Blocks". */
function blockedNote(f: Feature, other: Feature): string {
  const parts: string[] = [];
  if (other.depends_on.includes(f.id) && f.status !== "done") parts.push("Waiting on this feature");
  if (other.derived.modified_since_approval) parts.push("modified since approval");
  if (other.derived.blocked_by.some((b) => b.kind === "question"))
    parts.push("blocked by a question");
  const text = parts.join(" · also ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function FeatureLink({ id, note }: { id: string; note?: string }) {
  const { index } = useIndexState();
  const other = index ? featureById(index, id) : undefined;
  return (
    <a className="fd-rail-feature" href={href("features", id)}>
      <span className="fd-rail-feature-row">
        <span className="az-id">{id}</span>
        <span className="fd-rail-feature-title">{other?.title ?? "Not in this index"}</span>
        {other && <SmallPill look={FEATURE_LOOK[other.status]} />}
      </span>
      {note && <span className="fd-rail-note">{note}</span>}
    </a>
  );
}

function RailItem({
  id,
  glyph,
  status,
  statusClass,
  title,
  muted,
}: {
  id: string;
  glyph: string;
  status: ReactNode;
  statusClass?: string;
  title: string;
  muted?: boolean;
}) {
  return (
    <a className="fd-rail-item" href={routeForId(id)}>
      <StatusGlyph glyph={glyph} style={{ marginTop: 4 }} />
      <span className="stack fd-rail-item-body">
        <span className="row fd-rail-item-head">
          <span className="az-id">{id}</span>
          <span className={statusClass ?? "fd-rail-status"}>{status}</span>
        </span>
        <span className={muted ? "fd-rail-title muted-title" : "fd-rail-title"}>{title}</span>
      </span>
    </a>
  );
}

function questionStatus(q: Question): string {
  if (q.status === "open") return `Open · ${q.blocking ? "blocking" : "not blocking"}`;
  if (q.status === "answered") return q.resolution ? `Answered → ${q.resolution.ref}` : "Answered";
  return "Obsolete";
}

function decisionStatus(index: Index, d: Decision): string {
  const label = DECISION_LOOK[d.status].label;
  if (d.status === "superseded" && d.superseded_by) return `${label} by ${d.superseded_by}`;
  if (d.status === "accepted" && d.supersedes) return `${label} · supersedes ${d.supersedes}`;
  const blocked = d.links.filter((id) => taskById(index, id)?.task.status === "blocked");
  if (d.status === "proposed" && blocked.length) return `${label} · blocks ${blocked.join(", ")}`;
  return label;
}

const isOpenIssue = (i: Issue) => i.status === "open" || i.status === "in-progress";
const isSevere = (i: Issue) =>
  isOpenIssue(i) && (i.severity === "high" || i.severity === "critical");
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function issueStatus(i: Issue): string {
  if (!isOpenIssue(i)) return ISSUE_LOOK[i.status].label;
  if (i.type === "risk") return `Likelihood ${i.likelihood ?? "?"} · impact ${i.impact ?? "?"}`;
  return i.severity ? capital(i.severity) : ISSUE_LOOK[i.status].label;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section className="fd-rail-sec">
      <div className="row fd-rail-sec-head">
        <Eyebrow>{title}</Eyebrow>
        {count && <span className="fd-rail-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function MilestoneCard({ f, index, now }: { f: Feature; index: Index; now: number }) {
  const m = f.milestone ? milestoneById(index, f.milestone) : undefined;
  if (!m) {
    return (
      <section className="az-card fd-rail-ms">
        <Eyebrow>Milestone</Eyebrow>
        <span className="fd-rail-note">Not planned into a milestone</span>
      </section>
    );
  }
  const counts = m.progress.by_status;
  const order = [...LIFECYCLE].sort((a, b) => (a === "done" ? -1 : b === "done" ? 1 : 0));
  const segments = order.flatMap((s) =>
    Array<string>(counts[s] ?? 0).fill(FEATURE_LOOK[s].segment),
  );
  const left = daysUntil(m.target, now);
  const target = m.released_at
    ? `Released ${shortDate(m.released_at)}`
    : m.target
      ? `Target ${shortDate(m.target)}${left === null ? "" : left >= 0 ? ` · ${left} days left` : ` · ${-left} days late`}`
      : "No target date";
  const summary = order
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${FEATURE_LOOK[s].label.toLowerCase()}`)
    .join(", ");
  return (
    <section className="az-card fd-rail-ms">
      <div className="row">
        <Eyebrow>Milestone</Eyebrow>
        <span className="spacer" />
        <SmallPill look={MILESTONE_LOOK[m.status]} />
      </div>
      <a className="fd-rail-ms-title" href={href("roadmap")}>
        <span className="az-id">{m.id}</span>
        <span>{m.title}</span>
      </a>
      <span className="fd-rail-ms-bar" role="img" aria-label={summary || "No features"}>
        <SegmentBar segments={segments} height={6} />
      </span>
      <div className="fd-rail-ms-foot">
        <span>
          {m.progress.done} of {m.progress.total} done
        </span>
        <span>{target}</span>
      </div>
    </section>
  );
}

/** Dependencies, blocked features, linked questions, decisions, issues and the milestone. */
export function FeatureRail({ f }: { f: Feature }) {
  const { index, now } = useIndexState();
  if (!index) return null;
  const questions = relatedQuestions(index, f);
  const decisions = relatedDecisions(index, f);
  const issues = relatedIssues(index, f);
  const openQuestions = questions.filter((q) => q.status === "open").length;
  const proposed = decisions.filter((d) => d.status === "proposed").length;
  return (
    <aside className="fd-rail" aria-label="Related">
      {f.depends_on.length > 0 && (
        <Section title="Depends on">
          {f.depends_on.map((id) => (
            <FeatureLink key={id} id={id} />
          ))}
        </Section>
      )}
      {f.derived.blocks.length > 0 && (
        <Section title="Blocks">
          {f.derived.blocks.map((id) => {
            const other = featureById(index, id);
            return (
              <FeatureLink key={id} id={id} note={other ? blockedNote(f, other) : undefined} />
            );
          })}
        </Section>
      )}
      {questions.length > 0 && (
        <Section title="Questions" count={openQuestions ? `${openQuestions} open` : undefined}>
          <div className="fd-rail-list">
            {questions.map((q) => (
              <RailItem
                key={q.id}
                id={q.id}
                glyph={questionLook(q).glyph}
                status={questionStatus(q)}
                statusClass={
                  q.status === "open" && q.blocking ? "fd-rail-status danger" : undefined
                }
                title={q.title}
                muted={q.status !== "open"}
              />
            ))}
          </div>
        </Section>
      )}
      {decisions.length > 0 && (
        <Section title="Decisions" count={proposed ? `${proposed} proposed` : undefined}>
          <div className="fd-rail-list">
            {decisions.map((d) => (
              <RailItem
                key={d.id}
                id={d.id}
                glyph={DECISION_LOOK[d.status].glyph}
                status={decisionStatus(index, d)}
                title={d.title}
                muted={d.status !== "proposed"}
              />
            ))}
          </div>
        </Section>
      )}
      {issues.length > 0 && (
        <Section title="Issues">
          <div className="fd-rail-list">
            {issues.map((i) => (
              <RailItem
                key={i.id}
                id={i.id}
                glyph={isSevere(i) ? "s-blocked" : ISSUE_LOOK[i.status].glyph}
                status={issueStatus(i)}
                statusClass={isSevere(i) ? "fd-rail-status danger" : undefined}
                title={i.title}
                muted={!isOpenIssue(i)}
              />
            ))}
          </div>
        </Section>
      )}
      <MilestoneCard f={f} index={index} now={now} />
    </aside>
  );
}
