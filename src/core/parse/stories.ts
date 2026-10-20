import { splitFrontmatter } from "../frontmatter";
import { placeholderParts } from "../placeholders";
import { SCENARIO_KINDS, type ScenarioKind } from "../types";
import { problem } from "./common";
import type { Problem } from "../types";

/** One line of stories.md as the parser read it. */
export interface SourceLine {
  /**
   * The clause text after `**THEN**` or `**AND**` (and an optional ":"), trimmed, with indented
   * continuation lines joined by a single space, as the parser joins them into the clause.
   */
  text: string;
  /** 1-based line number in the file, frontmatter included. */
  line: number;
}

export interface ScenarioRaw {
  id: string;
  title: string;
  kind: ScenarioKind;
  given: string;
  when: string;
  then: string;
  line: number;
  thenLine: number | null;
  /**
   * The THEN line, then every AND line that follows it up to the scenario's end, in file order.
   * An AND after GIVEN or WHEN extends that clause and isn't listed. Lines in fenced code are
   * never read. [] when the scenario has no THEN. Not part of the index (build-index maps
   * scenario fields one by one).
   */
  thenLines: SourceLine[];
}

export interface StoryRaw {
  id: string;
  title: string;
  intent: string;
  line: number;
  scenarios: ScenarioRaw[];
}

