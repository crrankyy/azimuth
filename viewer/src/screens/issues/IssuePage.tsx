import type { Index, Issue } from "../../../../src/core/types";
import { Hint, Page } from "../../components/AppShell";
import { IdChip } from "../../components/IdChip";
import { EmptyState } from "../../components/primitives";
import { StatusPill } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { issueById } from "../../data/selectors";
import { shortDate } from "../../lib/format";
import { useListKeys } from "../../lib/keys";
import { Prose } from "../../lib/markdown";
import { href, navigate } from "../../lib/router";
import { ISSUE_LOOK } from "../../lib/status";
import { bodyWithoutStatusNotes } from "./history";
import { IssueAside } from "./IssueAside";
import { TriageControls } from "./IssueDetail";
import { IssueHistory } from "./IssueHistory";
import { LevelText, SeverityBars, TypeLabel } from "./IssueTable";
import { issueAge, issuePageTargets, sortIssues } from "./model";
import { RelatedWork } from "./RelatedWork";
import "./issues.css";
import "./issue-page.css";

/** `j`/`k` step through every issue in list order and `Esc` goes back to the list. */
function usePageKeys(issues: Issue[], id: string): void {
  const position = sortIssues(issues).findIndex((i) => i.id === id);
  const targets = issuePageTargets(issues, id);
  useListKeys({
    count: issues.length,
    selected: position,
    // useListKeys clamps at either end, so the same index back means there is nowhere to go.
    onSelect: (n) => {
      const to = n > position ? targets.next : n < position ? targets.previous : null;
      if (to) navigate(to);
    },
    onBack: () => navigate(targets.back),
    // The page is long; ↑/↓ scroll it as usual.
    arrows: false,
    enabled: position >= 0,
  });
}

function FoundBy({ issue }: { issue: Issue }) {
  if (issue.found_by === "you") return <>you</>;
  if (issue.found_by === "agent") return <>an agent</>;
  return <IdChip id={issue.found_by} />;
}

function IssueHeader({ issue, now }: { issue: Issue; now: number }) {
  return (
    <header className="ip-head">
      <div className="ip-meta">
        <TypeLabel type={issue.type} />
        <span className="az-id ip-id">{issue.id}</span>
        <StatusPill look={ISSUE_LOOK[issue.status]} />
        {issue.type === "risk" ? (
          <span className="ip-levels">
            Likelihood <LevelText level={issue.likelihood} /> · Impact{" "}
            <LevelText level={issue.impact} />
          </span>
        ) : (
          issue.severity && (
            <span className={`ip-sev ip-sev-${issue.severity}`}>
              <SeverityBars severity={issue.severity} /> severity
            </span>
          )
        )}
        <span className="ip-found">
          Found by <FoundBy issue={issue} /> · {shortDate(issue.created)} · {issueAge(issue, now)}
        </span>
      </div>
      <h1 className="ip-title">{issue.title}</h1>
    </header>
  );
}

function Description({ index, issue }: { index: Index; issue: Issue }) {
  const body = bodyWithoutStatusNotes(issue.body);
  return (
    <section aria-label="Description" className="ip-desc">
      {body.trim() ? (
        <Prose text={body} options={{ terms: index.knowledge.glossary }} className="ip-prose" />
      ) : (
        <p className="muted">No description yet.</p>
      )}
    </section>
  );
}

/** `#/issues/<id>/page`. An unknown ID renders EmptyState "<id> isn't in this index" with "Back to all issues" (`#/issues`). */
export function IssuePageScreen({ id }: { id: string }) {
  const { index, now } = useIndexState();
  usePageKeys(index?.issues ?? [], id);
  const issue = index ? issueById(index, id) : undefined;
  const crumbs = [
    { label: "Issues", href: issue ? href("issues", id) : href("issues") },
    { label: <span className="az-mono">{id}</span> },
  ];
  const hints = (
    <span className="iss-hints">
      <Hint keys={["j", "k"]} label="previous / next issue" />
      <Hint keys={["esc"]} label="back to list" />
    </span>
  );
  if (!index || !issue) {
    return (
      <Page crumbs={crumbs} hints={hints}>
        <EmptyState title={`${id} isn't in this index`}>
          <a href={href("issues")}>Back to all issues</a>
        </EmptyState>
      </Page>
    );
  }
  return (
    <Page crumbs={crumbs} hints={hints}>
      {/* Keyed so triage state (busy, the won't-fix dialog) never carries over to the next issue. */}
      <div className="ip" key={issue.id}>
        <article className="ip-main">
          <IssueHeader issue={issue} now={now} />
          <section aria-label="Triage" className="az-card ip-triage">
            <span className="ip-triage-label">Triage</span>
            <TriageControls issue={issue} />
            <span className="ip-writes" title={issue.file}>
              Changes write <span className="az-mono">{issue.file}</span>
            </span>
          </section>
          <Description index={index} issue={issue} />
          <RelatedWork index={index} issue={issue} />
          <IssueHistory index={index} issue={issue} />
        </article>
        <IssueAside index={index} issue={issue} />
      </div>
    </Page>
  );
}
