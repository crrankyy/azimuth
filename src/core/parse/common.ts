import { parseFrontmatter, type ParsedFrontmatter } from "../frontmatter";
import type { Problem } from "../types";

export interface Parsed<T> {
  entity: T | null;
  problems: Problem[];
}

export function problem(
  code: string,
  file: string,
  line: number | null,
  message: string,
  ref: string | null = null,
  severity: "error" | "warning" = code.startsWith("W-") ? "warning" : "error",
): Problem {
  return { code, severity, file, line, ref, message };
}

/** Parses frontmatter, turning YAML errors into `E-PARSE` problems. */
export function readFrontmatter(
  text: string,
  file: string,
): { fm: ParsedFrontmatter; problems: Problem[]; ok: boolean } {
  const fm = parseFrontmatter(text);
  const problems = fm.errors.map((e) => problem("E-PARSE", file, e.line, e.message));
  return { fm, problems, ok: problems.length === 0 };
}

/** The ID encoded in a file or folder name (`ADR-0003-full-jitter.md` → `ADR-0003`). */
export function idFromName(name: string, pattern: RegExp): string | null {
  const match = pattern.exec(name);
  return match ? match[0] : null;
}

export function idMismatch(
  file: string,
  declared: string | null,
  fromName: string | null,
): Problem[] {
  if (!declared || !fromName || declared === fromName) return [];
  return [
    problem(
      "E-ID-MISMATCH",
      file,
      2,
      `File name says ${fromName} but the frontmatter id is ${declared}.`,
      declared,
    ),
  ];
}
