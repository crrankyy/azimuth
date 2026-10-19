import { Banners, Sidebar } from "./components/AppShell";
import { CommandPalette } from "./components/CommandPalette";
import { HoverCardLayer } from "./components/IdChip";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { UiProvider, useUi } from "./components/Ui";
import { useIndexState } from "./data/IndexProvider";
import { useGlobalKeys } from "./lib/keys";
import { useRoute, type Route } from "./lib/router";
import { ActivityScreen } from "./screens/Activity";
import { AgentsScreen } from "./screens/Agents";
import { AgentTranscriptScreen } from "./screens/agents/AgentTranscript";
import { DecisionsScreen } from "./screens/Decisions";
import { FeatureDetailScreen } from "./screens/feature/FeatureDetail";
import { FeaturesScreen } from "./screens/Features";
import { InboxScreen } from "./screens/Inbox";
import { IssuesScreen } from "./screens/Issues";
import { IssuePageScreen } from "./screens/issues/IssuePage";
import { KnowledgeScreen } from "./screens/Knowledge";
import { OverviewScreen } from "./screens/Overview";
import { QuestionsScreen } from "./screens/Questions";
import { RoadmapScreen } from "./screens/Roadmap";
import { VerificationScreen } from "./screens/Verification";

/**
 * The screen for a route; `agents` with an ID renders AgentTranscriptScreen, `issues` with tab
 * "page" renders IssuePageScreen. Exported for tests.
 */
export function Screen({ route }: { route: Route }) {
  switch (route.section) {
    case "agents":
      return route.id ? (
        <AgentTranscriptScreen claudeSession={route.id} agentId={route.tab} />
      ) : (
        <AgentsScreen route={route} />
      );
    case "overview":
      return <OverviewScreen route={route} />;
    case "roadmap":
      return <RoadmapScreen route={route} />;
    case "features":
      return route.id ? (
        <FeatureDetailScreen id={route.id} tab={route.tab} />
      ) : (
        <FeaturesScreen route={route} />
      );
    case "decisions":
      return <DecisionsScreen route={route} />;
    case "questions":
      return <QuestionsScreen route={route} />;
    case "issues":
      return route.id && route.tab === "page" ? (
        <IssuePageScreen id={route.id} />
      ) : (
        <IssuesScreen route={route} />
      );
    case "activity":
      return <ActivityScreen route={route} />;
    case "verification":
      return <VerificationScreen route={route} />;
    case "knowledge":
      return <KnowledgeScreen route={route} />;
    default:
      return <InboxScreen route={route} />;
  }
}

function Shell() {
  const route = useRoute();
  const { index } = useIndexState();
  const { paletteOpen, setPaletteOpen, problemsOpen, setProblemsOpen } = useUi();
  useGlobalKeys({
    palette: () => setPaletteOpen(true),
    problems: () => setProblemsOpen(!problemsOpen),
  });
  if (!index) {
    return <div className="empty">Loading the project…</div>;
  }
  return (
    <div className="app">
      <Sidebar current={route.section} />
      <main className="app-main">
        <Banners />
        <Screen route={route} />
      </main>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {problemsOpen && <ProblemsPanel onClose={() => setProblemsOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <UiProvider>
      <HoverCardLayer>
        <Shell />
      </HoverCardLayer>
    </UiProvider>
  );
}
