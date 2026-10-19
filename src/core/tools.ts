import { isAbsolute, relative } from "node:path";
import { tidyPaths, type Places } from "./paths";

/**
 * What Claude Code's tool calls change and act on, shared by the hooks (live records) and the
 * transcript normaliser, so the Agents tab and the transcript agree.
 */
export interface EditSize {
  added: number;
  removed: number;
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const relTo = (root: string, file: string) =>
  isAbsolute(file) ? relative(root, file).split("\\").join("/") : file;

/** A path for display: relative inside the project, tidied (`~`, `<plugin>`) outside it. */
export function displayPath(root: string, file: string, places: Omit<Places, "root">): string {
  const rel = relTo(root, file);
  return rel.startsWith("..") ? tidyPaths(file, { ...places, root }) : rel;
}

/** Lines in a text: "" has 0, a final "\n" doesn't start another line. */
export function lineCount(text: string): number {
  if (text === "") return 0;
  const lines = text.split("\n").length;
  return text.endsWith("\n") ? lines - 1 : lines;
}

function isHunk(value: unknown): value is Hunk {
  if (!value || typeof value !== "object") return false;
  const h = value as Record<string, unknown>;
  return (
    ["oldStart", "oldLines", "newStart", "newLines"].every((k) => typeof h[k] === "number") &&
    Array.isArray(h.lines) &&
    h.lines.every((line) => typeof line === "string")
  );
}

/**
 * A structuredPatch (hunks {oldStart, oldLines, newStart, newLines, lines}) as diff lines: per
 * hunk an "@@ -oldStart,oldLines +newStart,newLines @@" header then its lines, with the counts of
 * "+" and "-" lines. Null when `patch` isn't a non-empty array of hunks.
 */
export function patchLines(
  patch: unknown,
): { lines: string[]; added: number; removed: number } | null {
  if (!Array.isArray(patch) || patch.length === 0 || !patch.every(isHunk)) return null;
  const lines = patch.flatMap((h) => [
    `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
    ...h.lines,
  ]);
  const body = patch.flatMap((h) => h.lines);
  return {
    lines,
    added: body.filter((l) => l.startsWith("+")).length,
    removed: body.filter((l) => l.startsWith("-")).length,
  };
}

/** An Edit's (or one MultiEdit edit's) size from its strings; null without them. */
function stringsSize(edit: unknown): EditSize | null {
  const e = (edit ?? {}) as Record<string, unknown>;
  if (typeof e.old_string !== "string" || typeof e.new_string !== "string") return null;
  return { added: lineCount(e.new_string), removed: lineCount(e.old_string) };
}

/**
 * Lines an Edit, MultiEdit or Write added and removed: from the response's structuredPatch when
 * it has a hunk, else from the input (Edit: new_string/old_string; MultiEdit: the sum over
 * edits[]; Write: content, removed 0). Null for other tools or when the input has no strings.
 */
export function editSize(
  tool: string,
  input: Record<string, unknown> | undefined,
  response: unknown,
): EditSize | null {
  if (tool !== "Edit" && tool !== "MultiEdit" && tool !== "Write") return null;
  const patch = patchLines((response as { structuredPatch?: unknown } | null)?.structuredPatch);
  if (patch) return { added: patch.added, removed: patch.removed };
  if (tool === "Edit") return stringsSize(input);
  if (tool === "Write")
    return typeof input?.content === "string"
      ? { added: lineCount(input.content), removed: 0 }
      : null;
  const sizes = (Array.isArray(input?.edits) ? input.edits : [])
    .map(stringsSize)
    .filter((s): s is EditSize => s !== null);
  if (sizes.length === 0) return null;
  return {
    added: sizes.reduce((n, s) => n + s.added, 0),
    removed: sizes.reduce((n, s) => n + s.removed, 0),
  };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * What a call acts on, for wait reasons and transcripts: Bash's first command line (whitespace
 * collapsed, tidyPaths, 120 characters); Read, Edit, MultiEdit, Write, NotebookEdit and any other
 * tool with file_path/notebook_path/path: its display path (relative in the project, tidied
 * outside); Grep and Glob: pattern; WebFetch: the URL's host; WebSearch: query; Agent and Task:
 * description (each clipped to 120); otherwise "".
 */
export function toolTarget(
  root: string,
  tool: string,
  input: Record<string, unknown> | undefined,
  places: Omit<Places, "root">,
): string {
  const args = input ?? {};
  switch (tool) {
    case "Bash": {
      const line = text(args.command).split("\n")[0] ?? "";
      return clip(tidyPaths(line.replace(/\s+/g, " ").trim(), { ...places, root }));
    }
    case "Grep":
    case "Glob":
      return clip(text(args.pattern));
    case "WebFetch":
      try {
        return clip(new URL(text(args.url)).host);
      } catch {
        // Not a URL: there is no host to name.
        return "";
      }
    case "WebSearch":
      return clip(text(args.query));
    case "Agent":
    case "Task":
      return clip(text(args.description));
  }
  const path = text(args.file_path ?? args.notebook_path ?? args.path);
  return path ? clip(displayPath(root, path, places)) : "";
}
