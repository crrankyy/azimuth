import {
  Document,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  visit,
  type Node,
  type Pair,
  type YAMLMap,
} from "yaml";

/** A Markdown file split at its frontmatter fences. The body bytes are never re-serialized. */
export interface FrontmatterFile {
  bom: string;
  eol: "\n" | "\r\n";
  /** YAML between the fences, or null when the file has no frontmatter. */
  yaml: string | null;
  body: string;
  /** 1-based line number of the first body line. */
  bodyLine: number;
}

export interface FrontmatterError {
  message: string;
  line: number | null;
}

export interface ParsedFrontmatter extends FrontmatterFile {
  data: Record<string, unknown>;
  errors: FrontmatterError[];
  /** 1-based line of each top-level key, for problem reporting. */
  keyLines: Record<string, number>;
}

const FENCE = /^---[ \t]*$/;

export function splitFrontmatter(text: string): FrontmatterFile {
  const bom = text.startsWith("﻿") ? "﻿" : "";
  const src = bom ? text.slice(1) : text;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(eol);
  if (lines.length < 2 || !FENCE.test(lines[0] ?? "")) {
    return { bom, eol, yaml: null, body: src, bodyLine: 1 };
  }
  const close = lines.findIndex((line, i) => i > 0 && FENCE.test(line));
  if (close === -1) return { bom, eol, yaml: null, body: src, bodyLine: 1 };
  return {
    bom,
    eol,
    yaml: lines.slice(1, close).join(eol),
    body: lines.slice(close + 1).join(eol),
    bodyLine: close + 2,
  };
}

/** Short git SHAs such as `4e12345` would otherwise parse as numbers. */
const HEX_ID = /^[0-9a-f]{7,40}$/i;

function toJS(node: unknown): unknown {
  if (node === null || node === undefined) return null;
  if (isMap(node)) {
    const out: Record<string, unknown> = {};
    for (const pair of node.items) {
      const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      out[key] = toJS(pair.value);
    }
    return out;
  }
  if (isSeq(node)) return node.items.map(toJS);
  if (isScalar(node)) {
    if (typeof node.value === "number" && node.source && HEX_ID.test(node.source)) {
      return node.source;
    }
    return node.value;
  }
  if (isAlias(node)) return null;
  return node;
}

function lineOfOffset(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const parts = splitFrontmatter(text);
  const empty = { ...parts, data: {}, errors: [], keyLines: {} };
  if (parts.yaml === null || parts.yaml.trim() === "") return empty;
  const doc = parseDocument(parts.yaml, { keepSourceTokens: true });
  // The YAML starts on line 2 of the file (line 1 is the opening fence).
  const errors: FrontmatterError[] = doc.errors.map((e) => ({
    message: e.message.split("\n")[0] ?? e.message,
    line: e.linePos ? e.linePos[0].line + 1 : null,
  }));
  if (!isMap(doc.contents)) {
    if (errors.length === 0)
      errors.push({ message: "Frontmatter must be a YAML mapping", line: 2 });
    return { ...empty, errors };
  }
  const keyLines: Record<string, number> = {};
  for (const pair of doc.contents.items) {
    if (isScalar(pair.key) && pair.key.range) {
      keyLines[String(pair.key.value)] = lineOfOffset(parts.yaml, pair.key.range[0]) + 1;
    }
  }
  return { ...parts, data: toJS(doc.contents) as Record<string, unknown>, errors, keyLines };
}

/**
 * Serialize a value for a single `key: value` line; collections use flow style. `padded` puts a
 * space inside flow collections, `{ path: src/a.ts, change: create }`.
 */
export function inlineYaml(value: unknown, opts: { padded?: boolean } = {}): string {
  const doc = new Document(value);
  visit(doc, {
    Map: (_, node) => {
      node.flow = true;
    },
    Seq: (_, node) => {
      node.flow = true;
    },
    Scalar: (_, node) => {
      // Keep multi-line strings on one line; a block scalar would need its own indentation.
      if (typeof node.value === "string" && node.value.includes("\n")) node.type = "QUOTE_DOUBLE";
    },
  });
  return doc
    .toString({ lineWidth: 0, flowCollectionPadding: opts.padded ?? false })
    .replace(/\n$/, "");
}

function isPlainScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Set top-level frontmatter keys while leaving every other byte of the file untouched.
 * Existing scalar values are replaced in place; other existing values are rewritten as a single
 * flow-style line; new keys are appended at the end of the frontmatter.
 */
