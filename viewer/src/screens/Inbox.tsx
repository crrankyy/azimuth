import { Fragment, useState, type ReactNode } from "react";
import type {
  Feature,
  Index,
  InboxItem as Item,
  InboxKind,
  Urgency,
} from "../../../src/core/types";
import { idKind } from "../../../src/core/ids";
import { AnswerComposer } from "../components/AnswerComposer";
import { Hint, Page, useCanAct } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { IdChip } from "../components/IdChip";
import { Button, EmptyState } from "../components/primitives";
import { StatusGlyph } from "../components/Status";
import { Dialog, useAction, useUi } from "../components/Ui";
import { useIndexState } from "../data/IndexProvider";
import { decisionById, featureById, questionById } from "../data/selectors";
import { age, ago, dateTime, plural, shortDate } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { inline, Markdown } from "../lib/markdown";
import { href, navigate, routeForId, type Route } from "../lib/router";
import { FEATURE_LOOK } from "../lib/status";
import { ApproveDialog, ReapproveDialog } from "./feature/ActionDialogs";
import "./inbox.css";

const URGENCIES: { level: Urgency; label: string }[] = [
  { level: "high", label: "High" },
  { level: "normal", label: "Normal" },
  { level: "low", label: "Low" },
];

/** A 16px stroke icon drawn here because Icon.tsx doesn't have it. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

interface KindLook {
  icon: ReactNode;
  tone: string;
  action: string;
  /** The primary action writes files, so it is disabled when the viewer can't act. */
  writes: boolean;
}

const KINDS: Record<InboxKind, KindLook> = {
  "answer-question": {
    icon: <Icon name="questions" size={15} />,
    tone: "",
    action: "Answer",
    writes: false,
  },
  "failing-verify": {
    icon: <Icon name="shieldX" size={15} />,
    tone: "tone-red",
    action: "Open run",
    writes: false,
  },
  "reapprove-spec": {
    icon: (
      <Glyph>
        <path d="M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11" />
        <path d="M3.3 2.5v2.8h2.8M12.7 13.5v-2.8H9.9" />
      </Glyph>
    ),
    tone: "tone-yellow",
    action: "Re-approve",
    writes: true,
  },
  "approve-spec": {
    icon: <Icon name="checkCircle" size={15} />,
    tone: "tone-green",
    action: "Approve…",
    writes: true,
  },
  "review-adr": {
    icon: <Icon name="doc" size={15} />,
    tone: "tone-purple",
    action: "Review",
    writes: false,
  },
  stale: {
    icon: (
      <Glyph>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.8V8l2.2 1.6" />
      </Glyph>
    ),
    tone: "tone-yellow",
    action: "Open",
    writes: false,
  },
  "check-errors": {
    icon: <Icon name="issues" size={15} />,
    tone: "tone-red",
    action: "Show problems",
    writes: false,
  },
  "review-auto": {
    icon: (
      <Glyph>
        <path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" />
        <circle cx="8" cy="8" r="2" />
      </Glyph>
    ),
    tone: "tone-blue",
    action: "Acknowledge",
    writes: true,
  },
};

const itemKey = (item: Item) => `${item.kind}:${item.ref ?? ""}`;

/** Display order: urgency groups top to bottom, keeping the CLI's order inside each group. */
const ordered = (inbox: Item[]) =>
  URGENCIES.flatMap(({ level }) => inbox.filter((i) => i.urgency === level));

/** Whether keyboard focus sits on a control that handles Enter itself. */
const controlFocused = () =>
  document.activeElement instanceof HTMLElement &&
  document.activeElement.closest("button, a, input, textarea, select, label") !== null;

