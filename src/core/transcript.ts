import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { AzimuthError } from "./errors";
import type { Places } from "./paths";
import { clip, patchLines, toolTarget } from "./tools";
import type { TranscriptDiff, TranscriptEntry, TranscriptText } from "./types";

/**
 * Claude Code's transcripts (JSONL, an internal format) read in bounded windows and normalised
 * into messages, tool calls and subagent cards, so the viewer never parses the format itself.
 */

export const TRANSCRIPT_WINDOW_BYTES = 512 * 1024;
export const TRANSCRIPT_DIFF_LINES = 80;
export const TRANSCRIPT_OUTPUT_LINES = 40;
export const TRANSCRIPT_TEXT_CHARS = 8_000;
export const TRANSCRIPT_LINE_CHARS = 500;

export interface TranscriptWindow {
  /** Complete lines (without "\n"), in file order. */
  lines: string[];
  next: number;
  skipped: boolean;
}

const NL = 0x0a;
const SCAN_BYTES = 64 * 1024;

function readAt(fd: number, from: number, to: number): Buffer {
  const buf = Buffer.alloc(to - from);
  return buf.subarray(0, readSync(fd, buf, 0, buf.length, from));
}

/** The lines of a buffer that ends with a line end. */
const completeLines = (buf: Buffer) => buf.toString("utf8").split("\n").slice(0, -1);

function readTail(fd: number, size: number, windowBytes: number): TranscriptWindow {
  if (size === 0) return { lines: [], next: 0, skipped: false };
  const start = Math.max(0, size - windowBytes);
  // The byte before the window tells whether the window starts exactly at a line.
  const from = Math.max(0, start - 1);
  const buf = readAt(fd, from, size);
  const last = buf.lastIndexOf(NL);
  if (last === -1 || from + last < start) return { lines: [], next: size, skipped: true };
  const first = start === 0 ? 0 : buf.indexOf(NL) + 1;
  const end = last + 1;
  return {
    lines: first < end ? completeLines(buf.subarray(first, end)) : [],
    next: from + end,
    skipped: from + first > 0,
  };
}

/** The position of the first line end at or after `from`, or null when the line has none yet. */
function lineEndFrom(fd: number, from: number, size: number): number | null {
  for (let at = from; at < size; at += SCAN_BYTES) {
    const hit = readAt(fd, at, Math.min(size, at + SCAN_BYTES)).indexOf(NL);
    if (hit !== -1) return at + hit;
  }
  return null;
}

function readForward(
  fd: number,
  size: number,
  after: number,
  windowBytes: number,
): TranscriptWindow {
  const still = { lines: [], next: after, skipped: false };
  if (after === size) return still;
  const end = Math.min(size, after + windowBytes);
  const buf = readAt(fd, after, end);
  const last = buf.lastIndexOf(NL);
  if (last !== -1)
    return {
      lines: completeLines(buf.subarray(0, last + 1)),
      next: after + last + 1,
      skipped: false,
    };
  // A line longer than the window: skip it whole once it is complete.
  const lineEnd = end < size ? lineEndFrom(fd, end, size) : null;
  return lineEnd === null ? still : { lines: [], next: lineEnd + 1, skipped: true };
}

/**
 * Complete lines of a transcript. Without `after`: the lines lying entirely within the last
 * `windowBytes` bytes; `skipped` when content before the first of them wasn't returned; `next`
 * just after the last line end in the window (for a non-empty file whose window holds no line
 * end: the file size, with `skipped` true; for an empty file: 0). With `after`: the
 * complete lines from `after` within `windowBytes`; when none ends in the window and the file
 * goes on, scans to the end of that line and returns no lines, `next` after it and `skipped`
 * true; at the end of the file, no lines and `next` = `after`.
 * Throws AzimuthError("invalid") when `after` isn't an integer from 0 to the file size.
 */
export function readTranscriptWindow(
  path: string,
  after: number | null,
  windowBytes = TRANSCRIPT_WINDOW_BYTES,
): TranscriptWindow {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    if (after !== null && (!Number.isInteger(after) || after < 0 || after > size))
      throw new AzimuthError("invalid", `after must be a byte offset between 0 and ${size}.`);
    return after === null
      ? readTail(fd, size, windowBytes)
      : readForward(fd, size, after, windowBytes);
  } finally {
    closeSync(fd);
  }
}

type Json = Record<string, unknown>;
type Call = Extract<TranscriptEntry, { kind: "tool" | "spawn" }>;

const isObject = (value: unknown): value is Json =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value : null);

function parseLine(line: string): Json | null {
  try {
    const value: unknown = JSON.parse(line);
    return isObject(value) ? value : null;
  } catch {
    // Not JSON (a torn or foreign line): skipped like any unknown entry.
    return null;
  }
}

/** A text's lines: "" has none, a final "\n" doesn't start another. */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.slice(0, -1) : lines;
}

const clipLine = (line: string) => clip(line, TRANSCRIPT_LINE_CHARS);

function tail(lines: string[]): TranscriptText {
  return {
    lines: lines.slice(-TRANSCRIPT_OUTPUT_LINES).map(clipLine),
    truncated: lines.length > TRANSCRIPT_OUTPUT_LINES,
  };
}

function head(lines: string[]): TranscriptText {
  return {
    lines: lines.slice(0, TRANSCRIPT_OUTPUT_LINES).map(clipLine),
    truncated: lines.length > TRANSCRIPT_OUTPUT_LINES,
  };
}

