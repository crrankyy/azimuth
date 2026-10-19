import { useState } from "react";
import type { IssueType } from "../../../src/core/types";
import { Hint, Page } from "../components/AppShell";
import { EmptyState, Segmented } from "../components/primitives";
import { useIndexState } from "../data/IndexProvider";
import { useListKeys } from "../lib/keys";
import { href, navigate, type Route } from "../lib/router";
import { IssueDetail } from "./issues/IssueDetail";
import { IssueTable } from "./issues/IssueTable";
import { isOpen, issuePageHref, sortIssues } from "./issues/model";
import { RiskMatrix } from "./issues/RiskMatrix";
import "./issues/issues.css";

type TypeFilter = "all" | IssueType;
type StatusFilter = "open" | "closed" | "all";

export function IssuesScreen({ route }: { route: Route }) {
  const { index, changed } = useIndexState();
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const all = sortIssues(index?.issues ?? []);
  const rows = all.filter(
    (i) =>
      (type === "all" || i.type === type) &&
      (status === "all" || (status === "open") === isOpen(i)),
  );
  const selected = all.find((i) => i.id === route.id) ?? rows[0] ?? null;
  useListKeys({
    count: rows.length,
    selected: selected ? rows.indexOf(selected) : -1,
    onSelect: (n) => {
      const next = rows[n];
      if (next) navigate(href("issues", next.id));
    },
    onOpen: (n) => {
      const issue = rows[n];
      if (issue) navigate(issuePageHref(issue.id));
    },
  });
  if (!index) return null;

  const open = all.filter(isOpen).length;
  const closed = all.length - open;
  const ofType = (t: IssueType) => all.filter((i) => i.type === t).length;
  const crumbs = [
    { label: "Issues", href: href("issues") },
    ...(route.id && selected ? [{ label: <span className="az-mono">{selected.id}</span> }] : []),
  ];
  const hints = (
    <span className="iss-hints">
      <Hint keys={["j", "k"]} label="move" />
      <Hint keys={["↵"]} label="open" />
    </span>
  );
  return (
    <Page crumbs={crumbs} hints={hints}>
      <div className="iss-layout">
        <div className="iss-main">
          <div className="iss-header">
            <h1 className="page-title">Issues</h1>
            <span className="iss-summary">
              {open} open · {closed} resolved
            </span>
            <span className="spacer" />
            <Segmented
              label="Type"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "All", count: all.length },
                { value: "bug", label: "Bugs", count: ofType("bug") },
                { value: "debt", label: "Debt", count: ofType("debt") },
                { value: "risk", label: "Risks", count: ofType("risk") },
              ]}
            />
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "open", label: "Open" },
                { value: "closed", label: "Resolved" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          {all.length === 0 ? (
            <EmptyState title="No issues">
              Bugs, tech debt and risks that agents or you record show up here.
            </EmptyState>
          ) : (
            <>
              <IssueTable issues={rows} selected={selected?.id ?? null} changed={changed} />
              {rows.length === 0 && <div className="iss-none">No issues match these filters.</div>}
            </>
          )}
          {selected && (
            <IssueDetail
              key={selected.id}
              index={index}
              issue={selected}
              flash={changed.has(selected.id)}
            />
          )}
        </div>
        <RiskMatrix index={index} selected={selected?.id ?? null} />
      </div>
    </Page>
  );
}
