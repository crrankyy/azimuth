import type { Coverage, Feature, FeatureStatus } from "../../../../src/core/types";
import { SegmentBar } from "../../components/primitives";
import { FEATURE_LOOK } from "../../lib/status";
import { FLAGS, flagReason, statusRank, type FlagKey } from "./model";
import "./features.css";

/** Flags as a colored dot plus a label (square = warning, round = danger), never color alone. */
export function FlagList({
  feature,
  flags,
  short = false,
}: {
  feature: Feature;
  flags: FlagKey[];
  short?: boolean;
}) {
  if (flags.length === 0) return null;
  return (
    <span className="ft-flags">
      {flags.map((k) => (
        <span key={k} className={`ft-flag ${FLAGS[k].tone}`} title={flagReason(feature, k)}>
          <span className="ft-flag-dot" aria-hidden="true" />
          {short ? FLAGS[k].short : FLAGS[k].label}
        </span>
      ))}
    </span>
  );
}

/** Coverage as proportional runs (passing, failing, not run, untested); fills its row without a width. */
export function CoverageMini({
  coverage: c,
  width,
  height = 6,
}: {
  coverage: Coverage;
  width?: number;
  height?: number;
}) {
  return (
    <span className="az-cov ft-cov" style={{ width, height }} aria-hidden="true">
      {c.total === 0 && <span className="ft-cov-none" />}
      {c.passing > 0 && <span className="c-pass" style={{ flexGrow: c.passing }} />}
      {c.failing > 0 && <span className="c-fail ft-cov-fail" style={{ flexGrow: c.failing }} />}
      {c.not_run > 0 && <span className="c-notrun" style={{ flexGrow: c.not_run }} />}
      {c.untested > 0 && <span className="c-untested" style={{ flexGrow: c.untested }} />}
    </span>
  );
}

/** Up to this many features get one segment each; more are merged per status. */
const PER_FEATURE_MAX = 24;

/** A milestone's features by status, in lifecycle order. */
export function StatusMixBar({
  statuses,
  width,
  height,
}: {
  statuses: FeatureStatus[];
  width?: number;
  height?: number;
}) {
  const sorted = [...statuses].sort((a, b) => statusRank(a) - statusRank(b));
  const label = sorted.map((s) => FEATURE_LOOK[s].label).join(", ");
  if (sorted.length <= PER_FEATURE_MAX) {
    return (
      <span
        role="img"
        aria-label={label || "No features"}
        className={width === undefined ? "ft-mix fill" : "ft-mix"}
      >
        <SegmentBar
          segments={sorted.length ? sorted.map((s) => FEATURE_LOOK[s].segment) : ["c-muted"]}
          width={width}
          height={height}
        />
      </span>
    );
  }
  const runs = [...new Set(sorted)].map((s) => ({
    status: s,
    n: sorted.filter((x) => x === s).length,
  }));
  return (
    <span className="az-cov" style={{ width, height }} role="img" aria-label={label}>
      {runs.map((r) => (
        <span key={r.status} className={FEATURE_LOOK[r.status].segment} style={{ flexGrow: r.n }} />
      ))}
    </span>
  );
}
