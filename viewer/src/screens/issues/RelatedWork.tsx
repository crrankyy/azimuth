import type { Index, Issue } from "../../../../src/core/types";
import { StatusGlyph } from "../../components/Status";
import { RELATED_RULE, relatedWork } from "./related";

/** `<section aria-label="Related work">`: RELATED_RULE, then a row per item or "Nothing related yet.". */
export function RelatedWork({ index, issue }: { index: Index; issue: Issue }) {
  const items = relatedWork(index, issue);
  return (
    <section aria-label="Related work" className="ip-section">
      <h2 className="ip-h2">Related work</h2>
      <p className="ip-rule">{RELATED_RULE}</p>
      {items.length === 0 ? (
        <p className="ip-none">Nothing related yet.</p>
      ) : (
        <div className="ip-related">
          {items.map((item) => (
            <a key={item.id} className="ip-related-row" href={item.href}>
              {item.look ? <StatusGlyph glyph={item.look.glyph} /> : <span />}
              <span className="az-mono ip-related-id">{item.id}</span>
              <span className="ip-related-body">
                <span className="ip-related-title">{item.title}</span>
                <span className="ip-related-reason">{item.reason}</span>
              </span>
              <span className={`ip-related-status ${item.look?.glyph ?? ""}`.trim()}>
                {item.look?.label}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
