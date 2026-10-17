import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function DecisionsScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Decisions" }]}>
      <h1 className="page-title">Decisions</h1>
    </Page>
  );
}
