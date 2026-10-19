import type { ReactNode } from "react";
import type { Index, Issue } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { shortDate } from "../../lib/format";
import { ISSUE_LOOK, type StatusLook } from "../../lib/status";
import { issueHistory, type HistoryEntry } from "./history";

/** A status as the Issues list labels it; a value the flow doesn't know is shown as written. */
const statusLabel = (status: string) =>
  (ISSUE_LOOK as Record<string, StatusLook | undefined>)[status]?.label ?? status;

function Who({ by }: { by: string }) {
  if (by === "you") return <>You</>;
  if (by === "agent") return <>An agent</>;
  return <IdChip id={by} />;
}

function EntryText({ entry }: { entry: HistoryEntry }) {
  switch (entry.kind) {
    case "created":
      return (
        <>
          <Who by={entry.by} /> filed it
        </>
      );
    case "status":
      return (
        <>
          <Who by={entry.actor} /> moved it from <b>{statusLabel(entry.from)}</b> to{" "}
          <b>{statusLabel(entry.to)}</b>: {entry.reason}
        </>
      );
    case "commit":
      return (
        <>
          <span className="az-mono ip-sha">{entry.sha}</span> {entry.subject}
        </>
      );
    default:
      return <>{entry.text}</>;
  }
}

function Row({ date, kind, children }: { date: string; kind: string; children: ReactNode }) {
  return (
    <li className={`ip-history-row ${kind}`}>
      <span className="ip-history-date">{date}</span>
      <span className="ip-history-dot" aria-hidden="true" />
      <span className="ip-history-text">{children}</span>
    </li>
  );
}

/** `<section aria-label="History">`; ends with "No commit references <id> yet" when no commit entry exists. */
export function IssueHistory({ index, issue }: { index: Index; issue: Issue }) {
  const entries = issueHistory(issue, index.commits);
  return (
    <section aria-label="History" className="ip-section">
      <h2 className="ip-h2">History</h2>
      <ol className="ip-history">
        {entries.map((entry, i) => (
          <Row key={`${entry.kind}-${i}`} date={shortDate(entry.at) || "—"} kind={entry.kind}>
            <EntryText entry={entry} />
          </Row>
        ))}
        {!entries.some((e) => e.kind === "commit") && (
          <Row date="—" kind="none">
            No commit references {issue.id} yet
          </Row>
        )}
      </ol>
    </section>
  );
}