const STORY = /^##\s+(ST-\d{3}\.\d+)\s*(?:[·:—-]\s*)?(.*?)\s*$/;
const SCENARIO = /^###\s+(S-\d{3}\.\d+\.\d+)\s*(?:[·:—-]\s*)?(.*?)\s*$/;
const KIND = /\{(\w+)\}\s*$/;
const CLAUSE = /^\s*[-*]\s+\*\*(GIVEN|WHEN|THEN|AND)\*\*:?\s*(.*)$/i;
const INTENT = /^\*\*Intent:?\*\*:?\s*(.*)$/i;
const FENCE = /^\s*(```|~~~)/;
const VAGUE = [
  "is handled",
  "are handled",
  "works correctly",
  "work correctly",
  "appropriate",
  "as expected",
  "gracefully",
];
/** A number or range: `24`, `9..12`, `2..=5`. */
const NUMBER = /\d+(?:\.\.=?\d+)?/.source;
/** A range that isn't the tail of a longer number, a version or an identifier. */
const RANGE = /(?<![a-z\d_.])\d+\.\.=?\d+/.source;
/**
 * A measuring word that isn't the tail of a longer word, then a number, range or `Name(n)`. A
 * separator is required after a longer identifier, so `byte_to_char(5)` and `byte_to_utf16`
 * stay function names.
 */
const WORD = `(?<![a-z])(?:offset|caret|byte|column|position)(?:[a-z_]*[ :=\`]+(?:${NUMBER}|[a-z]\\w*\\(${NUMBER}\\))|${NUMBER})`;
const MEASURED = new RegExp(`${RANGE}|${WORD}`, "i");

interface Clause {
  name: "GIVEN" | "WHEN" | "THEN";
  text: string;
  line: number;
  /** The clause's own line, then each AND line that extends it. */
  lines: SourceLine[];
}

interface Draft {
  id: string;
  title: string;
  kind: ScenarioKind | null;
  line: number;
  clauses: Clause[];
}

export function isVague(then: string): boolean {
  const lower = then.toLowerCase();
  return VAGUE.some((phrase) => lower.includes(phrase));
}

/**
 * The first fragment of a THEN or AND line that looks like a value only the code can measure,
 * exactly as written, or null. Only the plain-text parts of placeholderParts(line) are tested,
 * each on its own, so an open or settled placeholder never matches. Within a part, the earliest
 * match of either pattern wins:
 * - a range: one or more digits, "..", an optional "=", one or more digits, not right after a
 *   letter, digit, "_" or "." (`9..12`, `2..=5`);
 * - a word: "offset", "caret", "byte", "column" or "position" in any case, not right after a
 *   letter, then either
 *   - any letters or "_" (`byte_range`), one or more spaces, ":", "=" or backticks, and a
 *     number or range, or a name (a letter, then word characters) with "(" before the number
 *     or range and ")" after it (`offset: Some(63)`, `caret: 24`, `byte_range: 34..39`,
 *     `position = 7`), or
 *   - right after the word, a number or range.
 *   A number or range is one or more digits, optionally followed by "..", an optional "=" and
 *   one or more digits.
 * `byte-for-byte`, `byte_to_char(5)`, `byte_to_utf16`, `0.3.0` and `S-023.1.1` don't match.
 */
export function measuredValue(line: string): string | null {
  for (const part of placeholderParts(line)) {
    if (part.kind !== "text") continue;
    const match = MEASURED.exec(part.text);
    if (match) return match[0];
  }
  return null;
}

export function parseStories(
  text: string,
  file: string,
  featureId: string,
): { stories: StoryRaw[]; problems: Problem[] } {
  const parts = splitFrontmatter(text);
  const offset = parts.bodyLine - 1;
  const lines = parts.body.replace(/\r\n?/g, "\n").split("\n");
  const problems: Problem[] = [];
  const stories: StoryRaw[] = [];
  const featureNum = featureId.slice(2);
  let story: StoryRaw | null = null;
  let scenario: Draft | null = null;
  let intentOpen = false;
  let inFence = false;

  const closeScenario = () => {
    if (!scenario || !story) return;
    const done = finishScenario(scenario, file, problems);
    if (done) story.scenarios.push(done);
    scenario = null;
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const lineNo = index + 1 + offset;
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) return;

    const storyMatch = STORY.exec(line);
    if (line.startsWith("## ") || storyMatch) {
      closeScenario();
      intentOpen = false;
      story = null;
      if (!storyMatch) return;
      const [, id = "", title = ""] = storyMatch;
      if (!id.startsWith(`ST-${featureNum}.`)) {
        problems.push(
          problem("E-ID-MISMATCH", file, lineNo, `${id} does not belong to ${featureId}.`, id),
        );
      }
      story = { id, title, intent: "", line: lineNo, scenarios: [] };
      stories.push(story);
      return;
    }

    const scenarioMatch = SCENARIO.exec(line);
    if (line.startsWith("### ") || scenarioMatch) {
      closeScenario();
      intentOpen = false;
      if (!scenarioMatch) return;
      const [, id = "", rest = ""] = scenarioMatch;
      const kindMatch = KIND.exec(rest);
      const title = rest.replace(KIND, "").trim();
      const kind = kindMatch?.[1]?.toLowerCase() ?? null;
      if (!story) {
        problems.push(
          problem("E-STORY-FORMAT", file, lineNo, `${id} is not under a story heading.`, id),
        );
        return;
      }
      if (!id.startsWith(story.id.replace(/^ST-/, "S-") + ".")) {
        problems.push(
          problem("E-ID-MISMATCH", file, lineNo, `${id} does not belong to ${story.id}.`, id),
        );
      }
      if (!kind || !(SCENARIO_KINDS as readonly string[]).includes(kind)) {
        problems.push(
          problem(
            "E-STORY-FORMAT",
            file,
            lineNo,
            `${id} needs a kind tag: {happy}, {negative} or {edge}.`,
            id,
          ),
        );
      }
      scenario = {
        id,
        title,
        kind:
          kind && (SCENARIO_KINDS as readonly string[]).includes(kind)
            ? (kind as ScenarioKind)
            : null,
        line: lineNo,
        clauses: [],
      };
      return;
    }

    const intent = INTENT.exec(line);
    if (intent && story && !scenario) {
      story.intent = intent[1] ?? "";
      intentOpen = true;
      return;
    }
    if (intentOpen && story) {
      if (line.trim() === "") intentOpen = false;
      else story.intent = `${story.intent} ${line.trim()}`.trim();
      return;
    }

    const current = scenario as Draft | null;
    if (!current) return;
    const clause = CLAUSE.exec(line);
    if (clause) {
      const name = (clause[1] ?? "").toUpperCase();
      const body = (clause[2] ?? "").trim();
      const last = current.clauses.at(-1);
      if (name === "AND") {
        if (last) {
          last.text = `${last.text} and ${body}`;
          last.lines.push({ text: body, line: lineNo });
        } else
          problems.push(
            problem("E-STORY-FORMAT", file, lineNo, `${current.id}: AND before GIVEN.`, current.id),
          );
        return;
      }
      current.clauses.push({
        name: name as Clause["name"],
        text: body,
        line: lineNo,
        lines: [{ text: body, line: lineNo }],
      });
      return;
    }
    const last = current.clauses.at(-1);
    const source = last?.lines.at(-1);
    if (last && source && /^\s+\S/.test(raw)) {
      last.text = `${last.text} ${raw.trim()}`;
      source.text = `${source.text} ${raw.trim()}`;
    }
  });
  closeScenario();

  const seen = new Set<string>();
  for (const s of stories) {
    for (const id of [s.id, ...s.scenarios.map((x) => x.id)]) {
      if (seen.has(id))
        problems.push(problem("E-ID-DUP", file, s.line, `${id} is defined more than once.`, id));
      seen.add(id);
    }
  }
  return { stories, problems };
}

function finishScenario(draft: Draft, file: string, problems: Problem[]): ScenarioRaw | null {
  const names = draft.clauses.map((c) => c.name).join(",");
  if (names !== "GIVEN,WHEN,THEN") {
    const missing = (["GIVEN", "WHEN", "THEN"] as const).filter(
      (n) => !draft.clauses.some((c) => c.name === n),
    );
    const reason =
      missing.length > 0
        ? `is missing ${missing.join(", ")}`
        : "must have exactly one GIVEN, WHEN and THEN, in that order";
    problems.push(problem("E-STORY-FORMAT", file, draft.line, `${draft.id} ${reason}.`, draft.id));
  }
  const pick = (n: Clause["name"]) => draft.clauses.find((c) => c.name === n);
  const then = pick("THEN");
  if (then && isVague(then.text)) {
    const quoted = then.text.length > 80 ? `${then.text.slice(0, 77)}…` : then.text;
    problems.push(
      problem(
        "W-VAGUE",
        file,
        then.line,
        `THEN "${quoted}" names no status code, error or state.`,
        draft.id,
      ),
    );
  }
  if (!draft.kind) return null;
  return {
    id: draft.id,
    title: draft.title,
    kind: draft.kind,
    given: pick("GIVEN")?.text ?? "",
    when: pick("WHEN")?.text ?? "",
    then: then?.text ?? "",
    line: draft.line,
    thenLine: then?.line ?? null,
    thenLines: then?.lines ?? [],
  };
}
