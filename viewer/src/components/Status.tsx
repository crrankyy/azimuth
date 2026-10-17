import type { CSSProperties } from "react";
import type { FeatureStatus } from "../../../src/core/types";
import { FEATURE_LOOK, type StatusLook } from "../lib/status";

/** The shape+fill status glyph (`.az-g`). Decorative unless given a label. */
export function StatusGlyph({
  glyph,
  large = false,
  label,
  style,
}: {
  glyph: string;
  large?: boolean;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`az-g ${glyph} ${large ? "lg" : ""}`.trim()}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    />
  );
}

/** Glyph + label in a pill (`.az-pill`). */
export function StatusPill({ look }: { look: StatusLook }) {
  return (
    <span className="az-pill">
      <StatusGlyph glyph={look.glyph} />
      {look.label}
    </span>
  );
}

export function FeatureStatusPill({ status }: { status: FeatureStatus }) {
  return <StatusPill look={FEATURE_LOOK[status]} />;
}

/** Glyph followed by a plain label, for dense lists. */
export function StatusText({ look }: { look: StatusLook }) {
  return (
    <span className="status-text">
      <StatusGlyph glyph={look.glyph} />
      {look.label}
    </span>
  );
}
