import { useState } from "react";
import type { Index, Question } from "../../../src/core/types";
import { AnswerComposer, QuestionCard } from "../components/AnswerComposer";
import { Page } from "../components/AppShell";
import { IdChip } from "../components/IdChip";
import { Button, EmptyState, FlagBadge } from "../components/primitives";
import { StatusGlyph, StatusPill } from "../components/Status";
import { useUi } from "../components/Ui";
import { useIndexState } from "../data/IndexProvider";
import { describe, featureById, questionLook, sessionById } from "../data/selectors";
import { age, ago, clock, dateTime, localDay, shortDate } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { Markdown, Prose } from "../lib/markdown";
import { href, navigate, routeForId, type Route } from "../lib/router";
import { FEATURE_LOOK, QUESTION_LOOK } from "../lib/status";
import "./questions.css";

interface Group {
  label: string;
  items: Question[];
}

const byRaised = (a: Question, b: Question) => Date.parse(a.raised_at) - Date.parse(b.raised_at);
const byAnswered = (a: Question, b: Question) =>
  Date.parse(b.answer?.answered_at ?? b.raised_at) -
  Date.parse(a.answer?.answered_at ?? a.raised_at);

/** Open blocking first, then other open ones (oldest first), then answered (newest first). */
function groupQuestions(questions: Question[]): Group[] {
  const open = questions.filter((q) => q.status === "open").sort(byRaised);
  return [
    { label: "Open · blocking", items: open.filter((q) => q.blocking) },
    { label: "Open", items: open.filter((q) => !q.blocking) },
    {
      label: "Answered",
      items: questions.filter((q) => q.status === "answered").sort(byAnswered),
    },
    {
      label: "Obsolete",
      items: questions.filter((q) => q.status === "obsolete").sort(byAnswered),
    },
  ].filter((g) => g.items.length > 0);
}

/** "today 10:12" or "Oct 7, 10:40". */
function when(iso: string, now: number): string {
  const today = localDay(new Date(now).toISOString());
  return localDay(iso) === today ? `today ${clock(iso)}` : dateTime(iso);
}

/** What a blocking question holds up, worded like the CLI's inbox detail. */
function blockingText(index: Index, q: Question): string {
  if (!q.feature) return "nothing else can move until this is answered";
  const verb = featureById(index, q.feature)?.status === "draft" ? "be approved" : "move forward";
  return `${q.feature} can't ${verb} until this is answered`;
}

function listTag(q: Question): { text: string; danger?: boolean } {
  if (q.status === "open") {
    if (q.blocking) return { text: q.feature ? `Blocks ${q.feature}` : "Blocking", danger: true };
    return { text: q.feature ?? "" };
  }
  if (q.status === "obsolete") return { text: "Obsolete" };
  if (!q.resolution) return { text: "Waiting for an agent" };
  return {
    text:
      q.resolution.kind === "adr"
        ? `Applied as ${q.resolution.ref}`
        : `Applied as an assumption in ${q.resolution.ref}`,
  };
}

