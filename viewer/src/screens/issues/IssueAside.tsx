import { Fragment, type ReactNode } from "react";
import type { Index, Issue, Level } from "../../../../src/core/types";
import { CopyButton } from "../../components/CodeBlock";
import { IdChip } from "../../components/IdChip";
import { Eyebrow, FlagBadge } from "../../components/primitives";
import { editorLink } from "../../components/ProblemsPanel";
import { StatusPill } from "../../components/Status";
import { describe } from "../../data/selectors";
import { longDate } from "../../lib/format";
import { routeForId } from "../../lib/router";
import { ISSUE_LOOK } from "../../lib/status";
import { capitalize } from "./IssueTable";
import { plannedChanges, plannedChangesLabel } from "./model";

const Unset = () => <span className="ip-fact-none">Unset</span>;

const LevelValue = ({ level }: { level: Level | null }) =>
  level ? <span className={`lvl-${level}`}>{capitalize(level)}</span> : <Unset />;

function FoundBy({ by }: { by: string }) {
  if (by === "you") return <>You</>;
  if (by === "agent") return <>An agent</>;
  return <IdChip id={by} />;
}

/** Type, severity (or a risk's likelihood and impact), status, who found it and when. */
function Facts({ issue }: { issue: Issue }) {
  const grading: [string, ReactNode][] =
    issue.type === "risk"
      ? [
          ["Likelihood", <LevelValue level={issue.likelihood} />],
          ["Impact", <LevelValue level={issue.impact} />],
        ]
      : [
          [
            "Severity",
            issue.severity ? (
              <span className={`sev-${issue.severity}`}>{capitalize(issue.severity)}</span>
            ) : (
              <Unset />
            ),
          ],
        ];
  const rows: [string, ReactNode][] = [
    ["Type", capitalize(issue.type)],
    ...grading,
    ["Status", ISSUE_LOOK[issue.status].label],
    ["Found by", <FoundBy by={issue.found_by} />],
    ["Created", longDate(issue.created)],
    [
      "Resolved",
      issue.resolved_at ? longDate(issue.resolved_at) : <span className="ip-fact-none">—</span>,
    ],
  ];
  return (
    <dl className="az-card ip-facts">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** A card per linked feature, noted with its progress (describe()'s first fact). */
function LinkedFeatures({ index, ids }: { index: Index; ids: string[] }) {
  return (
    <section className="ip-group">
      <Eyebrow>Linked features</Eyebrow>
      {ids.map((id) => {
        const summary = describe(index, id);
        return (
          <a key={id} className="ip-feature" href={routeForId(id)}>
            <span className="ip-feature-head">
              <span className="az-id">{id}</span>
              <span className="ip-feature-title">{summary?.title ?? "Not in the index"}</span>
              {summary?.look && <StatusPill look={summary.look} />}
            </span>
            {summary?.facts[0] && <span className="ip-feature-note">{summary.facts[0]}</span>}
          </a>
        );
      })}
    </section>
  );
}

function Files({ index, files }: { index: Index; files: string[] }) {
  return (
    <section className="ip-group">
      <Eyebrow>Files</Eyebrow>
      {files.map((path) => {
        const planned = plannedChangesLabel(plannedChanges(index, path));
        return (
          <div key={path} className="ip-file">
            <div className="ip-file-row">
              <span className="az-mono ip-path">{path}</span>
              <CopyButton text={path} label="Copy path" />
            </div>
            {planned && <FlagBadge>{planned}</FlagBadge>}
          </div>
        );
      })}
    </section>
  );
}

function Source({ index, issue }: { index: Index; issue: Issue }) {
  const link = editorLink(index.project.editor_url, index.project.root, {
    file: issue.file,
    line: null,
  });
  return (
    <section className="ip-group">
      <Eyebrow>Source</Eyebrow>
      <span className="az-mono ip-path ip-source">{issue.file}</span>
      <div className="ip-source-actions">
        {link && (
          <a className="lc-btn lc-btn-secondary sm" href={link}>
            Open in editor
          </a>
        )}
        <CopyButton text={issue.id} label="Copy ID" />
      </div>
    </section>
  );
}

/** `<aside aria-label="Issue details">`: facts, Linked features, Files, Source. */
export function IssueAside({ index, issue }: { index: Index; issue: Issue }) {
  const features = issue.links.filter((id) => id.startsWith("F-"));
  return (
    <aside aria-label="Issue details" className="ip-aside">
      <Facts issue={issue} />
      {features.length > 0 && <LinkedFeatures index={index} ids={features} />}
      {issue.files.length > 0 && <Files index={index} files={issue.files} />}
      <Source index={index} issue={issue} />
    </aside>
  );
}
