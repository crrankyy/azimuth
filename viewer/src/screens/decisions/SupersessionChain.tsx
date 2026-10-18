import type { Decision } from "../../../../src/core/types";
import { Eyebrow } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { useIndexState } from "../../data/IndexProvider";
import { href } from "../../lib/router";
import { DECISION_LOOK } from "../../lib/status";

/**
 * The decisions linked by `supersedes` / `superseded_by`, oldest first. Either side of the link
 * may be the only one written, so both are followed.
 */
function chainOf(decisions: Decision[], d: Decision): Decision[] {
  const byId = new Map(decisions.map((x) => [x.id, x]));
  const older = (x: Decision) =>
    byId.get(x.supersedes ?? "") ?? decisions.find((y) => y.superseded_by === x.id);
  const newer = (x: Decision) =>
    byId.get(x.superseded_by ?? "") ?? decisions.find((y) => y.supersedes === x.id);
  const chain = [d];
  for (let x = older(d); x && !chain.includes(x); x = older(x)) chain.unshift(x);
  for (let x = newer(d); x && !chain.includes(x); x = newer(x)) chain.push(x);
  return chain;
}

/** Chains that share a linked item with `d`, keyed by that item (for "Related chain on F-005"). */
function relatedChains(decisions: Decision[], d: Decision): { via: string; chain: Decision[] }[] {
  const out: { via: string; chain: Decision[] }[] = [];
  const seen = new Set<string>();
  for (const other of decisions) {
    if (other.id === d.id || seen.has(other.id)) continue;
    const via = other.links.find((id) => d.links.includes(id));
    if (!via) continue;
    const chain = chainOf(decisions, other);
    if (chain.length < 2) continue;
    chain.forEach((x) => seen.add(x.id));
    out.push({ via, chain });
  }
  return out;
}

export function SupersessionChain({ decision: d }: { decision: Decision }) {
  const { index } = useIndexState();
  if (!index) return null;
  const chain = chainOf(index.decisions, d);
  const at = chain.indexOf(d);
  const before = chain[at - 1];
  const after = chain[at + 1];
  const related = chain.length > 1 ? [] : relatedChains(index.decisions, d);
  return (
    <section className="adr-section chain-section">
      <Eyebrow>Supersession</Eyebrow>
      <div className="adr-quiet">
        {before ? `Supersedes ${before.id}.` : "Supersedes nothing."}
        {after ? ` Superseded by ${after.id}.` : ""}
      </div>
      {chain.length > 1 && <ChainList chain={chain} current={d.id} />}
      {related.map(({ via, chain: other }) => (
        <div key={via} className="chain-related">
          <div className="chain-via">Related chain on {via}</div>
          <ChainList chain={other} current={null} />
        </div>
      ))}
    </section>
  );
}

function ChainList({ chain, current }: { chain: Decision[]; current: string | null }) {
  return (
    <ol className="chain" aria-label="Supersession chain">
      {chain.map((x, i) => (
        <li key={x.id} className={x.id === current ? "current" : undefined}>
          <span className="chain-rail">
            <StatusGlyph glyph={DECISION_LOOK[x.status].glyph} />
            {i < chain.length - 1 && <span className="chain-line" />}
          </span>
          <a className="chain-body" href={href("decisions", x.id)}>
            <span className={`az-mono chain-id s-${x.status}`}>
              {x.id} · {x.status}
            </span>
            <span className="chain-title">{x.title}</span>
            {x.resolves.length > 0 && (
              <span className="chain-note">Resolves {x.resolves.join(", ")}</span>
            )}
          </a>
        </li>
      ))}
    </ol>
  );
}
