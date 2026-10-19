import { Page } from "../components/AppShell";
import type { Route } from "../lib/router";

/** Live sessions by status: cards for running and waiting ones, rows for those finished today. */
export function AgentsScreen(_props: { route: Route }) {
  return <Page crumbs={[{ label: "Agents" }]}>{null}</Page>;
}
