import type { Id } from "./types";

export const ID_PATTERNS = {
  milestone: /^M-\d{2}$/,
  feature: /^F-\d{3}$/,
  story: /^ST-\d{3}\.\d+$/,
  scenario: /^S-\d{3}\.\d+\.\d+$/,
  task: /^T-\d{3}\.\d+$/,
  decision: /^ADR-\d{4}$/,
  question: /^Q-\d{4}$/,
  issue: /^(BUG|DEBT|RISK)-\d{4}$/,
  session: /^SES-\d{8}-\d{4}(-\d+)?$/,
  run: /^R-\d{4}$/,
} as const;

export type IdKind = keyof typeof ID_PATTERNS;

/** Matches any Azimuth ID inside prose. */
export const MENTION_PATTERN =
  /\b(?:F-\d{3}|ST-\d{3}\.\d+|S-\d{3}\.\d+\.\d+|T-\d{3}\.\d+|ADR-\d{4}|Q-\d{4}|(?:BUG|DEBT|RISK)-\d{4}|SES-\d{8}-\d{4}(?:-\d+)?|R-\d{4}|M-\d{2})\b/g;

export function idKind(id: string): IdKind | null {
  for (const [kind, pattern] of Object.entries(ID_PATTERNS) as [IdKind, RegExp][]) {
    if (pattern.test(id)) return kind;
  }
  return null;
}

export function isId(id: unknown, kind: IdKind): id is Id {
  return typeof id === "string" && ID_PATTERNS[kind].test(id);
}

/** The feature a story, scenario or task belongs to (`S-005.1.2` → `F-005`). */
export function featureOf(id: string): Id | null {
  if (ID_PATTERNS.feature.test(id)) return id;
  const match = /^(?:ST|S|T)-(\d{3})\./.exec(id);
  return match ? `F-${match[1]}` : null;
}

/** Story ID of a scenario (`S-005.1.2` → `ST-005.1`). */
export function storyOf(scenarioId: string): Id | null {
  const match = /^S-(\d{3}\.\d+)\.\d+$/.exec(scenarioId);
  return match ? `ST-${match[1]}` : null;
}

export function mentions(text: string): Id[] {
  return [...new Set(text.match(MENTION_PATTERN) ?? [])];
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 48).replace(/-+$/, "") || "untitled";
}

/** Numeric part used for ordering and allocation (`ADR-0012` → 12, `SES-…` → NaN). */
export function idNumber(id: string): number {
  const match = /^(?:M|F|ADR|Q|BUG|DEBT|RISK|R)-(\d+)$/.exec(id);
  return match ? Number(match[1]) : Number.NaN;
}

export function compareIds(a: string, b: string): number {
  const parts = (id: string) => id.split(/[-.]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}
