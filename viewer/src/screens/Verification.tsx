import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function VerificationScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Verification" }]}>
      <h1 className="page-title">Verification</h1>
    </Page>
  );
}
