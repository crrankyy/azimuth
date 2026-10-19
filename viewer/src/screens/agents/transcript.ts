import type { TranscriptEntry } from "../../../../src/core/types";
import type { AgentRow } from "../../data/agents";
import { AGENT_LOOK } from "../../lib/status";

export type TranscriptKey = "prev" | "next" | "follow" | "back";

/** { "[": "prev", "]": "next", f: "follow", Escape: "back" }. */
export const TRANSCRIPT_KEYS: Record<string, TranscriptKey> = {
  "[": "prev",
  "]": "next",
  f: "follow",
  Escape: "back",
};

export interface TouchedFile {
  path: string;
  how: "edited" | "read";
}

export interface NowLine {
  status: "running" | "waiting";
  /** "Waiting for test-runner…" | "Working…" | the wait reason. */
  text: string;
}

/** The row `delta` steps from the current tab (agent ID, null = main); null past either end. */
export function stepAgent(
  rows: AgentRow[],
  current: string | null,
  delta: -1 | 1,
): AgentRow | null {
  const at = rows.findIndex((r) => r.agent_id === current);
  if (at < 0) return null;
  return rows[at + delta] ?? null;
}

/** Tool and spawn entries. */
export function toolCalls(entries: TranscriptEntry[]): number {
  return entries.filter((e) => e.kind === "tool" || e.kind === "spawn").length;
}

const EDITS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

/** Edit, MultiEdit, Write, NotebookEdit targets as "edited", then Read targets as "read"; edited wins; each first seen first. */
export function touchedFiles(entries: TranscriptEntry[]): TouchedFile[] {
  const tools = entries.filter((e) => e.kind === "tool");
  const edited = new Set(tools.filter((e) => EDITS.has(e.name)).map((e) => e.target));
  const read = new Set(
    tools.filter((e) => e.name === "Read" && !edited.has(e.target)).map((e) => e.target),
  );
  return [
    ...[...edited].map((path) => ({ path, how: "edited" as const })),
    ...[...read].map((path) => ({ path, how: "read" as const })),
  ];
}

/** Tool entries start open when they have a diff or their status isn't "ok"; other entries always show. */
export function startsOpen(entry: TranscriptEntry): boolean {
  if (entry.kind !== "tool") return true;
  return entry.diff !== null || entry.status !== "ok";
}

/** Null when the agent is done; its wait reason while waiting; else "Waiting for <type>…" after a running spawn, or "Working…". */
export function nowLine(row: AgentRow, entries: TranscriptEntry[]): NowLine | null {
  if (row.status === "done") return null;
  if (row.status === "waiting")
    return { status: "waiting", text: row.waiting?.reason ?? AGENT_LOOK.waiting.label };
  const last = entries.at(-1);
  if (last?.kind === "spawn" && last.status === "running")
    return { status: "running", text: `Waiting for ${last.agent_type ?? "subagent"}…` };
  return { status: "running", text: "Working…" };
}

/** "@@…" → "hunk", "+…" → "add", "-…" → "del", otherwise null. */
export function diffLineClass(line: string): "hunk" | "add" | "del" | null {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return null;
}
