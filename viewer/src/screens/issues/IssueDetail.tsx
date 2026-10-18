import { useState } from "react";
import type { Index, Issue, IssueStatus, Severity } from "../../../../src/core/types";
import { ISSUE_FLOW } from "../../../../src/core/flows";
import { ISSUE_STATUSES } from "../../../../src/core/types";
import { useCanAct } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { Button, Eyebrow, FlagBadge } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { Dialog, useAction } from "../../components/Ui";
import { describe } from "../../data/selectors";
import { shortDate } from "../../lib/format";
import { Prose } from "../../lib/markdown";
import { ISSUE_LOOK } from "../../lib/status";
import { capitalize, LevelText } from "./IssueTable";
import { featuresChanging, SEVERITY_ORDER } from "./model";

export function IssueDetail({
  index,
  issue,
  flash,
}: {
  index: Index;
  issue: Issue;
  flash: boolean;
}) {
  return (
    <section
      aria-label={`${issue.id} detail`}
      className={`az-card iss-detail ${flash ? "az-flash" : ""}`.trim()}
    >
      <div className="iss-detail-head">
        <span className="az-id iss-detail-id">{issue.id}</span>
        <span className="iss-found">
          Found by {issue.found_by === "you" ? "you" : <IdChip id={issue.found_by} />} ·{" "}
          {shortDate(issue.created)}
          {issue.resolved_at ? ` · closed ${shortDate(issue.resolved_at)}` : ""}
        </span>
        <span className="spacer" />
        <TriageControls issue={issue} />
      </div>
      <h2 className="iss-detail-title">{issue.title}</h2>
      <div className="iss-detail-grid">
        {issue.body.trim() ? (
          <Prose
            text={issue.body}
            options={{ terms: index.knowledge.glossary }}
            className="iss-prose"
          />
        ) : (
          <p className="muted">No description yet.</p>
        )}
        <IssueSide index={index} issue={issue} />
      </div>
    </section>
  );
}

/** Severity and Status selects (§7 "Triage issue"); won't fix asks for a reason first. */
function TriageControls({ issue }: { issue: Issue }) {
  const run = useAction();
  const { canAct, reason } = useCanAct();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const title = reason ?? undefined;

  const setSeverity = async (value: Severity) => {
    setBusy(true);
    await run("set", issue.id, { field: "severity", value });
    setBusy(false);
  };
  const move = async (to: IssueStatus, why?: string) => {
    setBusy(true);
    const result = await run("move", issue.id, why ? { to, reason: why } : { to }, issue.status);
    setBusy(false);
    return result.ok;
  };
  const onStatus = (to: IssueStatus) => (to === "wontfix" ? setAsking(true) : void move(to));

  return (
    <>
      {issue.type === "risk" ? (
        <span className="iss-field">
          Likelihood <LevelText level={issue.likelihood} /> · Impact{" "}
          <LevelText level={issue.impact} />
        </span>
      ) : (
        <label className="iss-field">
          Severity
          <select
            className="az-select"
            aria-label="Severity"
            value={issue.severity ?? ""}
            disabled={!canAct || busy}
            title={title}
            onChange={(e) => void setSeverity(e.target.value as Severity)}
          >
            {issue.severity === null && <option value="">Unset</option>}
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {capitalize(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="iss-field">
        Status
        <select
          className="az-select"
          aria-label="Status"
          value={issue.status}
          disabled={!canAct || busy}
          title={title}
          onChange={(e) => onStatus(e.target.value as IssueStatus)}
        >
          {ISSUE_STATUSES.map((s) => (
            <option
              key={s}
              value={s}
              disabled={s !== issue.status && !ISSUE_FLOW[issue.status].includes(s)}
            >
              {ISSUE_LOOK[s].label}
            </option>
          ))}
        </select>
      </label>
      {asking && (
        <WontFixDialog
          issue={issue}
          busy={busy}
          onClose={() => setAsking(false)}
          onConfirm={async (why) => {
            if (await move("wontfix", why)) setAsking(false);
          }}
        />
      )}
    </>
  );
}

function WontFixDialog({
  issue,
  busy,
  onClose,
  onConfirm,
}: {
  issue: Issue;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [why, setWhy] = useState("");
  return (
    <Dialog
      title={`Close ${issue.id} as won't fix`}
      subtitle="A reason is required. It's recorded with the issue so the next session knows why."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!why.trim() || busy}
            onClick={() => onConfirm(why.trim())}
          >
            Close as won't fix
          </Button>
        </>
      }
    >
      <textarea
        className="az-input"
        rows={3}
        aria-label="Reason"
        placeholder="Why won't this be fixed?"
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />
    </Dialog>
  );
}

function IssueSide({ index, issue }: { index: Index; issue: Issue }) {
  const features = issue.links.filter((id) => id.startsWith("F-"));
  const others = issue.links.filter((id) => !id.startsWith("F-"));
  return (
    <div className="iss-side">
      {features.length > 0 && <LinkGroup index={index} title="Linked features" ids={features} />}
      {others.length > 0 && (
        <LinkGroup index={index} title={features.length > 0 ? "Related" : "Linked"} ids={others} />
      )}
      {issue.files.length > 0 && (
        <div className="iss-side-group">
          <Eyebrow>Files</Eyebrow>
          {issue.files.map((path) => (
            <FileLine key={path} index={index} path={path} />
          ))}
        </div>
      )}
      <div className="iss-side-group">
        <Eyebrow>File</Eyebrow>
        <span className="az-mono iss-path">{issue.file}</span>
      </div>
    </div>
  );
}

function LinkGroup({ index, title, ids }: { index: Index; title: string; ids: string[] }) {
  return (
    <div className="iss-side-group">
      <Eyebrow>{title}</Eyebrow>
      {ids.map((id) => {
        const summary = describe(index, id);
        return (
          <span key={id} className="iss-linked">
            {summary?.look?.glyph ? (
              <StatusGlyph glyph={summary.look.glyph} label={summary.look.label} />
            ) : (
              <span className="iss-glyph-gap" />
            )}
            <IdChip id={id} />
            <span className="iss-linked-title">{summary?.title ?? "Not in the index"}</span>
          </span>
        );
      })}
    </div>
  );
}

function FileLine({ index, path }: { index: Index; path: string }) {
  const others = featuresChanging(index, path).map((f) => f.id);
  return (
    <>
      <span className="az-mono iss-path">{path}</span>
      {others.length > 0 && (
        <FlagBadge>
          Also changed by {others.slice(0, -1).join(", ")}
          {others.length > 1 ? " and " : ""}
          {others.at(-1)}
        </FlagBadge>
      )}
    </>
  );
}