export function QuestionsScreen({ route }: { route: Route }) {
  const { index, now, changed } = useIndexState();
  const { problemsOpen } = useUi();
  const groups = index ? groupQuestions(index.questions) : [];
  const ordered = groups.flatMap((g) => g.items);
  const current = route.id ? ordered.find((q) => q.id === route.id) : ordered[0];
  const cursor = current ? ordered.indexOf(current) : 0;

  useListKeys({
    count: ordered.length,
    selected: cursor,
    onSelect: (i) => {
      const q = ordered[i];
      if (q) navigate(href("questions", q.id));
    },
    onOpen: () => focusFirst([".q-main input[type=radio]:checked", ".q-main input[type=radio]"]),
    onPrimary: () => focusFirst([".q-main textarea"]),
    // The Problems panel has its own j/k list.
    enabled: !problemsOpen,
  });

  if (!index) return null;
  const crumbs = [
    { label: "Questions", href: href("questions") },
    ...(current || route.id
      ? [{ label: <span className="crumb-id">{current?.id ?? route.id}</span> }]
      : []),
  ];
  const open = index.questions.filter((q) => q.status === "open").length;
  const answered = index.questions.filter((q) => q.status === "answered").length;

  return (
    <Page crumbs={crumbs} flush>
      <div className="questions">
        <aside aria-label="Question list" className="q-list">
          <div className="q-list-head">
            <h1>Questions</h1>
            <span className="count">
              {open} open · {answered} answered
            </span>
          </div>
          {groups.map((g) => (
            <section key={g.label} className="q-group">
              <div className="az-eyebrow">{g.label}</div>
              {g.items.map((q) => (
                <QuestionListItem
                  key={q.id}
                  q={q}
                  now={now}
                  selected={q === current}
                  flash={changed.has(q.id)}
                />
              ))}
            </section>
          ))}
          {groups.length === 0 && (
            <p className="q-list-empty">
              Agents raise questions here when they can't safely guess.
            </p>
          )}
        </aside>
        {current ? (
          <QuestionDetail key={current.id} index={index} q={current} now={now} />
        ) : (
          <div className="q-detail">
            <div className="q-main">
              <EmptyState title={route.id ? `${route.id} doesn't exist` : "No questions yet"}>
                {route.id
                  ? "It may have been renamed or removed. Pick a question from the list."
                  : "When an agent can't safely decide something, it asks here and waits for you."}
              </EmptyState>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

/** Focuses the first selector that matches (Enter / `a` from the list keys). */
function focusFirst(selectors: string[]): void {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el.focus();
  }
}

function QuestionListItem({
  q,
  now,
  selected,
  flash,
}: {
  q: Question;
  now: number;
  selected: boolean;
  flash: boolean;
}) {
  const look = questionLook(q);
  const tag = listTag(q);
  const cls = ["q-item", q.status !== "open" && "closed", flash && "az-flash"]
    .filter(Boolean)
    .join(" ");
  return (
    <a className={cls} href={href("questions", q.id)} aria-current={selected ? "true" : undefined}>
      <span className="q-item-meta">
        <StatusGlyph glyph={look.glyph} label={look.label} />
        <span className="q-item-id">{q.id}</span>
        {tag.text && <span className={`q-item-tag ${tag.danger ? "danger" : ""}`}>{tag.text}</span>}
        <span className="q-item-age" title={dateTime(q.answer?.answered_at ?? q.raised_at)}>
          {q.answer ? shortDate(q.answer.answered_at) : age(q.raised_at, now)}
        </span>
      </span>
      <span className="q-item-title">{q.title}</span>
    </a>
  );
}

function QuestionDetail({ index, q, now }: { index: Index; q: Question; now: number }) {
  const session = q.raised_by === "you" ? undefined : sessionById(index, q.raised_by);
  const pill = q.status === "open" ? QUESTION_LOOK.open : questionLook(q);
  const titleId = `q-title-${q.id}`;
  return (
    <article aria-labelledby={titleId} className="q-detail">
      <div className="q-main">
        <header className="q-head">
          <div className="q-chips">
            <IdChip id={q.id} large />
            <StatusPill look={pill} />
            {q.status === "open" && q.blocking && (
              <FlagBadge tone="danger">
                <StatusGlyph glyph="s-blocked" />
                <span>
                  <b>Blocking:</b> {blockingText(index, q)}
                </span>
              </FlagBadge>
            )}
          </div>
          <h2 id={titleId} className="q-title">
            {q.title}
          </h2>
          <div className="q-meta">
            Raised by{" "}
            {q.raised_by === "you" || q.raised_by === "agent" ? (
              q.raised_by === "you" ? (
                "you"
              ) : (
                "an agent"
              )
            ) : (
              <>
                <a href={routeForId(q.raised_by)}>{q.raised_by}</a>
                {session?.skill ? ` (${session.skill})` : ""}
              </>
            )}{" "}
            · <span title={dateTime(q.raised_at)}>{when(q.raised_at, now)}</span> ·{" "}
            {ago(q.raised_at, now)}
          </div>
        </header>
        {q.context.trim() && (
          <section className="q-section">
            <h3 className="az-eyebrow">Why the agent couldn't decide</h3>
            <Prose text={q.context} />
          </section>
        )}
        {q.status === "open" ? <AnswerComposer question={q} /> : <AnsweredView q={q} now={now} />}
      </div>
      <QuestionAside index={index} q={q} />
    </article>
  );
}

/**
 * An answered (or obsolete) question: the options as they were, the answer, and its state. An
 * agent's answer offers "Answer differently", which opens the full answer form below it.
 */
function AnsweredView({ q, now }: { q: Question; now: number }) {
  const answer = q.answer;
  const byAgent = answer?.by === "agent";
  // An obsolete question needs no answer, not even a different one.
  const overrulable = byAgent && q.status === "answered";
  const [overruling, setOverruling] = useState(false);
  return (
    <>
      {q.options.length > 0 && (
        <section className="q-section">
          <h3 className="az-eyebrow">Options</h3>
          <div className="qcards">
            {q.options.map((o) => (
              <QuestionCard
                key={o.key}
                name={`answered-${q.id}`}
                option={o}
                checked={answer?.option === o.key}
                readOnly
                badge={
                  answer?.option === o.key ? (
                    <span className="qcard-tag">{byAgent ? "Agent's answer" : "Your answer"}</span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
      <section aria-label="Answer" className="az-card q-answered">
        {answer ? (
          <>
            <div className="q-answered-head">
              <span className="answer-label">
                {byAgent ? "Answered by an agent with its recommendation" : "Your answer"}
              </span>
              <span className="q-answered-when" title={dateTime(answer.answered_at)}>
                {when(answer.answered_at, now)}
              </span>
            </div>
            {answer.text.trim() ? (
              <Prose text={answer.text} className="q-answered-text" />
            ) : (
              <div className="q-answered-text muted">No note; the chosen option is the answer.</div>
            )}
            <ResolutionState q={q} />
            {overrulable && !overruling && (
              <div className="q-overrule">
                <Button onClick={() => setOverruling(true)}>Answer differently</Button>
              </div>
            )}
          </>
        ) : (
          <div className="q-state">
            <StatusGlyph glyph="s-muted" />
            <span>Obsolete. Nothing to answer.</span>
          </div>
        )}
      </section>
      {overrulable && overruling && (
        <AnswerComposer
          question={q}
          autoFocus
          onCancel={() => setOverruling(false)}
          onSent={() => setOverruling(false)}
        />
      )}
    </>
  );
}

function ResolutionState({ q }: { q: Question }) {
  if (!q.resolution) {
    return (
      <div className="q-state" role="status">
        <StatusGlyph glyph="s-verifying" />
        <span>Waiting for an agent to apply this</span>
      </div>
    );
  }
  return (
    <div className="q-state">
      <StatusGlyph glyph="s-done" />
      <span>
        {q.resolution.kind === "adr" ? "Applied as " : "Applied as an assumption in "}
        <IdChip id={q.resolution.ref} />
      </span>
    </div>
  );
}

function QuestionAside({ index, q }: { index: Index; q: Question }) {
  const feature = q.feature ? featureById(index, q.feature) : undefined;
  const links = q.links.filter((id) => id !== q.feature);
  const session = q.raised_by === "you" ? undefined : sessionById(index, q.raised_by);
  const blocked = q.status === "open" && q.blocking;
  return (
    <aside aria-label="Linked items" className="q-aside">
      {q.feature && (
        <section className="q-aside-section">
          <div className="az-eyebrow">Raised for</div>
          <a className="raised-for" href={routeForId(q.feature)}>
            <span className="row">
              <span className="az-id">{q.feature}</span>
              {feature && <StatusPill look={FEATURE_LOOK[feature.status]} />}
            </span>
            {feature && <span className="title">{feature.title}</span>}
            {q.status === "open" && (
              <span className={`note ${blocked ? "danger" : ""}`.trim()}>
                {!blocked
                  ? "Not blocked by this question"
                  : feature?.status === "draft"
                    ? "Approval blocked by this question"
                    : "Blocked by this question"}
              </span>
            )}
          </a>
        </section>
      )}
      {links.length > 0 && (
        <section className="q-aside-section">
          <div className="az-eyebrow">Context links</div>
          {links.map((id) => {
            const summary = describe(index, id);
            return (
              <a key={id} className="context-link" href={routeForId(id)}>
                <span className="az-id">{id}</span>
                <span className="title">{summary?.title ?? ""}</span>
                {summary?.look && (
                  <StatusGlyph glyph={summary.look.glyph} label={summary.look.label} />
                )}
              </a>
            );
          })}
        </section>
      )}
      {session?.handoff.trim() && (
        <section className="q-aside-section">
          <div className="az-eyebrow">Agent handoff</div>
          <div className="q-handoff">
            <Markdown text={session.handoff} />
          </div>
        </section>
      )}
    </aside>
  );
}