/** A tool_result block's text: a string, or its text blocks. */
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((b) =>
      isObject(b) && b.type === "text" && typeof b.text === "string" ? [b.text] : [],
    )
    .join("\n");
}

const isAgentTool = (name: string) => name === "Agent" || name === "Task";
const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "Write"]);

/** A Write that created a file: its content as added lines. */
function createdLines(result: Json, input: Json) {
  if (result.type !== "create") return null;
  const lines = splitLines(str(result.content) ?? str(input.content) ?? "");
  return { lines: lines.map((l) => `+${l}`), added: lines.length, removed: 0 };
}

/** The diff a result records: its structuredPatch, or a created file's content. */
function diffOf(result: unknown, input: Json): TranscriptDiff | null {
  if (!isObject(result)) return null;
  const diff = patchLines(result.structuredPatch) ?? createdLines(result, input);
  if (!diff) return null;
  return {
    lines: diff.lines.slice(0, TRANSCRIPT_DIFF_LINES).map(clipLine),
    truncated: diff.lines.length > TRANSCRIPT_DIFF_LINES,
    added: diff.added,
    removed: diff.removed,
  };
}

/** Bash's stdout then stderr, when the result has them. */
function shellOutput(result: unknown): TranscriptText | null {
  if (!isObject(result) || typeof result.stdout !== "string") return null;
  return tail([...splitLines(result.stdout), ...splitLines(str(result.stderr) ?? "")]);
}

const agentIdOf = (result: unknown) => (isObject(result) ? str(result.agentId) : null);

/** A finished call's output: a subagent's returned text, Bash's stdout and stderr; else none. */
function outputOf(name: string | null, text: string[], result: unknown): TranscriptText | null {
  if (name === null) return agentIdOf(result) ? head(text) : shellOutput(result);
  if (isAgentTool(name)) return head(text);
  if (name === "Bash") return shellOutput(result) ?? tail(text);
  return null;
}

/**
 * What a finished call shows: its status, diff, output and the subagent it ran. `name` is null
 * for a result whose call isn't in the page, which is then read by its shape.
 */
function outcome(
  name: string | null,
  input: Json,
  block: Json,
  result: unknown,
): {
  status: "ok" | "error";
  diff: TranscriptDiff | null;
  output: TranscriptText | null;
  agent_id: string | null;
} {
  const text = splitLines(resultText(block.content));
  const agent_id = agentIdOf(result);
  if (block.is_error === true) return { status: "error", diff: null, output: tail(text), agent_id };
  const diff = name === null || EDIT_TOOLS.has(name) ? diffOf(result, input) : null;
  return { status: "ok", diff, output: outputOf(name, text, result), agent_id };
}

/** Claude Code transcript lines → entries (rules in feature.md Assumptions). Never throws. */
export function normalizeTranscript(lines: string[], places: Places): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const calls = new Map<string, { entry: Call; name: string; input: Json }>();
  const others = { home: places.home, plugin: places.plugin ?? null };

  const message = (role: "user" | "assistant", text: string, at: string | null) => {
    if (text.trim())
      entries.push({ kind: "message", role, text: clip(text, TRANSCRIPT_TEXT_CHARS), at });
  };

  const toolUse = (block: Json, at: string | null) => {
    const id = str(block.id);
    const name = str(block.name);
    if (!id || !name) return;
    const input = isObject(block.input) ? block.input : {};
    const entry: Call = isAgentTool(name)
      ? {
          kind: "spawn",
          tool_use_id: id,
          description: str(input.description) ?? "",
          agent_type: str(input.subagent_type),
          agent_id: null,
          status: "running",
          output: null,
          at,
        }
      : {
          kind: "tool",
          tool_use_id: id,
          name,
          target: toolTarget(places.root, name, input, others),
          summary: name === "Bash" ? str(input.description) : null,
          status: "running",
          diff: null,
          output: null,
          at,
        };
    calls.set(id, { entry, name, input });
    entries.push(entry);
  };

  const toolResult = (block: Json, result: unknown, at: string | null) => {
    const id = str(block.tool_use_id);
    if (!id) return;
    const call = calls.get(id);
    if (!call) {
      entries.push({ kind: "result", tool_use_id: id, ...outcome(null, {}, block, result), at });
      return;
    }
    const { entry, name, input } = call;
    const done = outcome(name, input, block, result);
    entry.status = done.status;
    entry.output = done.output;
    if (entry.kind === "spawn") entry.agent_id = done.agent_id;
    else entry.diff = done.diff;
  };

  for (const line of lines) {
    const entry = parseLine(line);
    const role = entry?.type;
    if (!entry || (role !== "user" && role !== "assistant")) continue;
    const at = str(entry.timestamp);
    const content = isObject(entry.message) ? entry.message.content : undefined;
    if (typeof content === "string") {
      message(role, content, at);
      continue;
    }
    if (!Array.isArray(content)) continue;
    // The entry's toolUseResult belongs to its first tool_result block.
    let result: unknown = entry.toolUseResult;
    for (const block of content) {
      if (!isObject(block)) continue;
      if (block.type === "text" && typeof block.text === "string") message(role, block.text, at);
      if (block.type === "tool_use" && role === "assistant") toolUse(block, at);
      if (block.type === "tool_result" && role === "user") {
        toolResult(block, result, at);
        result = undefined;
      }
    }
  }
  return entries;
}
