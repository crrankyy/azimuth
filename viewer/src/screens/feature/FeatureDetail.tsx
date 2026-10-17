import { Page } from "../../components/AppShell";
import { href } from "../../lib/router";

export function FeatureDetailScreen({ id, tab: _tab }: { id: string; tab: string | null }) {
  return (
    <Page crumbs={[{ label: "Features", href: href("features") }, { label: id }]}>
      <h1 className="page-title">{id}</h1>
    </Page>
  );
}
