import type { Index, Issue, Level } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { FlagBadge } from "../../components/primitives";
import { StatusGlyph } from "../../components/Status";
import { plural } from "../../lib/format";
import { inline, Prose } from "../../lib/markdown";
import { href } from "../../lib/router";
import { invalidRisks, isOpen, LEVEL_ORDER, riskScore, sectionOf } from "./model";

const IMPACT_ROWS: Level[] = ["high", "medium", "low"];
const initial = (l: Level) => l.charAt(0).toUpperCase();

function zone(score: number): "danger" | "warning" | "calm" {
  if (score >= 3) return "danger";
  return score === 2 ? "warning" : "calm";
}

/** Open risks placed on a 3 × 3 likelihood × impact grid, plus a card per risk. */
export function RiskMatrix({ index, selected }: { index: Index; selected: string | null }) {
  const risks = index.issues.filter(
    (i): i is Issue & { likelihood: Level; impact: Level } =>
      i.type === "risk" && isOpen(i) && i.likelihood !== null && i.impact !== null,
  );
  const invalid = invalidRisks(index);
  const ranked = [...risks].sort(
    (a, b) => riskScore(b.likelihood, b.impact) - riskScore(a.likelihood, a.impact),
  );
  return (
    <aside className="risk-aside" aria-label="Risk matrix">
      <div className="risk-head">
        <span className="az-eyebrow">Risk matrix</span>
        <span className="risk-count">{plural(risks.length, "open risk")}</span>
      </div>
      <div className="risk-grid">
        <span className="risk-axis-y">Impact →</span>
        {IMPACT_ROWS.flatMap((impact) =>
          LEVEL_ORDER.map((likelihood) => {
            const here = risks.filter((r) => r.likelihood === likelihood && r.impact === impact);
            const label = `${initial(likelihood)} × ${initial(impact)}`;
            return (
              <div
                key={label}
                className={`risk-cell ${zone(riskScore(likelihood, impact))} ${here.length ? "filled" : ""}`.trim()}
                aria-label={`Likelihood ${likelihood}, impact ${impact}: ${here.length ? here.map((r) => r.id).join(", ") : "no risks"}`}
              >
                <span className="risk-cell-label">{label}</span>
                {here.map((r) => (
                  <a
                    key={r.id}
                    className={`risk-chip ${r.id === selected ? "sel" : ""}`.trim()}
                    href={href("issues", r.id)}
                    title={r.title}
                  >
                    {r.id}
                  </a>
                ))}
              </div>
            );
          }),
        )}
        <span />
        <span className="risk-axis-x">Likelihood →</span>
      </div>
      {ranked.map((r) => (
        <RiskCard key={r.id} risk={r} />
      ))}
      {invalid.map((x) => (
        <FlagBadge key={x.id} tone="danger">
          <StatusGlyph glyph="s-failing" />
          <span>
            {x.id} left out: {x.reason}
          </span>
        </FlagBadge>
      ))}
    </aside>
  );
}

function RiskCard({ risk }: { risk: Issue & { likelihood: Level; impact: Level } }) {
  const mitigation = sectionOf(risk.body, "Mitigation");
  const simple = mitigation && !/\n\s*\n|^\s*([-*+]|\d+[.)])\s/m.test(mitigation);
  return (
    <div className="az-card risk-card">
      <div className="risk-card-head">
        <IdChip id={risk.id} />
        <span className="risk-card-levels">
          {risk.likelihood} × {risk.impact}
        </span>
      </div>
      {!mitigation && <div className="risk-mitigation muted">No mitigation written yet.</div>}
      {simple && <div className="risk-mitigation">Mitigation: {inline(mitigation)}</div>}
      {mitigation && !simple && (
        <div className="risk-mitigation">
          Mitigation:
          <Prose text={mitigation} className="risk-prose" />
        </div>
      )}
    </div>
  );
}
