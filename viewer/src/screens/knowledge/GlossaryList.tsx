import { useState } from "react";
import type { GlossaryTerm } from "../../../../src/core/types";
import { Icon } from "../../components/Icon";
import { plural } from "../../lib/format";
import { inline } from "../../lib/markdown";

/** The glossary entry a word in prose refers to (by term or alias, ignoring case). */
export function termFor(terms: GlossaryTerm[], word: string): GlossaryTerm | undefined {
  const w = word.trim().toLowerCase();
  return terms.find((t) => [t.term, ...t.aliases].some((x) => x.toLowerCase() === w));
}

function matches(t: GlossaryTerm, q: string): boolean {
  return [t.term, t.definition, ...t.aliases].some((x) => x.toLowerCase().includes(q));
}

/** Searchable glossary; `highlight` marks the term hovered in the article. */
export function GlossaryList({
  terms,
  highlight = null,
  wide = false,
}: {
  terms: GlossaryTerm[];
  highlight?: string | null;
  wide?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));
  const shown = q ? sorted.filter((t) => matches(t, q)) : sorted;
  return (
    <div className={`gl ${wide ? "wide" : ""}`.trim()}>
      {!wide && (
        <div className="gl-head">
          <span className="az-eyebrow">Glossary</span>
          <span className="gl-count">{plural(terms.length, "term")}</span>
        </div>
      )}
      <label className="gl-search">
        <Icon name="search" size={14} />
        <input
          className="az-input"
          type="search"
          aria-label="Search glossary"
          placeholder="Search terms and aliases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <dl className="gl-list">
        {shown.map((t) => (
          <div key={t.term} className={`gl-item ${t.term === highlight ? "on" : ""}`.trim()}>
            <dt>{t.term}</dt>
            <dd>{inline(t.definition)}</dd>
            {t.aliases.length > 0 && <dd className="az-mono gl-aliases">{t.aliases.join(", ")}</dd>}
          </div>
        ))}
      </dl>
      {terms.length > 0 && shown.length === 0 && (
        <div className="gl-none">No terms match “{query.trim()}”.</div>
      )}
      {terms.length === 0 && <div className="gl-none">No terms yet.</div>}
    </div>
  );
}
