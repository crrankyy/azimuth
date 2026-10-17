import { useState, type ReactNode } from "react";
import { useIndexState } from "../data/IndexProvider";
import { dateTime } from "../lib/format";
import { href, type Section } from "../lib/router";
import { CompassMark, Icon, type IconName } from "./Icon";
import { Kbd } from "./primitives";
import { StatusGlyph } from "./Status";
import { useUi } from "./Ui";

const NAV: { section: Section; label: string; icon: IconName }[] = [
  { section: "inbox", label: "Inbox", icon: "inbox" },
  { section: "overview", label: "Overview", icon: "overview" },
  { section: "roadmap", label: "Roadmap", icon: "roadmap" },
  { section: "features", label: "Features", icon: "features" },
  { section: "decisions", label: "Decisions", icon: "decisions" },
  { section: "questions", label: "Questions", icon: "questions" },
  { section: "issues", label: "Issues", icon: "issues" },
  { section: "activity", label: "Activity", icon: "activity" },
  { section: "verification", label: "Verification", icon: "verification" },
  { section: "knowledge", label: "Knowledge", icon: "knowledge" },
];

export function Sidebar({ current }: { current: Section }) {
  const { index, connection, now } = useIndexState();
  const { setProblemsOpen } = useUi();
  const [collapsed, setCollapsed] = useState(false);
  if (!index) return null;
  const inbox = index.inbox.length;
  const openQuestions = index.questions.filter((q) => q.status === "open").length;
  const failingRuns =
    index.features.some((f) =>
      f.detail?.tasks.some((t) => t.last_run && !t.last_run.ok && t.status === "done"),
    ) || index.inbox.some((i) => i.kind === "failing-verify");
  const errors = index.problems.filter((p) => p.severity === "error").length;
  const warnings = index.problems.length - errors;
  const liveAgent = index.live.find(
    (s) => !s.ended_at && now - Date.parse(s.last_seen_at) < 120_000,
  );
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`.trim()} aria-label="Azimuth">
      <div className="brand">
        <CompassMark />
        {!collapsed && <span className="brand-name">Azimuth</span>}
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="collapse" />
        </button>
      </div>
      <nav className="nav" aria-label="Sections">
        {NAV.map((item) => (
          <a
            key={item.section}
            href={href(item.section)}
            aria-current={item.section === current ? "page" : undefined}
            title={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} />
            {!collapsed && <span className="spacer">{item.label}</span>}
            {!collapsed && item.section === "inbox" && inbox > 0 && (
              <span className="badge primary">{inbox}</span>
            )}
            {!collapsed && item.section === "features" && (
              <span className="count">{index.features.length}</span>
            )}
            {!collapsed && item.section === "questions" && openQuestions > 0 && (
              <span className="badge">{openQuestions}</span>
            )}
            {!collapsed && item.section === "verification" && failingRuns && (
              <StatusGlyph glyph="s-failing" label="Failing verify runs" />
            )}
          </a>
        ))}
      </nav>
      <div className="spacer" />
      {!collapsed && (
        <div className="sidebar-foot">
          {liveAgent && (
            <a className="live-strip" href={href("activity")} title="Agent activity">
              <span className="az-live" />
              <span className="live-text">
                {liveAgent.task ?? liveAgent.feature ?? "Agent"} ·{" "}
                {liveAgent.current?.summary ?? "working"}
              </span>
            </a>
          )}
          <div className="row">
            <span className="avatar">{index.project.name.slice(0, 1).toUpperCase()}</span>
            <span className="project-name">{index.project.name}</span>
            <span className="spacer" />
            <ModeIndicator mode={connection} />
          </div>
          {index.project.git.head && (
            <div className="az-mono row branch">
              <Icon name="branch" size={12} />
              {index.project.git.branch ?? "detached"} @ {index.project.git.head}
            </div>
          )}
          <button type="button" className="problems-btn" onClick={() => setProblemsOpen(true)}>
            {errors > 0 && <StatusGlyph glyph="s-failing" />}
            <span>{errors === 1 ? "1 error" : `${errors} errors`}</span>
            {warnings > 0 && <span className="warn-triangle" aria-hidden="true" />}
            <span>{warnings === 1 ? "1 warning" : `${warnings} warnings`}</span>
            <span className="spacer" />
            <Kbd>g p</Kbd>
          </button>
        </div>
      )}
    </aside>
  );
}

export function ModeIndicator({ mode }: { mode: string }) {
  if (mode === "export") {
    return (
      <span className="mode">
        <Icon name="camera" size={12} />
        Snapshot
      </span>
    );
  }
  if (mode === "disconnected") {
    return (
      <span className="mode">
        <StatusGlyph glyph="s-failing" />
        Offline
      </span>
    );
  }
  return (
    <span className="mode">
      <span className="az-live" />
      {mode === "live" ? "Live" : "Connecting"}
    </span>
  );
}

export interface Crumb {
  label: ReactNode;
  href?: string;
}

/** The 56px top bar: breadcrumb, optional hints and tools, and the ⌘K search trigger. */
export function TopBar({
  crumbs,
  hints,
  tools,
}: {
  crumbs: Crumb[];
  hints?: ReactNode;
  tools?: ReactNode;
}) {
  const { setPaletteOpen } = useUi();
  return (
    <header className="topbar">
      <nav className="az-crumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 8 }}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <a href={c.href}>{c.label}</a>
            ) : (
              <span className="crumb-current">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <span className="spacer" />
      {tools}
      {hints && <span className="hints">{hints}</span>}
      <button type="button" className="az-search" onClick={() => setPaletteOpen(true)}>
        <Icon name="search" size={14} />
        <span className="spacer" style={{ textAlign: "left" }}>
          Jump to an ID, title or action
        </span>
        <span className="az-kbd">⌘K</span>
      </button>
    </header>
  );
}

/** Export and disconnected banners, shown above every screen. */
export function Banners() {
  const { index, connection, attempts } = useIndexState();
  if (!index) return null;
  if (connection === "export") {
    return (
      <div className="banner" role="status">
        <Icon name="camera" />
        <span>
          Read-only snapshot from {dateTime(index.generated_at)}. Run{" "}
          <code className="az-c">azimuth view</code> to act.
        </span>
      </div>
    );
  }
  if (connection === "disconnected") {
    return (
      <div className="banner danger" role="alert">
        <Icon name="wifiOff" />
        <span>
          <b>Lost connection to azimuth view. Retrying…</b> Actions are disabled. Data shown may be
          out of date (last update {dateTime(index.generated_at)}).
        </span>
        <span className="spacer" />
        <span className="muted">Attempt {attempts}</span>
      </div>
    );
  }
  return null;
}

/** A screen: top bar plus the padded content column. */
export function Page({
  crumbs,
  hints,
  tools,
  children,
  flush = false,
}: {
  crumbs: Crumb[];
  hints?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  /** Skip the default padding (screens with their own split layouts). */
  flush?: boolean;
}) {
  return (
    <>
      <TopBar crumbs={crumbs} hints={hints} tools={tools} />
      <div className={flush ? "app-content flush" : "app-content"}>{children}</div>
    </>
  );
}

/** Keyboard hint pairs like `j k move`. */
export function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      {label}
    </span>
  );
}

/** Whether write actions are possible right now (live and connected). */
export function useCanAct(): { canAct: boolean; reason: string | null } {
  const { connection, index } = useIndexState();
  if (connection === "export") {
    return {
      canAct: false,
      reason: `Read-only snapshot from ${dateTime(index?.generated_at)}. Run azimuth view to act.`,
    };
  }
  if (connection === "disconnected")
    return { canAct: false, reason: "Disconnected from azimuth view." };
  return { canAct: true, reason: null };
}
