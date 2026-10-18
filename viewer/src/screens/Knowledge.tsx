import { useState, type MouseEvent } from "react";
import type { KnowledgeDoc } from "../../../src/core/types";
import { Page } from "../components/AppShell";
import { EmptyState, Tabs, type TabItem } from "../components/primitives";
import { useIndexState } from "../data/IndexProvider";
import { plural, shortDate } from "../lib/format";
import { Prose } from "../lib/markdown";
import { href, navigate, type Route } from "../lib/router";
import { ArchitectureDoc } from "./knowledge/ArchitectureDoc";
import { GlossaryList, termFor } from "./knowledge/GlossaryList";
import "./knowledge/knowledge.css";

type DocTab = "vision" | "architecture" | "conventions" | "glossary";

const LABEL: Record<DocTab, string> = {
  vision: "Vision",
  architecture: "Architecture",
  conventions: "Conventions",
  glossary: "Glossary",
};
const TABS = Object.keys(LABEL) as DocTab[];

const tabOf = (route: Route): DocTab =>
  TABS.includes(route.id as DocTab) ? (route.id as DocTab) : "vision";

export function KnowledgeScreen({ route }: { route: Route }) {
  const { index } = useIndexState();
  const [hovered, setHovered] = useState<string | null>(null);
  if (!index) return null;
  const k = index.knowledge;
  const tab = tabOf(route);
  const docs: Record<Exclude<DocTab, "glossary">, KnowledgeDoc> = {
    vision: k.vision,
    architecture: k.architecture,
    conventions: k.conventions,
  };
  const items: TabItem[] = TABS.map((id) => ({
    id,
    label: LABEL[id],
    count: id === "glossary" ? k.glossary.length : shortDate(docs[id].updated) || undefined,
  }));
  // Hovering a glossary term in the article highlights its entry in the aside.
  const onHover = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest(".az-term");
    setHovered(el ? (termFor(k.glossary, el.textContent ?? "")?.term ?? null) : null);
  };

  return (
    <Page crumbs={[{ label: "Knowledge", href: href("knowledge") }, { label: LABEL[tab] }]}>
      <div className="kn">
        <Tabs items={items} selected={tab} onSelect={(id) => navigate(href("knowledge", id))} />
        {tab === "glossary" ? (
          <article className="kn-article kn-glossary">
            <DocHeader
              title="Glossary"
              meta={plural(k.glossary.length, "term")}
              file={k.glossary_file}
            />
            <GlossaryList terms={k.glossary} wide />
          </article>
        ) : (
          <div className="kn-layout">
            <article
              className="kn-article"
              onMouseOver={onHover}
              onMouseLeave={() => setHovered(null)}
            >
              <DocHeader
                title={LABEL[tab]}
                meta={
                  docs[tab].updated ? `Updated ${shortDate(docs[tab].updated)}` : "Never updated"
                }
                file={docs[tab].file}
              />
              {tab === "architecture" ? (
                <ArchitectureDoc index={index} />
              ) : (
                <DocBody doc={docs[tab]} />
              )}
            </article>
            <aside className="kn-aside" aria-label="Glossary">
              <GlossaryList terms={k.glossary} highlight={hovered} />
            </aside>
          </div>
        )}
      </div>
    </Page>
  );
}

function DocHeader({ title, meta, file }: { title: string; meta: string; file: string }) {
  return (
    <header className="kn-head">
      <h1>{title}</h1>
      <div className="kn-meta">
        {meta} · <span className="az-mono">{file}</span>
      </div>
    </header>
  );
}

function DocBody({ doc }: { doc: KnowledgeDoc }) {
  const { index } = useIndexState();
  if (!doc.body.trim()) {
    return (
      <EmptyState title="Nothing written yet">
        <span className="az-mono">{doc.file}</span> is empty.
      </EmptyState>
    );
  }
  return <Prose text={doc.body} options={{ terms: index?.knowledge.glossary ?? [] }} />;
}
