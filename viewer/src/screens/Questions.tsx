import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

export function QuestionsScreen({ route: _route }: { route: Route }) {
  return (
    <Page crumbs={[{ label: "Questions" }]}>
      <h1 className="page-title">Questions</h1>
    </Page>
  );
}
