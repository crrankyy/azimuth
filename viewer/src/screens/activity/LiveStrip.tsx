import type { LiveAgent, LiveEvent, LiveSession } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { KindTag } from "../../components/primitives";
import { ago, plural } from "../../lib/format";
import { activeLive, isLive } from "./feed";

/** The agent finished its turn and nothing has happened since. */
function isIdle(s: LiveSession): boolean {
  return !!s.stopped_at && (!s.current || s.stopped_at >= s.current.at);
}

function latestFor(s: LiveSession, agentId: string | null): LiveEvent | undefined {
  return s.events.findLast((e) => e.agent_id === agentId);
}

/** Agent sessions working right now (not ended, seen in the last two minutes). */
export function LiveStrip({ live, now }: { live: LiveSession[]; now: number }) {
  const active = activeLive(live, now);
  if (active.length === 0) {
    return (
      <div className="live-empty" role="status">
        <span className="live-off" aria-hidden="true" />
        <span>No agent is working right now.</span>
        <span className="live-hint">Sessions show up here live while Claude Code works.</span>
      </div>
    );
  }
  return (
    <section className="az-card live-panel" aria-label="Live agent sessions">
      <div className="live-panel-head">
        <span className="az-live" aria-hidden="true" />
        <span className="live-label">Live</span>
        <span className="live-count">{plural(active.length, "active session")}</span>
      </div>
      {active.map((s) => (
        <LiveRow key={s.claude_session} session={s} now={now} />
      ))}
    </section>
  );
}

function LiveRow({ session: s, now }: { session: LiveSession; now: number }) {
  const idle = isIdle(s);
  return (
    <div className="live-row">
      <div className="live-row-head">
        {s.ses ? (
          <IdChip id={s.ses} />
        ) : (
          <span className="az-mono live-claude" title={s.claude_session}>
            {s.claude_session.slice(0, 8)}
          </span>
        )}
        {(s.features.length > 0 ? s.features : s.feature ? [s.feature] : []).map((id) => (
          <IdChip key={id} id={id} />
        ))}
        {s.task && <IdChip id={s.task} />}
        <span className={`live-state ${idle ? "idle" : "working"}`}>
          {idle ? "Waiting for you" : "Working"}
        </span>
        <span className="spacer" />
        <span className="live-seen">last seen {ago(s.last_seen_at, now)}</span>
      </div>
      {idle ? (
        <div className="live-now muted">
          Finished a turn {ago(s.stopped_at, now)}
          {s.current ? ` · last: ${s.current.summary}` : ""}
        </div>
      ) : (
        s.current && <EventLine event={s.current} />
      )}
      {s.agents.length > 0 && <AgentLanes session={s} now={now} />}
    </div>
  );
}

function EventLine({ event }: { event: LiveEvent }) {
  return (
    <div className="live-now">
      <KindTag kind={event.tool} />
      <span className="live-summary">{event.summary}</span>
      {event.file && !event.summary.includes(event.file) && (
        <span className="az-mono live-file">{event.file}</span>
      )}
    </div>
  );
}

/** One lane for the main agent and one per subagent, each with its latest step. */
function AgentLanes({ session: s, now }: { session: LiveSession; now: number }) {
  const main = latestFor(s, null);
  return (
    <ul className="live-lanes" aria-label="Agent lanes">
      {main && (
        <Lane name="main" event={main} seen={main.at} now={now} active={isLive(main.at, now)} />
      )}
      {s.agents.map((a) => (
        <Lane
          key={a.agent_id}
          name={a.description ?? a.agent_type ?? "subagent"}
          work={a.task ?? a.feature}
          event={latestFor(s, a.agent_id)}
          seen={a.last_seen_at}
          now={now}
          active={!a.stopped_at && isLive(a.last_seen_at, now)}
          finished={finished(a)}
        />
      ))}
    </ul>
  );
}

const finished = (a: LiveAgent) => Boolean(a.stopped_at);

/** One agent's lane: what it was asked to do (or its type), its task and its latest step. */
function Lane({
  name,
  work = null,
  event,
  seen,
  now,
  active,
  finished = false,
}: {
  name: string;
  work?: string | null;
  event: LiveEvent | undefined;
  seen: string;
  now: number;
  active: boolean;
  finished?: boolean;
}) {
  return (
    <li className={`live-lane ${active ? "" : "quiet"}`.trim()}>
      {finished ? (
        <span className="live-finished">Finished</span>
      ) : (
        <span
          className={active ? "az-live" : "live-off"}
          role="img"
          aria-label={active ? "Active" : "Quiet"}
        />
      )}
      <span className="live-lane-name" title={name}>
        {name}
      </span>
      {work && <IdChip id={work} />}
      {event && <KindTag kind={event.tool} />}
      <span className="live-summary">{event?.summary ?? "No steps yet"}</span>
      <span className="live-seen">{ago(seen, now)}</span>
    </li>
  );
}
