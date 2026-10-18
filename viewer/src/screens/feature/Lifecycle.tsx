import { useCallback, useState, type ReactNode } from "react";
import type { Feature, FeatureStatus, Gate, GateCheck, Index } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { Button, Eyebrow } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useAction } from "../../components/Ui";
import { useIndexState } from "../../data/IndexProvider";
import { stepDates } from "../../data/selectors";
import { shortDate } from "../../lib/format";
import { inline } from "../../lib/markdown";
import { href } from "../../lib/router";
import { FEATURE_LOOK, LIFECYCLE, PARKED } from "../../lib/status";
import {
  ApproveDialog,
  ReapproveDialog,
  ReasonDialog,
  RequestChangesDialog,
  ResumeDialog,
} from "./ActionDialogs";
import { blockingQuestions, checkDetail, transitionRest } from "./featureData";

/** Status colour token per lifecycle step, for the current-step pointer. */
const STEP_TONE: Partial<Record<FeatureStatus, string>> = {
  idea: "var(--st-neutral)",
  draft: "var(--st-draft)",
  approved: "var(--st-approved)",
  "in-progress": "var(--st-active)",
  verifying: "var(--st-verifying)",
  done: "var(--st-success)",
};

type StepState = "done" | "current" | "future";

/** Step dates from the log, falling back to the approval fields when the log lacks them. */
function datesFor(f: Feature): ReturnType<typeof stepDates> {
  const dates = stepDates(f);
  if (!dates.approved && f.approved_at) {
    dates.approved = { at: f.approved_at, actor: f.approved_by ?? "" };
  }
  return dates;
}

function stepStates(f: Feature, dates: ReturnType<typeof stepDates>): StepState[] {
  const current = LIFECYCLE.indexOf(f.status);
  return LIFECYCLE.map((s, i) => {
    if (current < 0) return dates[s] ? "done" : "future";
    if (i < current) return "done";
    return i === current ? "current" : "future";
  });
}

function stepCaption(
  step: FeatureStatus,
  state: StepState,
  date: { at: string; actor: string } | undefined,
  isNext: boolean,
): string {
  if (state === "current") return date ? `since ${shortDate(date.at)}` : "current";
  if (state === "future") return isNext ? "next" : "—";
  if (!date) return "—";
  const by = step === "approved" && date.actor ? ` · ${date.actor}` : "";
  return `${shortDate(date.at)}${by}`;
}

/** Why and when a feature was parked, from its last transition into the side status. */
function parkedNote(f: Feature): { since: string | null; reason: string | null } {
  const entry = [...(f.detail?.log ?? [])].reverse().find((e) => e.transition?.to === f.status);
  if (!entry) return { since: f.updated, reason: null };
  const reason = transitionRest(entry.body);
  return { since: entry.at, reason: reason || null };
}

function SideStatus({ f }: { f: Feature }) {
  const { since, reason } = parkedNote(f);
  const look = FEATURE_LOOK[f.status];
  return (
    <div className="fd-side">
      <span className="az-pill">
        <StatusGlyph glyph={look.glyph} />
        {look.label}
      </span>
      <span className="fd-side-text">
        {f.superseded_by ? (
          <>
            by <IdChip id={f.superseded_by} />{" "}
          </>
        ) : null}
        {since && `since ${shortDate(since)}`}
        {reason && <> · {reason}</>}
      </span>
    </div>
  );
}

