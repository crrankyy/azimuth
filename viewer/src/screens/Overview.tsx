import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function OverviewScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Overview" }]}>
      <h1 className="page-title">Overview</h1>
    </Page>
  );
}
