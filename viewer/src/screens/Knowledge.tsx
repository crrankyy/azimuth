import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function KnowledgeScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Knowledge" }]}>
      <h1 className="page-title">Knowledge</h1>
    </Page>
  );
}
