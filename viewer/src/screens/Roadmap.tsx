import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function RoadmapScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Roadmap" }]}>
      <h1 className="page-title">Roadmap</h1>
    </Page>
  );
}
