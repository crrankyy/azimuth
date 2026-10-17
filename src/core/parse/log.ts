import { splitFrontmatter } from "../frontmatter";
import { LOG_TYPES, type Actor, type LogEntry, type LogType, type Problem } from "../types";
import { problem } from "./common";

const HEADER =
  /^##\s+(\S+)\s+·\s+(you|agent)\s+·\s+([a-z-]+)(?:\s+·\s+(SES-[\d-]+))?(?:\s+·\s+(auto))?\s*$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const TRANSITION = /^\s*([a-z-]+)\s*(?:→|->)\s*([a-z-]+)/;

export interface LogEntryRaw extends LogEntry {
  line: number;
}

/** Reads `from → to` from the first line of a transition body. */
export function parseTransition(body: string): { from: string; to: string } | null {
  const match = TRANSITION.exec(body.split("\n")[0] ?? "");
  return match ? { from: match[1] ?? "", to: match[2] ?? "" } : null;
}

export function formatLogHeader(entry: {
  at: string;
  actor: Actor;
  type: LogType;
  session?: string | null;
  auto?: boolean;
}): string {
  const parts = [entry.at, entry.actor, entry.type];
  if (entry.session) parts.push(entry.session);
  if (entry.auto) parts.push("auto");
  return `## ${parts.join(" · ")}`;
}

export function parseLog(
  text: string,
  file: string,
): { entries: LogEntryRaw[]; problems: Problem[] } {
  const parts = splitFrontmatter(text);
  const offset = parts.bodyLine - 1;
  const lines = parts.body.replace(/\r\n?/g, "\n").split("\n");
  const entries: LogEntryRaw[] = [];
  const problems: Problem[] = [];
  let body: string[] = [];
  let current: Omit<LogEntryRaw, "body" | "transition"> | null = null;

  const flush = () => {
    if (!current) return;
    const text = body.join("\n").trim();
    entries.push({
      ...current,
      body: text,
      transition: current.type === "transition" ? parseTransition(text) : null,
    });
    if (current.type === "transition" && !parseTransition(text)) {
      problems.push(
        problem(
          "E-LOG-FORMAT",
          file,
          current.line,
          "A transition entry must start with `from → to`.",
        ),
      );
    }
  };

  lines.forEach((line, index) => {
    if (!line.startsWith("## ")) {
      if (current) body.push(line);
      return;
    }
    flush();
    current = null;
    body = [];
    const lineNo = index + 1 + offset;
    const match = HEADER.exec(line.trimEnd());
    if (
      !match ||
      !TIMESTAMP.test(match[1] ?? "") ||
      !(LOG_TYPES as readonly string[]).includes(match[3] ?? "")
    ) {
      problems.push(
        problem(
          "E-LOG-FORMAT",
          file,
          lineNo,
          "Log headers look like `## <timestamp> · <you|agent> · <note|transition|review|override>[ · <session>][ · auto]`.",
        ),
      );
      return;
    }
    current = {
      at: match[1] ?? "",
      actor: match[2] as Actor,
      type: match[3] as LogType,
      session: match[4] ?? null,
      auto: match[5] === "auto",
      line: lineNo,
    };
  });
  flush();
  return { entries, problems };
}
