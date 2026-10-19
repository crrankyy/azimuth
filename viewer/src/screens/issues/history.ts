import type {
  Actor,
  Commit,
  Id,
  ISODate,
  ISODateTime,
  Issue,
  Markdown,
  Sha,
} from "../../../../src/core/types";
import { sectionOf } from "./model";

export type HistoryEntry =
  /** From `created` and `found_by`. */
  | { kind: "created"; at: ISODate; by: Id | "you" | "agent" }
  /** A Status notes bullet `<stamp> · <actor> · <from> → <to>: <reason>` (addStatusNote's format). */
  | { kind: "status"; at: ISODateTime; actor: Actor; from: string; to: string; reason: string }
  /** An index commit whose `refs` include the issue's ID. */
  | { kind: "commit"; at: ISODateTime; sha: Sha; subject: string }
  /** A Status notes bullet in any other shape, kept as written. */
  | { kind: "note"; at: null; text: string };

type DatedEntry = Exclude<HistoryEntry, { kind: "note" }>;

const STATUS_NOTES = /^#{1,6}\s+Status notes\s*$/i;
const MOVE_NOTE = /^(\S+) · (you|agent) · (\S+) → (\S+): (.+)$/;

/** The body without its "## Status notes" section (matched like sectionOf); the rest unchanged. */
export function bodyWithoutStatusNotes(body: Markdown): Markdown {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => STATUS_NOTES.test(l));
  if (start < 0) return body;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l));
  return [...lines.slice(0, start), ...(end < 0 ? [] : lines.slice(end))].join("\n").trimEnd();
}

/** Status notes bullets, each with its indented continuation lines joined by a space. */
function statusBullets(body: Markdown): string[] {
  const bullets: string[] = [];
  for (const line of (sectionOf(body, "Status notes") ?? "").split("\n")) {
    if (!line.trim()) continue;
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) bullets.push((item[1] ?? "").trim());
    else if (/^\s/.test(line) && bullets.length > 0)
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    else bullets.push(line.trim());
  }
  return bullets;
}

function parseBullet(text: string): HistoryEntry {
  const match = MOVE_NOTE.exec(text);
  const [, at = "", actor = "", from = "", to = "", reason = ""] = match ?? [];
  if (!match || Number.isNaN(Date.parse(at))) return { kind: "note", at: null, text };
  return { kind: "status", at, actor: actor as Actor, from, to, reason };
}

/** `created` names a day, so it counts from local midnight: a move later that day sorts after it. */
function startOfDay(date: ISODate): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

const timeOf = (e: DatedEntry) => (e.kind === "created" ? startOfDay(e.at) : Date.parse(e.at));

/**
 * Created, Status notes bullets and commits naming the issue, sorted by time (`created` as the
 * start of its day; ties keep created, notes in body order, then commits oldest first); bullets
 * that don't parse come last, in body order. A bullet's indented continuation lines join its
 * reason with a space.
 */
export function issueHistory(issue: Issue, commits: Commit[]): HistoryEntry[] {
  const notes = statusBullets(issue.body).map(parseBullet);
  const commitEntries: DatedEntry[] = commits
    .filter((c) => c.refs.includes(issue.id))
    .map((c) => ({ kind: "commit" as const, at: c.at, sha: c.sha, subject: c.subject }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const dated: DatedEntry[] = [
    { kind: "created", at: issue.created, by: issue.found_by },
    ...notes.filter((n): n is DatedEntry => n.kind !== "note"),
    ...commitEntries,
  ];
  // Array sort is stable, so equal times keep the order above.
  return [
    ...dated.sort((a, b) => timeOf(a) - timeOf(b)),
    ...notes.filter((n) => n.kind === "note"),
  ];
}
