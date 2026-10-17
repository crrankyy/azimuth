import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function FeaturesScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Features" }]}>
      <h1 className="page-title">Features</h1>
    </Page>
  );
}
