import type { Feature, FeatureDetail } from "../../../../src/core/types";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/primitives";
import { useIndexState } from "../../data/IndexProvider";
import { Prose } from "../../lib/markdown";

type ContextKey = keyof FeatureDetail["context"];

const PLAIN: { key: ContextKey; title: string }[] = [
  { key: "objective", title: "Objective" },
  { key: "out_of_scope", title: "Out of scope" },
  { key: "integration_points", title: "Integration points" },
];

/** Objective, scope and integration points; invariants set apart; assumptions last. */
export function ContextSection({ f }: { f: Feature }) {
  const { index } = useIndexState();
  const context = f.detail?.context;
  if (!context || !index) return null;
  const options = { terms: index.knowledge.glossary };
  const filled = Object.values(context).some((v) => v.trim());
  if (!filled) {
    return (
      <EmptyState title="No context yet">{f.id}'s feature.md has no context sections.</EmptyState>
    );
  }
  return (
    <div className="fd-context">
      {PLAIN.filter((s) => context[s.key].trim()).map((s) => (
        <section key={s.key} className="fd-ctx-sec">
          <h2 className="fd-sec-title">{s.title}</h2>
          <Prose text={context[s.key]} options={options} />
        </section>
      ))}
      {context.invariants.trim() && (
        <section className="fd-invariants" aria-labelledby="fd-invariants-title">
          <div className="row fd-invariants-head">
            <Icon name="verification" />
            <h2 id="fd-invariants-title" className="fd-sec-title">
              Invariants
            </h2>
            <span className="fd-invariants-sub">Rules that must never break</span>
          </div>
          <Prose text={context.invariants} options={options} />
        </section>
      )}
      {context.assumptions.trim() && (
        <section className="fd-ctx-sec">
          <h2 className="fd-sec-title">Assumptions</h2>
          <Prose text={context.assumptions} options={options} />
        </section>
      )}
    </div>
  );
}
