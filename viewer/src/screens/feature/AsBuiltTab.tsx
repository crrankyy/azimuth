import type { Feature } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { EmptyState } from "../../components/primitives";
import { useIndexState } from "../../data/IndexProvider";
import { shortDate } from "../../lib/format";
import { Prose } from "../../lib/markdown";

/** Files changed against the plan, deviations, follow-ups and the close-out notes. */
export function AsBuiltTab({ f }: { f: Feature }) {
  const { index } = useIndexState();
  const asBuilt = f.detail?.as_built;
  if (!asBuilt || !index) {
    return (
      <EmptyState title="Not written yet">
        As-built is written at close-out, once {f.id} reaches verifying.
      </EmptyState>
    );
  }
  const planned = new Map((f.detail?.impact ?? []).map((e) => [e.path, e.change]));
  const changed = new Set(asBuilt.files_changed.map((c) => c.path));
  const untouched = [...planned.entries()].filter(
    ([path, change]) => (change === "create" || change === "modify") && !changed.has(path),
  );
  return (
    <div className="fd-asbuilt">
      <div className="fd-asbuilt-meta">Completed {shortDate(asBuilt.completed_at)}</div>
      <section className="fd-ctx-sec">
        <h2 className="fd-sec-title">Files changed</h2>
        <table className="az-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Change</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {asBuilt.files_changed.map((c) => (
              <tr key={c.path}>
                <td className="az-mono">{c.path}</td>
                <td>{c.change}</td>
                <td>
                  {planned.has(c.path) ? `planned (${planned.get(c.path)})` : "not in the plan"}
                </td>
              </tr>
            ))}
            {untouched.map(([path, change]) => (
              <tr key={path} className="fd-asbuilt-missing">
                <td className="az-mono">{path}</td>
                <td>—</td>
                <td>planned ({change}), not changed</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {asBuilt.deviations.length > 0 && (
        <section className="fd-ctx-sec">
          <h2 className="fd-sec-title">Deviations</h2>
          <ul className="fd-asbuilt-devs">
            {asBuilt.deviations.map((d) => (
              <li key={`${d.path}-${d.kind}`}>
                <span className="az-mono">{d.path}</span> <span className="az-kind">{d.kind}</span>
                <div className="fd-impact-note">{d.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {asBuilt.follow_ups.length > 0 && (
        <section className="fd-ctx-sec">
          <h2 className="fd-sec-title">Follow-ups</h2>
          <div className="row fd-wrap">
            {asBuilt.follow_ups.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        </section>
      )}
      {asBuilt.body.trim() && (
        <Prose text={asBuilt.body} options={{ terms: index.knowledge.glossary }} />
      )}
    </div>
  );
}
