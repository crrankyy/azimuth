import { Page } from "../components/AppShell";
import { EmptyState, Segmented } from "../components/primitives";
import { href, navigate, type Route } from "../lib/router";
import { RoadmapGraph } from "./roadmap/GraphView";
import { RoadmapTimeline } from "./roadmap/Timeline";

type View = "timeline" | "board" | "graph";

const VIEWS: { value: View; label: string }[] = [
  { value: "timeline", label: "Timeline" },
  { value: "board", label: "Board" },
  { value: "graph", label: "Dependency graph" },
];

const viewOf = (route: Route): View =>
  route.id === "graph" || route.id === "board" ? route.id : "timeline";

export function RoadmapScreen({ route }: { route: Route }) {
  const view = viewOf(route);
  const views = (
    <Segmented
      label="View"
      value={view}
      options={VIEWS}
      onChange={(v) => navigate(href("roadmap", v === "timeline" ? null : v))}
    />
  );
  return (
    <Page crumbs={[{ label: "Roadmap" }]} views={views}>
      {view === "timeline" && <RoadmapTimeline />}
      {view === "graph" && <RoadmapGraph />}
      {view === "board" && (
        <EmptyState title="Board view coming later">
          One column per milestone is planned. Use the timeline or the dependency graph for now.
        </EmptyState>
      )}
    </Page>
  );
}