/** The newest failing verify run for a feature's tasks. */
function failingRunHref(index: Index, featureId: string): string {
  const prefix = `T-${featureId.slice(2)}.`;
  const run = index.runs
    .filter((r) => !r.ok && (r.target === featureId || r.target.startsWith(prefix)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  return run ? routeForId(run.id) : href("verification");
}

/** Three bars, lit up to the urgency level. */
function UrgencySignal({ level }: { level: Urgency }) {
  const lit = level === "high" ? 3 : level === "normal" ? 2 : 1;
  const bars = [
    { x: 0, y: 7, h: 5 },
    { x: 5, y: 3.5, h: 8.5 },
    { x: 10, y: 0, h: 12 },
  ];
  return (
    <svg
      className={`signal ${level}`}
      width="14"
      height="12"
      viewBox="0 0 14 12"
      aria-hidden="true"
    >
      {bars.map((b, i) => (
        <rect
          key={b.x}
          className={i < lit ? "on" : undefined}
          x={b.x}
          y={b.y}
          width="3"
          height={b.h}
          rx="1"
        />
      ))}
    </svg>
  );
}

export function InboxScreen({ route: _route }: { route: Route }) {
  const { index } = useIndexState();
  if (!index) return null;
  return <Inbox index={index} />;
}

type DialogState = { kind: "approve" | "reapprove" | "send-back"; ref: string };

function Inbox({ index }: { index: Index }) {
  const { now, changed } = useIndexState();
  const { problemsOpen, setProblemsOpen } = useUi();
  const { canAct } = useCanAct();
  const run = useAction();
  const items = ordered(index.inbox);
  // Items present when the screen opened; anything after that is marked "new".
  const [seen] = useState(() => new Set(index.inbox.map(itemKey)));
  // The selection follows an item, not a row: live updates add and remove rows above it.
  const [selection, setSelection] = useState(() => ({
    key: items[0] ? itemKey(items[0]) : null,
    at: 0,
  }));
  const [expanded, setExpanded] = useState<string | null>(() => {
    const first = ordered(index.inbox)[0];
    return first?.kind === "answer-question" ? itemKey(first) : null;
  });
  const [autoFocus, setAutoFocus] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const found = items.findIndex((item) => itemKey(item) === selection.key);
  // When the selected item itself is gone, its neighbour at the same position takes over...
  const cursor = found >= 0 ? found : Math.min(selection.at, Math.max(0, items.length - 1));
  const heir = found < 0 ? items[cursor] : undefined;
  // ...and becomes the selection, so later updates follow it rather than its row. (State set
  // during render, React's pattern for state derived from changed data; it settles in one pass.)
  if (heir) setSelection({ key: itemKey(heir), at: cursor });

  const select = (i: number) => {
    const item = items[i];
    setSelection({ key: item ? itemKey(item) : null, at: i });
    document.querySelector(`[data-inbox-row="${i}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const open = (item: Item) => {
    if (item.kind === "check-errors") return setProblemsOpen(true);
    if (item.kind === "failing-verify" && item.ref)
      return navigate(failingRunHref(index, item.ref));
    if (item.ref) navigate(routeForId(item.ref));
  };

  /** Opens (or closes) an item's inline answer form. */
  const toggleAnswer = (item: Item) => {
    const key = itemKey(item);
    setAutoFocus(true);
    setExpanded((current) => (current === key ? null : key));
  };

  const primary = (item: Item) => {
    const ref = item.ref;
    if (KINDS[item.kind].writes && !canAct) return;
    switch (item.kind) {
      case "answer-question":
        return toggleAnswer(item);
      case "approve-spec":
        if (ref) setDialog({ kind: "approve", ref });
        return;
      case "reapprove-spec":
        if (ref) setDialog({ kind: "reapprove", ref });
        return;
      case "review-auto":
        if (ref) void run("acknowledge", ref);
        return;
      default:
        open(item);
    }
  };

  useListKeys({
    count: items.length,
    selected: cursor,
    onSelect: select,
    onOpen: (i) => {
      const item = items[i];
      if (item && !controlFocused()) open(item);
    },
    onPrimary: (i) => {
      const item = items[i];
      if (item) primary(item);
    },
    // The Problems panel has its own j/k list.
    enabled: dialog === null && !problemsOpen,
  });

  const position = new Map(items.map((item, i) => [itemKey(item), i]));
  const hints = (
    <span className="inbox-hints">
      <Hint keys={["j", "k"]} label="move" />
      <Hint keys={["↵"]} label="open" />
      <Hint keys={["a"]} label="primary action" />
    </span>
  );

  return (
    <Page crumbs={[{ label: "Inbox" }]} hints={hints}>
      <div className="inbox">
        <div className="inbox-main">
          <div className="inbox-heading">
            <h1>Inbox</h1>
            {items.length > 0 && (
              <span className="count">
                {plural(items.length, "thing")} {items.length === 1 ? "needs" : "need"} you
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState title="Nothing needs you" icon={<StatusGlyph glyph="s-done" large />}>
              {agentLine(index, now)}
            </EmptyState>
          ) : (
            URGENCIES.map(({ level, label }) => {
              const group = items.filter((i) => i.urgency === level);
              if (group.length === 0) {
                return (
                  <section key={level} aria-label={`${label} urgency`} className="inbox-none">
                    <UrgencySignal level={level} />
                    <span className="az-eyebrow">{label}</span>
                    <span>Nothing here</span>
                  </section>
                );
              }
              return (
                <section key={level} aria-label={`${label} urgency`} className="inbox-group">
                  <div className="inbox-group-head">
                    <UrgencySignal level={level} />
                    <span className="az-eyebrow">{label}</span>
                    <span className="n">{group.length}</span>
                  </div>
                  {group.map((item) => {
                    const key = itemKey(item);
                    const at = position.get(key) ?? 0;
                    return (
                      <InboxItem
                        key={key}
                        index={index}
                        item={item}
                        position={at}
                        now={now}
                        selected={at === cursor}
                        expanded={expanded === key}
                        autoFocus={autoFocus}
                        fresh={!seen.has(key)}
                        flash={item.ref !== null && changed.has(item.ref)}
                        onSelect={() => setSelection({ key, at })}
                        onPrimary={() => primary(item)}
                        onAnswer={() => toggleAnswer(item)}
                        onSendBack={() =>
                          item.ref && setDialog({ kind: "send-back", ref: item.ref })
                        }
                        onCollapse={() => setExpanded(null)}
                      />
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
        <InboxAside index={index} now={now} />
      </div>
      {dialog && <InboxDialog index={index} dialog={dialog} onClose={() => setDialog(null)} />}
    </Page>
  );
}

/** The empty state's line on what agents are doing. */
function agentLine(index: Index, now: number): string {
  const live = index.live.find((s) => !s.ended_at);
  if (live) {
    const on = live.task ?? live.feature;
    return `An agent is working${on ? ` on ${on}` : ""}${live.current ? `: ${live.current.summary}` : "."}`;
  }
  const last = index.sessions[0];
  if (!last) return "No agent sessions yet. Run /azimuth:idea in Claude Code to capture a feature.";
  const when = last.ended_at
    ? `ended ${ago(last.ended_at, now)}`
    : `started ${ago(last.started_at, now)}`;
  return `The last agent session ${when}: ${last.goal}`;
}

function InboxItem({
  index,
  item,
  position,
  now,
  selected,
  expanded,
  autoFocus,
  fresh,
  flash,
  onSelect,
  onPrimary,
  onAnswer,
  onSendBack,
  onCollapse,
}: {
  index: Index;
  item: Item;
  position: number;
  now: number;
  selected: boolean;
  expanded: boolean;
  autoFocus: boolean;
  fresh: boolean;
  flash: boolean;
  onSelect: () => void;
  onPrimary: () => void;
  onAnswer: () => void;
  onSendBack: () => void;
  onCollapse: () => void;
}) {
  const look = KINDS[item.kind];
  // An open question, or an agent's answer you are answering differently.
  const question =
    expanded && item.ref && (item.kind === "answer-question" || isAgentAnswer(item))
      ? questionById(index, item.ref)
      : undefined;
  const open = Boolean(question);
  const cls = [
    "inbox-item",
    open && "expanded",
    selected && "sel",
    fresh && "az-changed",
    flash && "az-flash",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} data-inbox-row={position} onMouseDown={onSelect}>
      <div className="inbox-row">
        <span className={`inbox-tile ${look.tone}`.trim()}>{look.icon}</span>
        <div className="inbox-text">
          <div className="inbox-title-line">
            {item.ref && <IdChip id={item.ref} />}
            {/* Cut with an ellipsis beside the review buttons in narrower windows. */}
            <span className="inbox-title" title={item.title}>
              {item.title}
            </span>
            {fresh && <span className="inbox-new">new</span>}
          </div>
          {item.detail && (
            <div className="inbox-detail">{inline(item.detail, { chips: false })}</div>
          )}
        </div>
        <span className="inbox-age" title={dateTime(item.since)}>
          {age(item.since, now)}
        </span>
        {!open && (
          <ItemActions
            item={item}
            onPrimary={onPrimary}
            onAnswer={onAnswer}
            onSendBack={onSendBack}
          />
        )}
      </div>
      {question && (
        <div className="inbox-answer">
          <AnswerComposer
            compact
            question={question}
            autoFocus={autoFocus}
            onOpen={() => navigate(href("questions", question.id))}
            onCancel={onCollapse}
            onSent={onCollapse}
          />
        </div>
      )}
    </div>
  );
}

/** A Review item for a question: an agent answered it with its own recommendation. */
const isAgentAnswer = (item: Item) =>
  item.kind === "review-auto" && item.ref !== null && idKind(item.ref) === "question";

function ItemActions({
  item,
  onPrimary,
  onAnswer,
  onSendBack,
}: {
  item: Item;
  onPrimary: () => void;
  onAnswer: () => void;
  onSendBack: () => void;
}) {
  const { canAct, reason } = useCanAct();
  const look = KINDS[item.kind];
  const disabled = look.writes && !canAct;
  const title = disabled ? (reason ?? undefined) : undefined;
  const primary = (
    <Button disabled={disabled} title={title} onClick={onPrimary}>
      {look.action}
    </Button>
  );
  if (item.kind !== "review-auto") return primary;
  // Features and ADRs go back for another look; a question gets your own answer instead.
  const secondary = isAgentAnswer(item) ? (
    <Button variant="tertiary" disabled={!canAct} title={title} onClick={onAnswer}>
      Answer differently
    </Button>
  ) : (
    <Button variant="tertiary" disabled={!canAct} title={title} onClick={onSendBack}>
      Send back…
    </Button>
  );
  return (
    <div className="inbox-actions">
      {secondary}
      {primary}
    </div>
  );
}

function InboxAside({ index, now }: { index: Index; now: number }) {
  const session = index.sessions[0];
  const inFlight = index.features.filter(
    (f) => f.status === "in-progress" || f.status === "verifying",
  );
  const cleared = recentlyCleared(index);
  return (
    <aside aria-label="Agent status" className="inbox-aside">
      {session && (
        <section className="az-card session-card">
          <div className="session-card-head">
            <span className="az-eyebrow">Last agent session</span>
            <span className="when" title={dateTime(session.ended_at ?? session.started_at)}>
              {ago(session.ended_at ?? session.started_at, now)}
            </span>
          </div>
          <div className="session-what">
            <span className="session-id">
              {session.id} · {session.skill ?? session.agent}
            </span>
            <span className="session-goal">{session.goal}</span>
          </div>
          {session.handoff.trim() && (
            <div className="handoff">
              <span className="az-eyebrow">Handoff</span>
              <div className="handoff-body">
                <Markdown text={session.handoff} />
              </div>
            </div>
          )}
          <a className="session-link" href={href("activity", session.id)}>
            Open in Activity
          </a>
        </section>
      )}
      <section className="aside-list">
        <div className="az-eyebrow">In flight</div>
        {inFlight.length === 0 && <div className="aside-empty">Nothing in progress</div>}
        {inFlight.map((f) => (
          <div key={f.id} className="flight-row">
            <StatusGlyph
              glyph={FEATURE_LOOK[f.status].glyph}
              label={FEATURE_LOOK[f.status].label}
            />
            <IdChip id={f.id} />
            <a className="flight-title" href={routeForId(f.id)}>
              {f.title}
            </a>
            <span
              className="n"
              title={`${f.derived.progress.done} of ${f.derived.progress.total} tasks done`}
            >
              {f.derived.progress.done}/{f.derived.progress.total}
            </span>
          </div>
        ))}
      </section>
      {cleared.length > 0 && (
        <section className="aside-list">
          <div className="az-eyebrow">Recently cleared</div>
          {cleared.map((c) => (
            <div key={`${c.id}:${c.at}`} className="cleared-row">
              <StatusGlyph glyph="s-done" />
              <span>
                You {c.verb} <a href={routeForId(c.id)}>{c.id}</a>
                {c.tail ? ` ${c.tail}` : ""} · {shortDate(c.at)}
              </span>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}

interface Cleared {
  at: string;
  verb: string;
  id: string;
  tail?: string;
}

const TRANSITION_VERBS: Partial<Record<string, string>> = {
  approved: "approved",
  draft: "sent back",
  deferred: "deferred",
  cancelled: "cancelled",
  superseded: "superseded",
};

/** Your own recent moves (feature log transitions) and answers, newest first. */
function recentlyCleared(index: Index): Cleared[] {
  const moves = index.features.flatMap((f) =>
    (f.detail?.log ?? []).flatMap((e): Cleared[] => {
      if (e.actor !== "you" || !e.transition) return [];
      const to = e.transition.to;
      const verb = TRANSITION_VERBS[to];
      if (verb) return [{ at: e.at, verb, id: f.id }];
      const label = FEATURE_LOOK[to as Feature["status"]]?.label.toLowerCase() ?? to;
      return [{ at: e.at, verb: "moved", id: f.id, tail: `to ${label}` }];
    }),
  );
  // Only answers you gave; an agent's answer waits in the Review group instead.
  const answers = index.questions.flatMap((q): Cleared[] =>
    q.answer?.by === "you" ? [{ at: q.answer.answered_at, verb: "answered", id: q.id }] : [],
  );
  return [...moves, ...answers].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5);
}

/* Dialogs */

/** A repo path in mono that may wrap after each slash. */
function FilePath({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <span className="az-mono">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </Fragment>
      ))}
    </span>
  );
}

function InboxDialog({
  index,
  dialog,
  onClose,
}: {
  index: Index;
  dialog: DialogState;
  onClose: () => void;
}) {
  const feature = featureById(index, dialog.ref);
  if (dialog.kind === "approve" && feature) return <ApproveDialog f={feature} onClose={onClose} />;
  if (dialog.kind === "reapprove" && feature)
    return <ReapproveDialog f={feature} onClose={onClose} />;
  if (dialog.kind === "send-back")
    return <SendBackDialog index={index} id={dialog.ref} onClose={onClose} />;
  return (
    <Dialog
      title={`${dialog.ref} no longer exists`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    />
  );
}

/** Undo an automatic approval: a feature goes back to draft (with a reason), an ADR to proposed. */
function SendBackDialog({ index, id, onClose }: { index: Index; id: string; onClose: () => void }) {
  const run = useAction();
  const { canAct, reason: cantAct } = useCanAct();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const feature = featureById(index, id);
  const decision = feature ? undefined : decisionById(index, id);
  const status = feature?.status ?? decision?.status;
  // Sent as the expected status, so the server refuses if the item moved while this was open.
  const [seen] = useState(status);
  const moved = status !== seen;
  const blocked = !canAct
    ? cantAct
    : moved
      ? `${id} moved to ${status ?? "another status"} while this was open`
      : feature && !reason.trim()
        ? "Sending a feature back needs a reason"
        : null;

  const sendBack = async () => {
    setBusy(true);
    const result = await run("revert", id, feature ? { reason: reason.trim() } : undefined, seen);
    setBusy(false);
    if (result.ok) onClose();
  };

  const reasonId = `send-back-${id}`;
  return (
    <Dialog
      title={feature ? `Send ${id} back to draft?` : `Move ${id} back to proposed?`}
      subtitle={
        feature
          ? `${feature.title} · ${seen} → draft`
          : `${decision?.title ?? id} · ${seen ?? "accepted"} → proposed`
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={Boolean(blocked) || busy}
            title={blocked ?? undefined}
            onClick={() => void sendBack()}
          >
            Send back
          </Button>
        </>
      }
    >
      {feature ? (
        <>
          <label htmlFor={reasonId} className="reason-label">
            Reason for the agent
          </label>
          <textarea
            id={reasonId}
            className="az-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !blocked) void sendBack();
            }}
          />
          <p className="dialog-note">
            Agents stop building on it until you approve the spec again.
          </p>
        </>
      ) : (
        <p className="dialog-note">It comes back to your inbox for review.</p>
      )}
      {moved && (
        <p className="dialog-note" role="alert">
          {id} moved to {status ?? "another status"} while this was open. Close this and check it
          again.
        </p>
      )}
      <div className="dialog-writes">
        Writes <FilePath path={feature ? `${feature.file}feature.md` : (decision?.file ?? id)} />
      </div>
    </Dialog>
  );
}
