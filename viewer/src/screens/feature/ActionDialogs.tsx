import { useEffect, useState, type ReactNode } from "react";
import type { Feature, Gate } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { Button, Segmented } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { Dialog, useAction, useUi } from "../../components/Ui";
import { useIndexState, type ActionResult } from "../../data/IndexProvider";
import { featureById } from "../../data/selectors";
import { plural, shortDate } from "../../lib/format";
import { inline } from "../../lib/markdown";
import { FEATURE_LOOK } from "../../lib/status";
import { checkDetail } from "./featureData";

/** Runs an action with a busy flag; network failures toast instead of throwing. */
function useSubmit() {
  const run = useAction();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const submit = async (
    action: string,
    ref: string,
    payload?: Record<string, unknown>,
    expect?: string,
  ): Promise<ActionResult | null> => {
    setBusy(true);
    try {
      return await run(action, ref, payload, expect);
    } catch (e) {
      toast({ title: `Couldn't reach azimuth view: ${(e as Error).message}`, tone: "danger" });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}

function Title({ children }: { children: ReactNode }) {
  return <span className="fd-dlg-title">{children}</span>;
}

const statusLabel = (s: Feature["status"]) => FEATURE_LOOK[s].label.toLowerCase();

/**
 * The status the dialog opened on. Actions send it as the expected status, so the server refuses
 * them if the feature moved meanwhile; `moved` is the new status, for the notice.
 */
function useSeenStatus(f: Feature) {
  const [seen] = useState(f.status);
  return { seen, moved: f.status === seen ? null : f.status };
}

function MovedNotice({ f, to }: { f: Feature; to: Feature["status"] }) {
  return (
    <p className="fd-dlg-moved" role="alert">
      {f.id} moved to {statusLabel(to)} while this was open. Close this and check it again.
    </p>
  );
}

/** After a gate refusal: the failing checks, and nothing written. */
function GateFailedDialog({
  f,
  gate,
  confirmLabel,
  onClose,
}: {
  f: Feature;
  gate: Gate;
  confirmLabel: string;
  onClose: () => void;
}) {
  const { index } = useIndexState();
  const failing = gate.checks.filter((c) => !c.ok);
  const passing = gate.checks.length - failing.length;
  return (
    <Dialog
      title={<Title>The gate no longer passes</Title>}
      subtitle={`An agent changed ${f.id} while this was open. Nothing was written.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <ul className="fd-checks fd-dlg-checks">
        {failing.map((c) => {
          const detail = index ? checkDetail(index, f, c) : (c.detail ?? "");
          return (
            <li key={c.id} className="fd-check">
              <StatusGlyph glyph="s-failing" />
              <div>
                <div className="fd-check-rule">{c.rule}</div>
                {detail && <div className="fd-check-detail">{inline(detail)}</div>}
              </div>
              <span className="fd-fail">Fail</span>
            </li>
          );
        })}
        {passing > 0 && (
          <li className="fd-check compact fd-check-fold">
            <StatusGlyph glyph="s-done" />
            <span>
              {passing} other {passing === 1 ? "check still passes" : "checks still pass"}
            </span>
          </li>
        )}
      </ul>
    </Dialog>
  );
}

function specSize(f: Feature): string {
  const d = f.detail;
  if (!d) {
    return `${plural(f.derived.coverage.total, "scenario")}, ${plural(f.derived.progress.total, "task")}`;
  }
  const scenarios = d.stories.reduce((n, s) => n + s.scenarios.length, 0);
  return `${plural(d.stories.length, "story", "stories")}, ${plural(scenarios, "scenario")}, ${plural(d.tasks.length, "task")}`;
}

/** ConfirmDialog for draft → approved; it turns into the gate-failed state on a refusal. */
export function ApproveDialog({ f, onClose }: { f: Feature; onClose: () => void }) {
  const { busy, submit } = useSubmit();
  const { canAct, reason } = useCanAct();
  const [refused, setRefused] = useState<Gate | null>(null);
  const { seen, moved } = useSeenStatus(f);
  const gate = f.derived.next_gate;
  const checks = gate?.checks ?? [];
  // Only while still a draft: after approving, next_gate moves on to the in-progress gate.
  const liveFailure =
    !moved && f.status === "draft" && gate?.to === "approved" && checks.some((c) => !c.ok)
      ? gate
      : null;
  const failed = refused ?? liveFailure;
  if (failed) {
    return <GateFailedDialog f={f} gate={failed} confirmLabel="Approve spec" onClose={onClose} />;
  }
  const approve = async () => {
    const result = await submit("approve", f.id, undefined, seen);
    if (result?.gate && result.error === "gate") return setRefused(result.gate);
    onClose();
  };
  return (
    <Dialog
      title={<Title>Approve {f.id}?</Title>}
      subtitle={`${f.title} · ${statusLabel(seen)} → approved`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !canAct || Boolean(moved)}
            title={reason ?? undefined}
            onClick={() => void approve()}
          >
            Approve spec
          </Button>
        </>
      }
    >
      <div className="fd-dlg-body">
        {/* Once the feature moved, its next gate is no longer the approval gate. */}
        {moved ? (
          <MovedNotice f={f} to={moved} />
        ) : (
          <div className="fd-dlg-check">
            <StatusGlyph glyph="s-done" />
            All {checks.length} approval checks pass
          </div>
        )}
        <p>
          {specSize(f)}. Agents can start building once you approve. Later edits to the spec will
          ask for re-approval.
        </p>
        <div className="fd-dlg-writes">
          Writes <span className="az-mono">{f.file}feature.md</span>
        </div>
      </div>
    </Dialog>
  );
}

type DiffState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok"; files: { path: string; diff: string }[] };

function useApprovalDiff(id: string, enabled: boolean): DiffState {
  const [diff, setDiff] = useState<DiffState>({ state: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch(`/api/features/${encodeURIComponent(id)}/approval-diff`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { files?: { path: string; diff: string }[] }) => {
        if (!live) return;
        setDiff(
          Array.isArray(body.files)
            ? { state: "ok", files: body.files }
            : { state: "error", message: "The server sent no diff." },
        );
      })
      .catch(() => {
        if (live) setDiff({ state: "error", message: "Couldn't load the diff from azimuth view." });
      });
    return () => {
      live = false;
    };
  }, [id, enabled]);
  return diff;
}

const DIFF_NOISE = /^(diff --git|index |--- |\+\+\+ |new file mode|deleted file mode|similarity)/;

function diffLineClass(line: string): string | undefined {
  if (line.startsWith("@@")) return "fd-diff-hunk";
  if (line.startsWith("+")) return "fd-diff-add";
  if (line.startsWith("-")) return "fd-diff-del";
  return undefined;
}

function DiffFile({ f, path, diff }: { f: Feature; path: string; diff: string }) {
  const change = f.derived.approval_changes.find((c) => c.path === path);
  const lines = diff.split("\n").filter((l) => !DIFF_NOISE.test(l));
  return (
    <div className="fd-diff">
      <div className="fd-diff-head">
        <span className="az-mono fd-diff-path">{path.replace(f.file, "")}</span>
        <span className="spacer" />
        {change?.commit && <span className="az-mono">{change.commit}</span>}
        {change?.session && <span>{change.session}</span>}
      </div>
      <pre className="az-code fd-diff-body">
        {lines.map((line, i) => (
          <span key={i} className={diffLineClass(line)}>
            {line || " "}
          </span>
        ))}
      </pre>
    </div>
  );
}

function ApprovalDiff({ f }: { f: Feature }) {
  const { connection } = useIndexState();
  const exported = connection === "export";
  const diff = useApprovalDiff(f.id, !exported);
  if (exported) {
    return (
      <div className="fd-dlg-note">
        The diff is available in live mode. Run <code className="az-c">azimuth view</code> to see
        it.
      </div>
    );
  }
  if (diff.state === "loading") return <div className="fd-dlg-note">Loading the diff…</div>;
  if (diff.state === "error") return <div className="fd-dlg-note">{diff.message}</div>;
  if (diff.files.length === 0) return <div className="fd-dlg-note">No changes to show.</div>;
  return (
    <>
      {diff.files.map((file) => (
        <DiffFile key={file.path} f={f} path={file.path} diff={file.diff} />
      ))}
    </>
  );
}

/** Re-approve a spec that changed after approval: the changed files, with a diff. */
export function ReapproveDialog({ f, onClose }: { f: Feature; onClose: () => void }) {
  const { busy, submit } = useSubmit();
  const { canAct, reason } = useCanAct();
  const [refused, setRefused] = useState<Gate | null>(null);
  const { seen, moved } = useSeenStatus(f);
  if (refused) {
    return <GateFailedDialog f={f} gate={refused} confirmLabel="Re-approve" onClose={onClose} />;
  }
  const reapprove = async () => {
    const result = await submit("reapprove", f.id, undefined, seen);
    if (result?.gate && result.error === "gate") return setRefused(result.gate);
    onClose();
  };
  const changes = f.derived.approval_changes;
  return (
    <Dialog
      width={640}
      title={<Title>Re-approve {f.id}?</Title>}
      subtitle={`${f.title} · the spec changed after ${f.approved_by === "agent" ? "it was approved" : "you approved it"}${f.approved_at ? ` on ${shortDate(f.approved_at)}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !canAct || Boolean(moved)}
            title={reason ?? undefined}
            onClick={() => void reapprove()}
          >
            Re-approve
          </Button>
        </>
      }
    >
      <div className="fd-dlg-body">
        {moved && <MovedNotice f={f} to={moved} />}
        {changes.length > 0 && (
          <ul className="fd-changes">
            {changes.map((c) => (
              <li key={`${c.path}-${c.commit ?? "wt"}`}>
                <span className="az-mono">{c.path.replace(f.file, "")}</span>
                <span className="muted">
                  {c.commit ? `commit ${c.commit}` : "uncommitted"}
                  {c.at && ` · ${shortDate(c.at)}`}
                </span>
                {c.session && <IdChip id={c.session} />}
              </li>
            ))}
          </ul>
        )}
        <ApprovalDiff f={f} />
        <div className="fd-dlg-writes">
          Writes <span className="az-mono">{f.file}feature.md</span>
        </div>
      </div>
    </Dialog>
  );
}

function NoteField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="fd-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="az-input"
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** A review note for the agent, posted to the feature log. */
export function RequestChangesDialog({ f, onClose }: { f: Feature; onClose: () => void }) {
  const { busy, submit } = useSubmit();
  const { canAct, reason } = useCanAct();
  const [comment, setComment] = useState("");
  const send = async () => {
    const result = await submit("request-changes", f.id, { comment: comment.trim() });
    if (result?.ok) onClose();
  };
  return (
    <Dialog
      width={480}
      title={
        <span className="row fd-dlg-title">
          Request changes on <span className="az-id">{f.id}</span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <span className="fd-dlg-hint">Posts a review note to the feature log</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !canAct || !comment.trim()}
            title={reason ?? undefined}
            onClick={() => void send()}
          >
            Send note
          </Button>
        </>
      }
    >
      <NoteField
        id="fd-changes-note"
        label="Note for the agent"
        value={comment}
        onChange={setComment}
        placeholder="What should change in the spec, and why"
      />
    </Dialog>
  );
}

/** Defer or cancel: both need a reason in the log. */
export function ReasonDialog({
  f,
  to,
  onClose,
}: {
  f: Feature;
  to: "deferred" | "cancelled";
  onClose: () => void;
}) {
  const { busy, submit } = useSubmit();
  const { canAct, reason: blocked } = useCanAct();
  const [reason, setReason] = useState("");
  const { seen, moved } = useSeenStatus(f);
  const verb = to === "deferred" ? "Defer" : "Cancel";
  const move = async () => {
    const result = await submit("move", f.id, { to, reason: reason.trim() }, seen);
    if (result?.ok) onClose();
  };
  return (
    <Dialog
      width={480}
      title={
        <Title>
          {verb} {f.id}?
        </Title>
      }
      subtitle={`${f.title} · ${statusLabel(seen)} → ${to}`}
      onClose={onClose}
      footer={
        <>
          <span className="fd-dlg-hint">The reason goes to the feature log</span>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            disabled={busy || !canAct || !reason.trim() || Boolean(moved)}
            title={blocked ?? (reason.trim() ? undefined : "A reason is required")}
            onClick={() => void move()}
          >
            {verb} feature
          </Button>
        </>
      }
    >
      {moved && <MovedNotice f={f} to={moved} />}
      <NoteField
        id="fd-reason"
        label="Reason (required)"
        value={reason}
        onChange={setReason}
        placeholder={
          to === "deferred" ? "Why it waits, and what would bring it back" : "Why it won't be built"
        }
      />
    </Dialog>
  );
}

/** Bring a deferred feature back as an idea or a draft. */
export function ResumeDialog({ f, onClose }: { f: Feature; onClose: () => void }) {
  const { index } = useIndexState();
  const { busy, submit } = useSubmit();
  const { canAct, reason } = useCanAct();
  const hasSpec = f.derived.progress.total > 0 || f.derived.coverage.total > 0;
  const [to, setTo] = useState<"draft" | "idea">(hasSpec ? "draft" : "idea");
  const [refused, setRefused] = useState<Gate | null>(null);
  const { seen, moved } = useSeenStatus(f);
  if (refused) {
    return <GateFailedDialog f={f} gate={refused} confirmLabel="Resume" onClose={onClose} />;
  }
  const resume = async () => {
    const result = await submit("move", f.id, { to }, seen);
    if (result?.gate && result.error === "gate") return setRefused(result.gate);
    if (result?.ok) onClose();
  };
  const blockers = f.depends_on.filter((id) => {
    const dep = index ? featureById(index, id) : undefined;
    return dep && dep.status !== "done";
  });
  return (
    <Dialog
      title={<Title>Resume {f.id}?</Title>}
      subtitle={`${f.title} · deferred → ${to}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !canAct || Boolean(moved)}
            title={reason ?? undefined}
            onClick={() => void resume()}
          >
            Resume
          </Button>
        </>
      }
    >
      <div className="fd-dlg-body">
        {moved && <MovedNotice f={f} to={moved} />}
        <div className="row">
          <span className="fd-dlg-label">Resume as</span>
          <Segmented
            label="Resume as"
            value={to}
            onChange={setTo}
            options={[
              { value: "draft", label: "Draft" },
              { value: "idea", label: "Idea" },
            ]}
          />
        </div>
        <p>
          {to === "draft"
            ? "Back to draft, so the spec can be reviewed and approved."
            : "Back to idea, before any spec is written."}
          {blockers.length > 0 && ` It still depends on ${blockers.join(", ")}.`}
        </p>
      </div>
    </Dialog>
  );
}