export function LifecycleStepper({ f }: { f: Feature }) {
  const dates = datesFor(f);
  const states = stepStates(f, dates);
  const current = LIFECYCLE.indexOf(f.status);
  const parked = PARKED.includes(f.status);
  return (
    <div className="fd-life">
      <div className="row">
        <Eyebrow>Lifecycle</Eyebrow>
        <span className="fd-life-step">
          · {parked ? "parked outside the lifecycle" : `step ${current + 1} of ${LIFECYCLE.length}`}
        </span>
      </div>
      <ol className="fd-steps" aria-label="Lifecycle steps">
        {LIFECYCLE.map((step, i) => {
          const state = states[i] as StepState;
          const look = FEATURE_LOOK[step];
          const glyph = state === "done" ? "s-done" : state === "current" ? look.glyph : "";
          const reached = state !== "future";
          return [
            i > 0 && (
              <li
                key={`${step}-edge`}
                aria-hidden="true"
                className={`fd-step-edge ${reached ? "" : "pending"}`.trim()}
              />
            ),
            <li
              key={step}
              className={`fd-step ${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "current" ? (
                <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
                  <path d="M5 8 L0 0 L10 0 Z" style={{ fill: STEP_TONE[step] }} />
                </svg>
              ) : (
                <span className="fd-step-gap" />
              )}
              <StatusGlyph glyph={glyph} large />
              <span className="fd-step-label">
                {look.label}
                <span className="sr-only">
                  {state === "done" ? " (done)" : state === "current" ? " (current)" : ""}
                </span>
              </span>
              <span className="fd-step-date">
                {stepCaption(step, state, dates[step], current >= 0 && i === current + 1)}
              </span>
            </li>,
          ];
        })}
      </ol>
      {parked && <SideStatus f={f} />}
    </div>
  );
}

function GateRow({
  index,
  f,
  check,
  allPass,
}: {
  index: Index;
  f: Feature;
  check: GateCheck;
  /** When every check passes the header says so; rows drop their Pass label. */
  allPass: boolean;
}) {
  const detail = checkDetail(index, f, check);
  return (
    <li className={`fd-check ${detail ? "" : "compact"}`.trim()}>
      <StatusGlyph glyph={check.ok ? "s-done" : "s-failing"} />
      <div>
        <div className="fd-check-rule">{check.rule}</div>
        {detail && <div className="fd-check-detail">{inline(detail)}</div>}
      </div>
      {!allPass && (
        <span className={check.ok ? "fd-pass" : "fd-fail"}>{check.ok ? "Pass" : "Fail"}</span>
      )}
    </li>
  );
}

/** The next gate's checks, pass or fail with a detail line; passing ones fold when some fail. */
export function GateChecklist({ f, gate }: { f: Feature; gate: Gate }) {
  const { index } = useIndexState();
  const [showAll, setShowAll] = useState(false);
  if (!index) return null;
  const passing = gate.checks.filter((c) => c.ok);
  const failing = gate.checks.filter((c) => !c.ok);
  const fold = failing.length > 0 && passing.length > 2 && !showAll;
  const shown = fold ? failing : gate.checks;
  const look = FEATURE_LOOK[gate.to];
  return (
    <>
      <div className="row">
        <Eyebrow>Next gate</Eyebrow>
        <svg
          width="14"
          height="10"
          viewBox="0 0 14 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="fd-gate-arrow"
        >
          <path d="M1 5h11M8.5 1.5L12 5l-3.5 3.5" />
        </svg>
        <span className="az-pill fd-pill-sm">
          <StatusGlyph glyph={look.glyph} />
          {look.label}
        </span>
        <span className="spacer" />
        <span className={failing.length ? "fd-gate-count" : "fd-gate-count ok"}>
          {passing.length} of {gate.checks.length} pass
        </span>
      </div>
      <ul className="fd-checks" aria-label={`Checks to reach ${look.label}`}>
        {shown.map((c) => (
          <GateRow key={c.id} index={index} f={f} check={c} allPass={failing.length === 0} />
        ))}
        {failing.length > 0 && passing.length > 2 && (
          <li className="fd-check compact fd-check-fold">
            <StatusGlyph glyph="s-done" />
            <span>
              {fold
                ? `${passing.length} other checks pass`
                : `${passing.length} of ${gate.checks.length} checks pass`}
            </span>
            <button
              type="button"
              className="fd-link-btn"
              aria-expanded={!fold}
              onClick={() => setShowAll(!showAll)}
            >
              {fold ? "Show" : "Hide"}
            </button>
          </li>
        )}
      </ul>
    </>
  );
}

type DialogKind = "approve" | "reapprove" | "changes" | "defer" | "cancel" | "resume";

const FOOTNOTE: Record<FeatureStatus, string> = {
  idea: "An agent moves it to draft once the spec is written.",
  draft: "Approving lets agents start building.",
  approved: "Agents start building once every check passes.",
  "in-progress": "Agents move it to verifying once every check passes.",
  verifying: "Agents mark it done once every check passes.",
  done: "Done. This is the final status.",
  deferred: "Resume moves it back to idea or draft.",
  cancelled: "Cancelled. Nothing moves from here.",
  superseded: "Superseded. Work continues in the replacing feature.",
};

function footnote(f: Feature, failing: number): string {
  if (f.status === "draft" && failing > 0) return "Approve unlocks when every check passes.";
  if (f.derived.modified_since_approval)
    return "Re-approve the changed spec before work continues.";
  return FOOTNOTE[f.status];
}

/** A write button: disabled with the reason when acting isn't possible. */
function ActButton({
  variant = "secondary",
  blockedBy,
  onClick,
  children,
}: {
  variant?: "primary" | "secondary" | "tertiary";
  blockedBy?: string | null;
  onClick: () => void;
  children: ReactNode;
}) {
  const { canAct, reason } = useCanAct();
  const why = canAct ? blockedBy : reason;
  return (
    <Button variant={variant} disabled={Boolean(why)} title={why ?? undefined} onClick={onClick}>
      {children}
    </Button>
  );
}

const PARKABLE: FeatureStatus[] = ["idea", "draft", "approved", "in-progress"];

/** The actions that fit the feature's status, plus the dialog each one opens. */
export function ActionBar({ f }: { f: Feature }) {
  const [open, setOpen] = useState<DialogKind | null>(null);
  const run = useAction();
  const failing = f.derived.next_gate?.checks.filter((c) => !c.ok) ?? [];
  const questions = blockingQuestions(f);
  const modified =
    f.derived.modified_since_approval && (f.status === "approved" || f.status === "in-progress");
  // Stable, so Dialog's focus effect runs once rather than on every clock tick.
  const close = useCallback(() => setOpen(null), []);
  // Decisions first; review and parking second, so a wrap splits the bar between the groups.
  const buttons: ReactNode[] = [];
  const secondary: ReactNode[] = [];
  if (f.approved_by === "agent" && !f.review_ack_at) {
    buttons.push(
      <ActButton key="ack" onClick={() => void run("acknowledge", f.id)}>
        Acknowledge
      </ActButton>,
    );
  }
  if (f.status === "draft") {
    const blockedBy = questions[0]
      ? `Answer ${questions.join(", ")} first`
      : failing.length
        ? `Every check must pass first: ${failing.map((c) => c.rule).join("; ")}`
        : null;
    buttons.push(
      <ActButton
        key="approve"
        variant="primary"
        blockedBy={blockedBy}
        onClick={() => setOpen("approve")}
      >
        Approve spec
      </ActButton>,
    );
    if (questions[0]) {
      buttons.push(
        <a key="answer" className="lc-btn lc-btn-secondary" href={href("questions", questions[0])}>
          Answer {questions[0]}
        </a>,
      );
    }
  }
  if (modified) {
    buttons.push(
      <ActButton key="reapprove" variant="primary" onClick={() => setOpen("reapprove")}>
        Re-approve
      </ActButton>,
    );
  }
  if (["draft", "approved", "in-progress", "verifying"].includes(f.status)) {
    secondary.push(
      <ActButton key="changes" onClick={() => setOpen("changes")}>
        Request changes
      </ActButton>,
    );
  }
  if (PARKABLE.includes(f.status)) {
    secondary.push(
      <ActButton key="defer" variant="tertiary" onClick={() => setOpen("defer")}>
        Defer
      </ActButton>,
      <ActButton key="cancel" variant="tertiary" onClick={() => setOpen("cancel")}>
        Cancel feature
      </ActButton>,
    );
  }
  if (f.status === "deferred") {
    buttons.push(
      <ActButton key="resume" variant="primary" onClick={() => setOpen("resume")}>
        Resume
      </ActButton>,
    );
  }
  return (
    <>
      {buttons.length + secondary.length > 0 && (
        <div className="fd-actions">
          {buttons.length > 0 && <div className="fd-action-group">{buttons}</div>}
          {secondary.length > 0 && <div className="fd-action-group">{secondary}</div>}
        </div>
      )}
      <div className="fd-footnote">{footnote(f, failing.length)}</div>
      {open === "approve" && <ApproveDialog f={f} onClose={close} />}
      {open === "reapprove" && <ReapproveDialog f={f} onClose={close} />}
      {open === "changes" && <RequestChangesDialog f={f} onClose={close} />}
      {open === "defer" && <ReasonDialog f={f} to="deferred" onClose={close} />}
      {open === "cancel" && <ReasonDialog f={f} to="cancelled" onClose={close} />}
      {open === "resume" && <ResumeDialog f={f} onClose={close} />}
    </>
  );
}

/** LifecycleStepper beside GateChecklist and ActionBar. */
export function LifecycleCard({ f }: { f: Feature }) {
  const gate = f.derived.next_gate;
  return (
    <section className="az-card fd-life-card" aria-label="Lifecycle">
      <LifecycleStepper f={f} />
      <div className="fd-gate">
        {gate ? (
          <GateChecklist f={f} gate={gate} />
        ) : (
          <div className="row">
            <Eyebrow>Next gate</Eyebrow>
            <span className="fd-gate-count">none</span>
          </div>
        )}
        <ActionBar f={f} />
      </div>
    </section>
  );
}
