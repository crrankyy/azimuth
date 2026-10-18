import type { Feature } from "../../../../src/core/types";
import { EmptyState } from "../../components/primitives";
import { useIndexState } from "../../data/IndexProvider";
import { Prose } from "../../lib/markdown";

/** Contract sections: code blocks with copy buttons; mermaid state diagrams render as diagrams. */
export function ContractTab({ f }: { f: Feature }) {
  const { index } = useIndexState();
  const sections = f.detail?.contract.sections ?? [];
  if (!index) return null;
  if (sections.length === 0) {
    return <EmptyState title="No contract yet">{f.id}'s contract.md has no sections.</EmptyState>;
  }
  return (
    <div className="fd-contract">
      {sections.map((s) => (
        <section key={s.title} className="fd-contract-sec">
          <h2 className="fd-sec-title">{s.title}</h2>
          <Prose text={s.body} options={{ terms: index.knowledge.glossary }} />
        </section>
      ))}
    </div>
  );
}
