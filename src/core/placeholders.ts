// Imports no Node modules, so the viewer can use it.
import type { Id, ISODateTime, LogEntry } from "./types";

/** A value the first passing test will settle. */
export const OPEN_PLACEHOLDER = "{?}";

/**
 * A settled value: "{=", at least one character other than "{", "}", "\r" or "\n", then "}".
 * Global; the value is group 1. `{=}` and `{=a{b}` are plain text.
 */
export const SETTLED_PLACEHOLDER = /\{=([^{}\r\n]+)\}/g;

export type PlaceholderPart =
  { kind: "text"; text: string } | { kind: "open" } | { kind: "settled"; value: string };

export type SettleOutcome =
  /** `text` is the new stories.md; `left` counts the scenario's placeholders still open. */
  | { ok: true; text: string; left: number }
  | { ok: false; reason: "no-scenario" | "no-placeholder" | "bad-value" };

/** One settle an agent logged: `Settled <scenario>: {=<value>}`. */
export interface SettleEntry {
  scenario: Id;
  value: string;
  at: ISODateTime;
}

const FENCE = /^\s*(```|~~~)/;
const SCENARIO_HEADING = /^###\s+(S-\d{3}\.\d+\.\d+)/;
const SECTION_HEADING = /^#{2,3} /;
const PART = new RegExp(`\\{\\?\\}|${SETTLED_PLACEHOLDER.source}`, "g");
const SETTLE_BODY = new RegExp(`^Settled (S-\\d{3}\\.\\d+\\.\\d+): ${SETTLED_PLACEHOLDER.source}$`);

interface ScenarioLine {
  /** The line without its line ending. */
  text: string;
  /** Where the line starts in the file. */
  offset: number;
}

interface ScenarioBlock {
  id: string;
  lines: ScenarioLine[];
}

/** Each scenario's lines after its heading, outside fenced code, in file order. */
function scenarioBlocks(stories: string): ScenarioBlock[] {
  const blocks: ScenarioBlock[] = [];
  let current: ScenarioBlock | null = null;
  let inFence = false;
  let offset = 0;
  for (const raw of stories.split("\n")) {
    const line = { text: raw.replace(/\r$/, ""), offset };
    offset += raw.length + 1;
    if (FENCE.test(line.text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const id = SCENARIO_HEADING.exec(line.text)?.[1];
    if (id || SECTION_HEADING.test(line.text)) {
      current = id ? { id, lines: [] } : null;
      if (current) blocks.push(current);
      continue;
    }
    current?.lines.push(line);
  }
  return blocks;
}

const openCount = (text: string) => text.split(OPEN_PLACEHOLDER).length - 1;

/** The stories part as the hash reads it: every settled value replaced by OPEN_PLACEHOLDER. */
export function normalizePlaceholders(stories: string): string {
  return stories.replace(SETTLED_PLACEHOLDER, OPEN_PLACEHOLDER);
}

/**
 * IDs of the scenarios holding OPEN_PLACEHOLDER, in file order. A scenario's lines run from the
 * line after its "### S-…" heading to the next line starting with "## " or "### ", or the end
 * of the file; lines inside ``` or ~~~ fences are skipped (a heading there ends nothing).
 */
export function openPlaceholderScenarios(stories: string): string[] {
  const open = scenarioBlocks(stories)
    .filter((block) => block.lines.some((line) => openCount(line.text) > 0))
    .map((block) => block.id);
  return [...new Set(open)];
}

/**
 * Replaces the scenario's first OPEN_PLACEHOLDER (same lines as above) with `{=<value>}`, the
 * value trimmed, and leaves every other character as it was. "bad-value" when the trimmed value
 * is empty or holds "{", "}" or a line break; checked before the scenario is looked up.
 */
export function settleText(stories: string, scenarioId: string, value: string): SettleOutcome {
  const settled = value.trim();
  if (!settled || /[{}\r\n]/.test(settled)) return { ok: false, reason: "bad-value" };
  const block = scenarioBlocks(stories).find((b) => b.id === scenarioId);
  if (!block) return { ok: false, reason: "no-scenario" };
  const line = block.lines.find((l) => openCount(l.text) > 0);
  if (!line) return { ok: false, reason: "no-placeholder" };
  const at = line.offset + line.text.indexOf(OPEN_PLACEHOLDER);
  const open = block.lines.reduce((n, l) => n + openCount(l.text), 0);
  return {
    ok: true,
    text: `${stories.slice(0, at)}{=${settled}}${stories.slice(at + OPEN_PLACEHOLDER.length)}`,
    left: open - 1,
  };
}

/** Splits scenario text into plain text, open placeholders and settled values, in order. */
export function placeholderParts(text: string): PlaceholderPart[] {
  const parts: PlaceholderPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PART)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    const value = match[1];
    parts.push(value === undefined ? { kind: "open" } : { kind: "settled", value });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** The log body of a settle: `Settled S-008.1.2: {=17..30}`. */
export function settleLogBody(scenarioId: string, value: string): string {
  return `Settled ${scenarioId}: {=${value}}`;
}

/**
 * Settles logged by an agent (type note, body exactly as settleLogBody writes it) after
 * `review_ack_at`, or all of them when it is null, oldest first.
 */
export function unreviewedSettles(f: {
  log: LogEntry[];
  review_ack_at: ISODateTime | null;
}): SettleEntry[] {
  const since = f.review_ack_at ? Date.parse(f.review_ack_at) : Number.NEGATIVE_INFINITY;
  return f.log
    .filter((e) => e.actor === "agent" && e.type === "note" && Date.parse(e.at) > since)
    .flatMap((e) => {
      const [, scenario, value] = SETTLE_BODY.exec(e.body) ?? [];
      return scenario && value ? [{ scenario, value, at: e.at }] : [];
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
