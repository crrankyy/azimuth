import { createHash } from "node:crypto";
import { normalizePlaceholders } from "./placeholders";

export interface SpecParts {
  /** feature.md without its frontmatter. */
  featureBody: string;
  impact: string;
  stories: string;
  contract: string;
}

const SEPARATOR = "\n\u0000\n";

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/**
 * The approval hash of a feature's spec (see docs/file-format.md, "Spec hash"). Settled values in
 * stories.md hash as the open placeholder they replaced, so settling never makes the approval
 * stale; placeholders exist only in stories.md, so the other parts are hashed as written.
 */
export function specHash(parts: SpecParts): string {
  const stories = normalizePlaceholders(parts.stories);
  const joined = [parts.featureBody, parts.impact, stories, parts.contract]
    .map(normalize)
    .join(SEPARATOR);
  return "sha256:" + createHash("sha256").update(joined, "utf8").digest("hex");
}