export function updateFrontmatter(text: string, updates: Record<string, unknown>): string {
  const parts = splitFrontmatter(text);
  const { eol } = parts;
  const fixEol = (s: string) => (eol === "\n" ? s : s.replace(/\r?\n/g, eol));
  if (parts.yaml === null) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}: ${inlineYaml(v)}`);
    return parts.bom + fixEol(["---", ...lines, "---", ""].join("\n")) + parts.body;
  }
  const yaml = parts.yaml;
  const doc = parseDocument(yaml, { keepSourceTokens: true });
  if (doc.errors.length > 0) {
    throw new Error(`Cannot edit invalid frontmatter: ${doc.errors[0]?.message ?? "parse error"}`);
  }
  const map = (isMap(doc.contents) ? doc.contents : null) as YAMLMap<unknown, unknown> | null;
  const edits: Edit[] = [];
  const appends: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const pair = map?.items.find(
      (p): p is Pair<Node, Node | null> => isScalar(p.key) && p.key.value === key,
    );
    if (!pair || !isScalar(pair.key) || !pair.key.range) {
      appends.push(`${key}: ${inlineYaml(value)}`);
      continue;
    }
    const valueNode = pair.value;
    if (isScalar(valueNode) && valueNode.range && isPlainScalar(value)) {
      const [start, end] = valueNode.range;
      // An empty value (`key:`) has a zero-length range; keep the space after the colon.
      const prefix = start === end && yaml[start - 1] === ":" ? " " : "";
      edits.push({ start, end, text: prefix + inlineYaml(value) });
      continue;
    }
    const keyStart = pair.key.range[0];
    let end = valueNode?.range ? valueNode.range[1] : pair.key.range[2];
    // Block collections include their trailing line break; keep it for the next key.
    while (end > keyStart && (yaml[end - 1] === "\n" || yaml[end - 1] === "\r")) end--;
    edits.push({ start: keyStart, end, text: `${key}: ${inlineYaml(value)}` });
  }
  let out = applyEdits(yaml, edits, fixEol);
  if (appends.length > 0) {
    const trimmed = out.replace(/(\r?\n)+$/, "");
    const trailing = out.slice(trimmed.length);
    out = (trimmed === "" ? "" : trimmed + eol) + fixEol(appends.join("\n")) + trailing;
  }
  return replaceYaml(text, parts, out);
}

function applyEdits(yaml: string, edits: Edit[], fixEol: (s: string) => string): string {
  let out = yaml;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + fixEol(edit.text) + out.slice(edit.end);
  }
  return out;
}

function replaceYaml(text: string, parts: FrontmatterFile, yaml: string): string {
  const lines = text.slice(parts.bom.length).split(parts.eol);
  const close = lines.findIndex((line, i) => i > 0 && FENCE.test(line));
  return parts.bom + [lines[0], yaml, ...lines.slice(close)].join(parts.eol);
}

/**
 * Sets keys on one mapping inside a top-level list (e.g. a task in `tasks:`), editing only the
 * affected values. Missing keys are inserted after the item's last key at the same indentation.
 * Returns null when no item matches.
 */
export function updateFrontmatterItem(
  text: string,
  listKey: string,
  match: (item: Record<string, unknown>) => boolean,
  updates: Record<string, unknown>,
): string | null {
  const parts = splitFrontmatter(text);
  if (parts.yaml === null) return null;
  const yaml = parts.yaml;
  const { eol } = parts;
  const fixEol = (s: string) => (eol === "\n" ? s : s.replace(/\r?\n/g, eol));
  const doc = parseDocument(yaml, { keepSourceTokens: true });
  if (doc.errors.length > 0 || !isMap(doc.contents)) return null;
  const list = doc.contents.items.find((p) => isScalar(p.key) && p.key.value === listKey)?.value;
  if (!isSeq(list)) return null;
  const item = list.items.find(
    (node) => isMap(node) && match(toJS(node) as Record<string, unknown>),
  );
  if (!isMap(item) || item.items.length === 0) return null;

  const first = item.items[0]?.key;
  const firstStart = isScalar(first) && first.range ? first.range[0] : 0;
  const lineStart = yaml.lastIndexOf("\n", firstStart - 1) + 1;
  const indent = " ".repeat(firstStart - lineStart);
  const last = item.items[item.items.length - 1];
  let insertAt =
    (last?.value as Node | null)?.range?.[1] ??
    (last?.key as Node | null)?.range?.[2] ??
    firstStart;
  while (insertAt > 0 && (yaml[insertAt - 1] === "\n" || yaml[insertAt - 1] === "\r")) insertAt--;

  const edits: Edit[] = [];
  const inserts: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const pair = item.items.find((p) => isScalar(p.key) && p.key.value === key);
    const valueNode = pair?.value as Node | null | undefined;
    if (pair && isScalar(valueNode) && valueNode.range && isPlainScalar(value)) {
      const [start, end] = valueNode.range;
      const prefix = start === end && yaml[start - 1] === ":" ? " " : "";
      edits.push({ start, end, text: prefix + inlineYaml(value) });
    } else if (pair && isScalar(pair.key) && pair.key.range) {
      let end = valueNode?.range ? valueNode.range[1] : pair.key.range[2];
      while (end > pair.key.range[0] && (yaml[end - 1] === "\n" || yaml[end - 1] === "\r")) end--;
      edits.push({ start: pair.key.range[0], end, text: `${key}: ${inlineYaml(value)}` });
    } else {
      inserts.push(`\n${indent}${key}: ${inlineYaml(value)}`);
    }
  }
  if (inserts.length > 0) edits.push({ start: insertAt, end: insertAt, text: inserts.join("") });
  return replaceYaml(text, parts, applyEdits(yaml, edits, fixEol));
}
