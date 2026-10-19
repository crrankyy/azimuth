import type { TranscriptEntry } from "../../../../src/core/types";
import type { AgentRow } from "../../data/agents";

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
  _rows: AgentRow[],
  _current: string | null,
  _delta: -1 | 1,
): AgentRow | null {
  return null;
}

/** Tool and spawn entries. */
export function toolCalls(_entries: TranscriptEntry[]): number {
  return 0;
}

/** Edit, MultiEdit, Write, NotebookEdit targets as "edited", then Read targets as "read"; edited wins; each first seen first. */
export function touchedFiles(_entries: TranscriptEntry[]): TouchedFile[] {
  return [];
}

/** Tool entries start open when they have a diff or their status isn't "ok"; other entries always show. */
export function startsOpen(_entry: TranscriptEntry): boolean {
  return false;
}

/** Null when the agent is done; its wait reason while waiting; else "Waiting for <type>…" after a running spawn, or "Working…". */
export function nowLine(_row: AgentRow, _entries: TranscriptEntry[]): NowLine | null {
  return null;
}

/** "@@…" → "hunk", "+…" → "add", "-…" → "del", otherwise null. */
export function diffLineClass(_line: string): "hunk" | "add" | "del" | null {
  return null;
}
