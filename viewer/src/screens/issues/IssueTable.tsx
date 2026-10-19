import type { ReactNode } from "react";
import type { Issue, IssueType, Level, Severity } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { StatusPill } from "../../components/Status";
import { shortDate } from "../../lib/format";
import { navigate } from "../../lib/router";
import { ISSUE_LOOK } from "../../lib/status";
import { isOpen, issuePageHref } from "./model";

const TYPE_ICON: Record<IssueType, ReactNode> = {
  bug: (
    <>
      <rect x="4.5" y="4" width="7" height="9" rx="3.5" />
      <path d="M8 4V2.5M4.5 8H2M14 8h-2.5M4.8 11.5L3 13M11.2 11.5L13 13M4.8 5.5L3 4M11.2 5.5L13 4" />
    </>
  ),
  debt: <path d="M2 13h12M4 13V8h3v5M9 13V4h3v9" />,
  risk: (
    <>
      <path d="M8 2.5l6 11H2z" />
      <path d="M8 7v2.6M8 11.6v.1" />
    </>
  ),
};

const TYPE_LABEL: Record<IssueType, string> = { bug: "Bug", debt: "Debt", risk: "Risk" };

export function TypeLabel({ type }: { type: IssueType }) {
  return (
    <span className="iss-type">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {TYPE_ICON[type]}
      </svg>
      {TYPE_LABEL[type]}
    </span>
  );
}

const BARS: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 3 };
const BAR_SHAPES = [
  { x: 0, y: 7, h: 5 },
  { x: 5, y: 3.5, h: 8.5 },
  { x: 10, y: 0, h: 12 },
];

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Signal bars plus the label, so severity never rests on color alone. */
export function SeverityBars({ severity }: { severity: Severity }) {
  return (
    <span className={`sev sev-${severity}`}>
      <svg width="12" height="10" viewBox="0 0 14 12" aria-hidden="true">
        {BAR_SHAPES.map((b, i) => (
          <rect
            key={b.x}
            x={b.x}
            y={b.y}
            width="3"
            height={b.h}
            rx="1"
            className={i < BARS[severity] ? "on" : "off"}
          />
        ))}
      </svg>
      {capitalize(severity)}
    </span>
  );
}

export function LevelText({ level }: { level: Level | null }) {
  return <span className={`lvl lvl-${level ?? "none"}`}>{level ?? "unset"}</span>;
}

function SeverityCell({ issue }: { issue: Issue }) {
  if (issue.type === "risk") {
    return (
      <span className="iss-risk-levels">
        Likelihood <LevelText level={issue.likelihood} />
        <br />
        Impact <LevelText level={issue.impact} />
      </span>
    );
  }
  return issue.severity ? <SeverityBars severity={issue.severity} /> : <span>Unset</span>;
}

export function IssueTable({
  issues,
  selected,
  changed,
}: {
  issues: Issue[];
  selected: string | null;
  changed: Set<string>;
}) {
  return (
    <table className="az-table iss-table">
      <thead>
        <tr>
          <th style={{ width: 72 }}>Type</th>
          <th style={{ width: 92 }}>ID</th>
          <th>Title</th>
          <th style={{ width: 130 }}>Severity</th>
          <th style={{ width: 110 }}>Status</th>
          <th style={{ width: 130 }}>Links</th>
          <th style={{ width: 72, textAlign: "right" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr
            key={issue.id}
            className={[
              issue.id === selected ? "sel" : "",
              isOpen(issue) ? "" : "closed",
              changed.has(issue.id) ? "az-flash" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-selected={issue.id === selected}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return;
              navigate(issuePageHref(issue.id));
            }}
          >
            <td>
              <TypeLabel type={issue.type} />
            </td>
            <td>
              <IdChip id={issue.id} to={issuePageHref(issue.id)} />
            </td>
            <td className="iss-title">
              <a className="iss-title-link" href={issuePageHref(issue.id)}>
                <span className="iss-title-text">{issue.title}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path d="M4.5 2.5L8 6l-3.5 3.5" />
                </svg>
              </a>
            </td>
            <td>
              <SeverityCell issue={issue} />
            </td>
            <td>
              <StatusPill look={ISSUE_LOOK[issue.status]} />
            </td>
            <td>
              <span className="iss-links">
                {issue.links.map((id) => (
                  <IdChip key={id} id={id} />
                ))}
              </span>
            </td>
            <td className="iss-created">{shortDate(issue.created)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
