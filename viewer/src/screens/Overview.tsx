import { Page } from "../components/AppShell";
import { EmptyState } from "../components/primitives";
import { useIndexState } from "../data/IndexProvider";
import { clock } from "../lib/format";
import type { Route } from "../lib/router";
import {
  ActiveMilestone,
  ArchitectureFreshness,
  FeaturesByStatus,
  OpenIssues,
  OpenQuestions,
  ProblemsCard,
  RecentActivity,
  RecentRuns,
  ScenarioCoverage,
} from "./overview/cards";
import "./overview/overview.css";

export function OverviewScreen({ route: _route }: { route: Route }) {
  const { index, now } = useIndexState();
  if (!index) return null;
  const p = index.project;
  const tools = (
    <span className="ov-topmeta">
      Index generated {clock(index.generated_at)} · {p.mode}
      {p.stack.length > 0 && ` · ${p.stack.join(", ")}`}
    </span>
  );
  return (
    <Page crumbs={[{ label: "Overview" }]} tools={tools}>
      <div className="ov-page">
        <header className="ov-intro">
          <h1 className="ov-title">{p.name}</h1>
          {p.description && <p className="ov-desc">{p.description}</p>}
        </header>

        {index.features.length === 0 ? (
          <EmptyState title="No features yet">
            Run <code className="az-c">/pm-idea</code> in Claude Code to capture your first feature.
          </EmptyState>
        ) : (
          <FeaturesByStatus features={index.features} />
        )}

        <div className="ov-grid">
          <ActiveMilestone index={index} now={now} />
          <ScenarioCoverage features={index.features} />
          <OpenQuestions index={index} now={now} />
          <OpenIssues index={index} />
          <RecentRuns index={index} now={now} />
          <div className="ov-column">
            <ArchitectureFreshness index={index} />
            <ProblemsCard index={index} />
          </div>
        </div>

        <RecentActivity index={index} now={now} />
      </div>
    </Page>
  );
}
