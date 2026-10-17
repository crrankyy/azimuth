import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function InboxScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Inbox" }]}>
      <h1 className="page-title">Inbox</h1>
    </Page>
  );
}
