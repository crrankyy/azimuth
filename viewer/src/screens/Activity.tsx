import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function ActivityScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Activity" }]}>
      <h1 className="page-title">Activity</h1>
    </Page>
  );
}
