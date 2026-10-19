import { useState } from "react";
import type { Index, LiveSession } from "../../../src/core/types";
import { Hint, Page } from "../components/AppShell";
import { EmptyState, Segmented } from "../components/primitives";
import { StatusGlyph } from "../components/Status";
import { useIndexState, type Connection } from "../data/IndexProvider";
import { clock } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { href, navigate, type Route } from "../lib/router";
import { AgentCard, FinishedRow, finishedHref } from "./agents/AgentCard";
import { AgentsAside } from "./agents/AgentsAside";
import {
  agentGroups,
  countLine,
  filterCounts,
  headerCounts,
  shownGroups,
  type AgentsFilter,
} from "./agents/model";
import "./agents/agents.css";

const CRUMBS = [{ label: "Agents" }];

/** Live sessions by status: cards for running and waiting ones, rows for those finished today. */
export function AgentsScreen({ route: _route }: { route: Route }) {
  const { index, connection, now } = useIndexState();
  if (!index) return null;
  if (connection === "export") {
    return (
      <Page crumbs={CRUMBS}>
        <EmptyState title="Agents are only shown in the live viewer">
          This is a read-only snapshot. Run <code className="az-c">azimuth view</code> to follow
          agents live.
        </EmptyState>
      </Page>
    );
  }
  return <Agents index={index} now={now} connection={connection} />;
}

function Agents({ index, now, connection }: { index: Index; now: number; connection: Connection }) {
  const [filter, setFilter] = useState<AgentsFilter>("active");
  // The selection follows a session, not a position: live updates reorder index.live.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const groups = agentGroups(index.live, now);
  const counts = filterCounts(groups);
  const shown = shownGroups(groups, filter);
  const order: LiveSession[] = [...shown.running, ...shown.waiting, ...shown.finished];
  const found = order.findIndex((s) => s.claude_session === selectedKey);
  const cursor = found >= 0 ? found : 0;
  const selected = order[cursor]?.claude_session ?? null;
  const header = headerCounts(index.live);

  const select = (i: number) => {
    const session = order[i];
    if (!session) return;
    setSelectedKey(session.claude_session);
    document
      .querySelector(`[data-agent="${CSS.escape(session.claude_session)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };
  useListKeys({
    count: order.length,
    selected: cursor,
    onSelect: select,
    onOpen: (i) => {
      const session = order[i];
      if (!session) return;
      navigate(
        session.status === "done" ? finishedHref(session) : href("agents", session.claude_session),
      );
    },
  });

  const hints = (
    <span className="agents-hints">
      <Hint keys={["j", "k"]} label="move" />
      <Hint keys={["↵"]} label="open transcript" />
      <Hint keys={["g", "a"]} label="here" />
    </span>
  );
  const card = (session: LiveSession) => (
    <AgentCard
      key={session.claude_session}
      index={index}
      session={session}
      now={now}
      selected={session.claude_session === selected}
    />
  );

  return (
    <Page crumbs={CRUMBS} hints={hints}>
      <div className="agents">
        <div className="agents-main">
          <div className="agents-heading">
            <h1>Agents</h1>
            {header.sessions > 0 && <span className="count">{countLine(header)}</span>}
            {connection === "live" && (
              <span className="agents-live">
                <span className="az-live" />
                {`Live · ${clock(new Date(now).toISOString())}`}
              </span>
            )}
            <span className="spacer" />
            <Segmented
              label="Filter agents"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active", count: counts.active },
                { value: "running", label: "Running", count: counts.running },
                { value: "waiting", label: "Waiting on you", count: counts.waiting },
                { value: "finished", label: "Finished today", count: counts.finished },
              ]}
            />
          </div>
          {order.length === 0 ? (
            <EmptyState
              title="No agent is working right now"
              icon={<StatusGlyph glyph="s-done" large />}
            >
              Sessions show up here while Claude Code works.
            </EmptyState>
          ) : (
            <>
              {shown.running.length > 0 && (
                <section aria-label="Running" className="agents-group">
                  {shown.running.map(card)}
                </section>
              )}
              {shown.waiting.length > 0 && (
                <section aria-label="Waiting on you" className="agents-group">
                  {shown.waiting.map(card)}
                </section>
              )}
              {shown.finished.length > 0 && (
                <section aria-label="Finished today" className="agents-finished">
                  <div className="agents-finished-head">
                    <span className="az-eyebrow">Finished today</span>
                    <span className="n">{shown.finished.length}</span>
                  </div>
                  {shown.finished.map((session) => (
                    <FinishedRow
                      key={session.claude_session}
                      index={index}
                      session={session}
                      selected={session.claude_session === selected}
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
        <AgentsAside index={index} now={now} />
      </div>
    </Page>
  );
}
