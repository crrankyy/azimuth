import { Fragment, type ReactNode } from "react";
import type { GlossaryTerm } from "../../../src/core/types";
import { CodeBlock } from "../components/CodeBlock";
import { IdChip } from "../components/IdChip";

/**
 * Markdown → React elements for the subset Azimuth files use (headings, paragraphs, lists, code
 * fences, quotes, tables, emphasis, inline code, links). It never produces HTML strings, so file
 * content can't inject markup; link schemes are allowlisted. IDs become IdChips and glossary
 * terms get their definition on hover.
 */

export interface MarkdownOptions {
  terms?: GlossaryTerm[];
  /** Turn IDs into chips (default true). */
  chips?: boolean;
}

const SAFE_URL = /^(https?:|mailto:|#|\/|\.\/)/i;
const ID =
  /\b(?:F-\d{3}|ST-\d{3}\.\d+|S-\d{3}\.\d+\.\d+|T-\d{3}\.\d+|ADR-\d{4}|Q-\d{4}|(?:BUG|DEBT|RISK)-\d{4}|SES-\d{8}-\d{4}(?:-\d+)?|R-\d{4}|M-\d{2})\b/;

/** Deterministic keys per render: the same content produces the same keys. */
function counter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}${n++}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain text with IDs and glossary terms decorated. */
function decorate(text: string, opts: MarkdownOptions, k: () => string): ReactNode[] {
  const terms = opts.terms ?? [];
  const words = terms.flatMap((t) => [t.term, ...t.aliases].map((w) => ({ w, t })));
  const termPattern = words.length
    ? new RegExp(
        `\\b(${words
          .map((x) => escapeRegExp(x.w))
          .sort((a, b) => b.length - a.length)
          .join("|")})\\b`,
        "i",
      )
    : null;
  const out: ReactNode[] = [];
  let rest = text;
  while (rest) {
    const id = opts.chips === false ? null : ID.exec(rest);
    const term = termPattern?.exec(rest) ?? null;
    const next = [id, term]
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => a.index - b.index)[0];
    if (!next) {
      out.push(rest);
      break;
    }
    if (next.index > 0) out.push(rest.slice(0, next.index));
    if (next === id) {
      out.push(<IdChip key={k()} id={next[0]} />);
    } else {
      const hit = words.find((x) => x.w.toLowerCase() === next[0].toLowerCase());
      out.push(
        <span
          key={k()}
          className="az-term"
          title={hit ? `${hit.t.term}: ${hit.t.definition}` : undefined}
        >
          {next[0]}
        </span>,
      );
    }
    rest = rest.slice(next.index + next[0].length);
  }
  return out;
}

/** Inline Markdown: `code`, **bold**, *em*, [links](url), plus decoration. */
export function inline(text: string, opts: MarkdownOptions = {}): ReactNode[] {
  const k = counter("i");
  const out: ReactNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/;
  let rest = text;
  while (rest) {
    const m = pattern.exec(rest);
    if (!m) {
      out.push(...decorate(rest, opts, k));
      break;
    }
    if (m.index > 0) out.push(...decorate(rest.slice(0, m.index), opts, k));
    const token = m[0];
    if (m[1]) out.push(<code key={k()}>{token.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k()}>{inline(token.slice(2, -2), opts)}</strong>);
    else if (m[3]) out.push(<em key={k()}>{inline(token.slice(1, -1), opts)}</em>);
    else {
      const [, label = "", url = ""] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];
      out.push(
        SAFE_URL.test(url) ? (
          <a
            key={k()}
            href={url}
            target={url.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {inline(label, opts)}
          </a>
        ) : (
          <Fragment key={k()}>{label}</Fragment>
        ),
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Block Markdown. Headings render one level below the page title (## → h2 styling). */
export function Markdown({ text, options = {} }: { text: string; options?: MarkdownOptions }) {
  const k = counter("b");
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] as string).trim().startsWith(fence[1] as string))
        body.push(lines[i++] as string);
      i++;
      blocks.push(<CodeBlock key={k()} code={body.join("\n")} language={fence[2] ?? ""} />);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, Math.max(2, (heading[1] as string).length));
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      blocks.push(<Tag key={k()}>{inline(heading[2] as string, options)}</Tag>);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={k()} />);
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const head = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] as string).trim().startsWith("|"))
        rows.push(tableCells(lines[i++] as string));
      blocks.push(
        <table key={k()} className="az-table">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={k()}>{inline(h, options)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={k()}>
                {r.map((c) => (
                  <td key={k()}>{inline(c, options)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] as string))
        quote.push((lines[i++] as string).replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={k()}>
          <Markdown text={quote.join("\n")} options={options} />
        </blockquote>,
      );
      continue;
    }
    const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1] as string);
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i] as string;
        const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(l);
        if (item) items.push(item[2] as string);
        else if (l.trim() && /^\s{2,}/.test(l) && items.length)
          items[items.length - 1] += ` ${l.trim()}`;
        else break;
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={k()}>
          {items.map((it) => (
            <li key={k()}>{inline(it, options)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] as string).trim() &&
      !/^(#{1,6}\s|\s*(```|~~~)|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i] as string)
    ) {
      para.push((lines[i++] as string).trim());
    }
    blocks.push(<p key={k()}>{inline(para.join(" "), options)}</p>);
  }
  return <>{blocks}</>;
}

/** A Markdown body in the `.az-prose` style. */
export function Prose({
  text,
  options,
  className = "",
}: {
  text: string;
  options?: MarkdownOptions;
  className?: string;
}) {
  return (
    <div className={`az-prose ${className}`.trim()}>
      <Markdown text={text} options={options} />
    </div>
  );
}
