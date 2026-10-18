import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Question, QuestionOption } from "../../../src/core/types";
import { useCanAct } from "./AppShell";
import { Button, Kbd } from "./primitives";
import { useAction } from "./Ui";
import "./answer.css";

/** The compass needle that marks the agent's recommendation. */
function Needle() {
  return (
    <svg width="10" height="10" viewBox="0 0 20 20" aria-hidden="true">
      <path className="needle" d="M10 2 L13 10 L10 18 L7 10 Z" />
    </svg>
  );
}

function RecommendedTag({ compact }: { compact: boolean }) {
  if (compact) return <span className="qcard-tag">Recommended</span>;
  return (
    <span className="qcard-tag rec">
      <Needle />
      Agent recommends
    </span>
  );
}

/**
 * One option of a question as a radio card. `compact` is the Inbox grid layout; the full layout
 * is the Questions detail. Clicking the checked card again clears the choice, so an answer can
 * be text only.
 */
export function QuestionCard({
  name,
  option,
  checked,
  onToggle,
  compact = false,
  readOnly = false,
  badge,
}: {
  name: string;
  option: QuestionOption;
  checked: boolean;
  onToggle?: (key: string | null) => void;
  compact?: boolean;
  readOnly?: boolean;
  badge?: ReactNode;
}) {
  const cls = ["qcard", compact && "compact", checked && "on", readOnly && "readonly"]
    .filter(Boolean)
    .join(" ");
  // A read-only card (an answered question) shows a static mark instead of a disabled radio.
  const Box = readOnly ? "div" : "label";
  const input = readOnly ? (
    <span className={`qcard-mark ${checked ? "on" : ""}`.trim()} aria-hidden="true" />
  ) : (
    <input
      type="radio"
      name={name}
      value={option.key}
      checked={checked}
      onChange={() => onToggle?.(option.key)}
      onClick={() => checked && onToggle?.(null)}
    />
  );
  const tags = (
    <>
      {option.recommended && <RecommendedTag compact={compact} />}
      {badge}
    </>
  );
  if (compact) {
    return (
      <Box className={cls}>
        <span className="qcard-top">
          {input}
          <span className="qcard-name">
            <span className="qcard-label">{option.label}</span>
            {tags}
          </span>
        </span>
        {option.detail && <span className="qcard-detail">{option.detail}</span>}
      </Box>
    );
  }
  return (
    <Box className={cls}>
      {input}
      <span className="qcard-body">
        <span className="qcard-head">
          <span className="qcard-label">{option.label}</span>
          {tags}
        </span>
        {option.detail && <span className="qcard-detail">{option.detail}</span>}
      </span>
    </Box>
  );
}

const recommendedKey = (q: Question): string | null =>
  q.options.find((o) => o.recommended)?.key ?? null;

/**
 * Pick an option and/or write an answer, then send it (⌘↵ / Ctrl-↵ from anywhere inside).
 * `compact` renders the Inbox's inline form; the default renders the Questions detail's Options
 * section and answer card. Key it by question ID so the draft resets between questions.
 */
export function AnswerComposer({
  question,
  compact = false,
  autoFocus = false,
  onOpen,
  onCancel,
  onSent,
}: {
  question: Question;
  compact?: boolean;
  autoFocus?: boolean;
  /** Shows "Open question" (compact only). */
  onOpen?: () => void;
  /** Esc inside the composer. */
  onCancel?: () => void;
  onSent?: () => void;
}) {
  const run = useAction();
  const { canAct, reason } = useCanAct();
  const [option, setOption] = useState<string | null>(() => recommendedKey(question));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const textId = useId();

  useEffect(() => {
    if (!autoFocus) return;
    const root = box.current;
    const target =
      root?.querySelector<HTMLInputElement>("input[type=radio]:checked") ??
      root?.querySelector<HTMLInputElement>("input[type=radio]") ??
      root?.querySelector<HTMLElement>("input, textarea");
    target?.focus();
  }, [autoFocus]);

  const blocked = !canAct
    ? reason
    : option === null && !text.trim()
      ? "Pick an option or write an answer"
      : null;

  const send = async () => {
    if (blocked || busy) return;
    setBusy(true);
    const result = await run("answer", question.id, { option, text: text.trim() }, "open");
    setBusy(false);
    if (result.ok) onSent?.();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
      return;
    }
    if (e.key === "Escape" && onCancel) {
      e.stopPropagation();
      onCancel();
    }
  };

  const name = `answer-${question.id}`;
  const cards = question.options.map((o) => (
    <QuestionCard
      key={o.key}
      name={name}
      option={o}
      checked={option === o.key}
      onToggle={setOption}
      compact={compact}
    />
  ));
  const sendButton = (
    <Button
      variant="primary"
      disabled={Boolean(blocked) || busy}
      title={blocked ?? undefined}
      onClick={() => void send()}
    >
      {busy ? "Sending…" : "Send answer"}
    </Button>
  );

  if (compact) {
    return (
      <div ref={box} className="answer-inline" onKeyDown={onKeyDown}>
        {cards.length > 0 && (
          <div
            role="radiogroup"
            aria-label={`Options for ${question.id}`}
            className="qcards-grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(3, cards.length)}, minmax(0, 1fr))`,
            }}
          >
            {cards}
          </div>
        )}
        <div className="answer-inline-row">
          <input
            className="az-input"
            type="text"
            aria-label="Add a note"
            placeholder="Add a note for the agent (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {onOpen && (
            <Button variant="tertiary" onClick={onOpen}>
              Open question
            </Button>
          )}
          {sendButton}
          <Kbd>⌘↵</Kbd>
        </div>
      </div>
    );
  }

  return (
    <div ref={box} className="answer-composer" onKeyDown={onKeyDown}>
      {cards.length > 0 && (
        <section className="answer-options">
          <div className="answer-options-head">
            <h2 className="az-eyebrow">Options</h2>
            <span className="hint">Pick one, add your own words, or both</span>
          </div>
          <div role="radiogroup" aria-label="Options" className="qcards">
            {cards}
          </div>
        </section>
      )}
      <section aria-label="Answer" className="az-card answer-card">
        <label htmlFor={textId} className="answer-label">
          Your answer
        </label>
        <textarea
          id={textId}
          className="az-input"
          rows={3}
          placeholder={
            cards.length > 0
              ? "Add reasoning or a different answer (optional)"
              : "Write your answer for the agent"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="answer-foot">
          <span className="answer-note">
            Writes <span className="az-mono">{question.file}</span>. The next agent run applies it
            as an assumption or an ADR.
          </span>
          {sendButton}
          <Kbd>⌘↵</Kbd>
        </div>
      </section>
    </div>
  );
}
