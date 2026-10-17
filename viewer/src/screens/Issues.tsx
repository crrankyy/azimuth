import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function IssuesScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Issues" }]}>
      <h1 className="page-title">Issues</h1>
    </Page>
  );
}
