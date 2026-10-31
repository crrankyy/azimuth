import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionIdFor } from "./allocate";
import { loadConfig } from "./config";
import { AzimuthError } from "./errors";
import { splitFrontmatter, updateFrontmatter } from "./frontmatter";
import { readCommits, toUtc } from "./git";
import { withLock, writeFileAtomic } from "./lock";
import {
  appendLive,
  readLiveMeta,
  readLiveRecords,
  sessionsLastSeen,
  updateLiveMeta,
} from "./live";
import { loadProject } from "./model";
import { parseSession } from "./parse/records";
import { azPath } from "./paths";
import { fill, TEMPLATES } from "./templates";
import type { Actor, ISODateTime, Session } from "./types";

const stamp = (now: Date) => toUtc(now.toISOString());
const sessionFile = (id: string) => `.azimuth/sessions/${id}.md`;

export interface SessionEnv {
  AZIMUTH_ACTOR?: string;
  AZIMUTH_SESSION?: string;
  AZIMUTH_CLAUDE_SESSION?: string;
  CLAUDE_CODE_SESSION_ID?: string;
  AZIMUTH_AGENT?: string;
  CLAUDECODE?: string;
}

/** Who is running this command: an agent inside Claude Code, or you. */
export function actorFromEnv(env: SessionEnv): Actor {
  if (env.AZIMUTH_ACTOR === "you" || env.AZIMUTH_ACTOR === "agent") return env.AZIMUTH_ACTOR;
  return env.CLAUDECODE === "1" ? "agent" : "you";
}

/**
 * The Claude Code session running this command. Claude Code sets CLAUDE_CODE_SESSION_ID for Bash
 * commands itself, so this works even when our SessionStart hook didn't run (a plugin enabled
 * mid-session, or hooks that failed).
 */
export function claudeSessionFromEnv(env: SessionEnv): string | null {
  return env.AZIMUTH_CLAUDE_SESSION || env.CLAUDE_CODE_SESSION_ID || null;
}

/**
 * The Azimuth session last started in a Claude Code session: the sidecar's `ses`, else the last
 * `session` record in the live log's tail.
 */
export function sessionOfClaude(root: string, claudeSession: string): string | null {
  const meta = readLiveMeta(root, claudeSession);
  if (meta?.ses) return meta.ses;
  const records = readLiveRecords(root, claudeSession);
  const last = [...records].reverse().find((r) => r.kind === "session");
  return last?.kind === "session" ? last.ses : null;
}

/** `AZIMUTH_SESSION`, else `sessionOfClaude` for the Claude Code session in the environment. */
export function currentSession(root: string, env: SessionEnv): string | null {
  if (env.AZIMUTH_SESSION) return env.AZIMUTH_SESSION;
  const claude = claudeSessionFromEnv(env);
  return claude ? sessionOfClaude(root, claude) : null;
}

/** A session as its own file says, or null when the file is missing or has errors. */
function readSession(root: string, id: string): { text: string; session: Session } | null {
  const file = sessionFile(id);
  const path = join(root, file);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const session = parseSession(text, file).entity;
  return session ? { text, session } : null;
}

/**
 * The state of the session the CLI would use, read from its own file:
 * open: the file parses and ended_at is null;
 * closed: ended_at is set;
 * missing: .azimuth/sessions/<id>.md doesn't exist;
 * invalid: the file exists but its frontmatter doesn't parse (parseSession gives no entity).
 */
export type LinkState = "open" | "closed" | "missing" | "invalid";

export interface LinkedSession {
  /** What currentSession returned: AZIMUTH_SESSION, else the Claude Code session's link. */
  id: string;
  state: LinkState;
  /** The file's ended_at when state is "closed"; null otherwise. */
  ended_at: ISODateTime | null;
}

/**
 * The session `azimuth session note`, `handoff` and `close` use without --id, with its state:
 * currentSession(root, env), then the session's own file (readSession, no loadProject).
 * Null when currentSession returns null. Never throws for a missing or unparseable file.
 */
export function linkedSession(root: string, env: SessionEnv): LinkedSession | null {
  const id = currentSession(root, env);
  if (!id) return null;
  // readSession returns null for both; only the CLI's refusal tells them apart, so we must too.
  if (!existsSync(join(root, sessionFile(id)))) return { id, state: "missing", ended_at: null };
  const found = readSession(root, id);
  if (!found) return { id, state: "invalid", ended_at: null };
  const ended = found.session.ended_at;
  return ended === null
    ? { id, state: "open", ended_at: null }
    : { id, state: "closed", ended_at: ended };
}

/**
 * Whether a Claude Code session's own link names an open Azimuth session:
 * linkedSession(root, { AZIMUTH_CLAUDE_SESSION: claudeSession })?.state === "open".
 * AZIMUTH_SESSION plays no part.
 */
export function linkOpen(root: string, claudeSession: string): boolean {
  return linkedSession(root, { AZIMUTH_CLAUDE_SESSION: claudeSession })?.state === "open";
}

/** `- HH:MM · <text>` in UTC, on one line so that each goal or note stays one bullet. */
const bullet = (now: Date, text: string) =>
  `- ${now.toISOString().slice(11, 16)} · ${text.replace(/\s+/g, " ").trim()}`;

/** Rewrites a session file's body, keeping its frontmatter as written. */
function editBody(text: string, edit: (body: string) => string): string {
  const { yaml, body, eol } = splitFrontmatter(text);
  return `---${eol}${yaml ?? ""}${eol}---${eol}${edit(body)}`;
}

/** Adds a line at the end of a `## title` section, appending the section when it is missing. */
function appendToSection(body: string, title: string, line: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${title.toLowerCase()}`);
  if (start === -1) return `${body.replace(/\s*$/, "")}\n\n## ${title}\n${line}\n`;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  let last = end - 1;
  while (last > start && !lines[last]?.trim()) last--;
  lines.splice(last + 1, 0, line);
  return lines.join("\n");
}

function replaceSection(body: string, title: string, content: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${title.toLowerCase()}`);
  if (start === -1) return `${body.replace(/\s*$/, "")}\n\n## ${title}\n${content.trim()}\n`;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  const tail = lines.slice(end);
  return [
    ...lines.slice(0, start + 1),
    content.trim(),
    ...(tail.length ? ["", ...tail] : [""]),
  ].join("\n");
}

export interface StartOptions {
  skill: string | null;
  goal: string;
  agent?: string;
  touched?: string[];
  now?: Date;
  claudeSession?: string | null;
}

/**
 * With a Claude Code session whose Azimuth session exists and is open (ended_at null): appends
 * `- HH:MM · <skill> · <goal>` (`- HH:MM · <goal>` without a skill) to its `## Goals` section,
 * merges `touched`, and returns its ID. Otherwise creates `SES-YYYYMMDD-HHMM[-n]` as before.
 * With a Claude Code session, either way appends `{ kind: "session", at, ses }` to the live log
 * and sets the sidecar's `ses`.
 */
export function startSession(root: string, opts: StartOptions): string {
  const now = opts.now ?? new Date();
  const claude = opts.claudeSession ?? null;
  return withLock(root, () => {
    const open = claude ? openSessionOf(root, claude) : null;
    const id = open ? addGoal(root, open, opts, now) : createSession(root, opts, now);
    if (claude) {
      appendLive(root, claude, { kind: "session", at: stamp(now), ses: id });
      updateLiveMeta(root, claude, { ses: id });
    }
    return id;
  });
}

interface OpenSession {
  id: string;
  text: string;
  session: Session;
}

/** The Claude Code session's Azimuth session while it is open; a closed one is never reused. */
function openSessionOf(root: string, claudeSession: string): OpenSession | null {
  const id = sessionOfClaude(root, claudeSession);
  const found = id ? readSession(root, id) : null;
  if (!id || !found || found.session.ended_at !== null) return null;
  return { id, ...found };
}

function addGoal(root: string, open: OpenSession, opts: StartOptions, now: Date): string {
  const goal = opts.skill ? `${opts.skill} · ${opts.goal}` : opts.goal;
  let text = editBody(open.text, (body) => appendToSection(body, "Goals", bullet(now, goal)));
  if (opts.touched?.length)
    text = updateFrontmatter(text, {
      touched: [...new Set([...open.session.touched, ...opts.touched])],
    });
  writeFileAtomic(join(root, sessionFile(open.id)), text);
  return open.id;
}

function createSession(root: string, opts: StartOptions, now: Date): string {
  const id = sessionIdFor(root, now);
  let text = fill(TEMPLATES["session.md"] as string, {
    id,
    agent: opts.agent ?? "claude-code",
    skill: opts.skill ?? "null",
    now: stamp(now),
    title: opts.goal,
  });
  if (opts.touched?.length) text = updateFrontmatter(text, { touched: opts.touched });
  mkdirSync(azPath(root, "sessions"), { recursive: true });
  writeFileSync(join(root, sessionFile(id)), text, { flag: "wx" });
  return id;
}

function requireSession(root: string, id: string | null): string {
  if (!id)
    throw new AzimuthError(
      "invalid",
      "No current session. Start one with `azimuth session start` or pass --id.",
    );
  if (!existsSync(join(root, sessionFile(id))))
    throw new AzimuthError("not-found", `${id} does not exist.`);
  return id;
}

export function writeHandoff(
  root: string,
  id: string | null,
  parts: { handoff?: string; summary?: string },
): string {
  const ses = requireSession(root, id);
  return withLock(root, () => {
    const path = join(root, sessionFile(ses));
    const text = readFileSync(path, "utf8");
    const { yaml, body, eol } = splitFrontmatter(text);
    let next = body;
    if (parts.summary) next = replaceSection(next, "Summary", parts.summary);
    if (parts.handoff) next = replaceSection(next, "Handoff", parts.handoff);
    writeFileAtomic(path, `---${eol}${yaml ?? ""}${eol}---${eol}${next}`);
    return sessionFile(ses);
  });
}

/**
 * Appends `- HH:MM · <text>` (UTC; whitespace runs collapsed to one space) to the session's
 * `## Notes` section, creating the section at the end of the body. Returns the session's file.
 */
export function appendNote(
  root: string,
  id: string | null,
  text: string,
  now = new Date(),
): string {
  const ses = requireSession(root, id);
  return withLock(root, () => {
    const path = join(root, sessionFile(ses));
    const note = bullet(now, text);
    writeFileAtomic(
      path,
      editBody(readFileSync(path, "utf8"), (body) => appendToSection(body, "Notes", note)),
    );
    return sessionFile(ses);
  });
}

/** Adds IDs to a session's touched/raised lists (no-op without a session). */
export function recordInSession(
  root: string,
  id: string | null,
  add: { touched?: string[]; raised?: string[] },
): void {
  if (!id) return;
  const path = join(root, sessionFile(id));
  if (!existsSync(path)) return;
  withLock(root, () => {
    const session = loadProject(root).sessions.find((s) => s.id === id);
    if (!session) return;
    const updates: Record<string, unknown> = {};
    const merge = (current: string[], extra: string[] | undefined) => [
      ...new Set([...current, ...(extra ?? [])]),
    ];
    if (add.touched?.length) updates.touched = merge(session.touched, add.touched);
    if (add.raised?.length) updates.raised = merge(session.raised, add.raised);
    if (Object.keys(updates).length)
      writeFileAtomic(path, updateFrontmatter(readFileSync(path, "utf8"), updates));
  });
}

/**
 * Sets ended_at and collects the commits made since the start, as before, reading only this
 * session's file, the config and one `readCommits` (no loadProject), so SessionEnd can call it.
 */
export function closeSession(root: string, id: string | null, now = new Date()): string {
  const ses = requireSession(root, id);
  return withLock(root, () => {
    const found = readSession(root, ses);
    if (!found) throw new AzimuthError("invalid", `${ses} has errors; run \`azimuth check\`.`);
    const { text, session } = found;
    const started = Date.parse(session.started_at);
    const end = now.getTime();
    const commits = readCommits(root, loadConfig(root).config.git.log_depth)
      .filter((c) => Date.parse(c.at) >= started && Date.parse(c.at) <= end)
      .reverse();
    const touched = commits.flatMap((c) => c.refs);
    const path = join(root, sessionFile(ses));
    const updated = updateFrontmatter(text, {
      ended_at: stamp(now),
      commits: [...new Set([...session.commits, ...commits.map((c) => c.sha)])],
      touched: [...new Set([...session.touched, ...touched])],
    });
    writeFileAtomic(path, updated);
    return sessionFile(ses);
  });
}

/** An open session older than this is stale unless its Claude Code session is active. */
export const STALE_SESSION_MS = 12 * 3_600_000;
/** A Claude Code session whose live log was written this recently counts as active. */
export const ACTIVE_CLAUDE_MS = 3_600_000;

/**
 * Open, started more than STALE_SESSION_MS before `now`, and its Claude Code session not written
 * to within ACTIVE_CLAUDE_MS (`lastSeen` undefined counts as not active).
 */
export function sessionStale(
  session: Pick<Session, "started_at" | "ended_at">,
  now: Date,
  lastSeen: ISODateTime | undefined,
): boolean {
  if (session.ended_at !== null) return false;
  if (now.getTime() - Date.parse(session.started_at) <= STALE_SESSION_MS) return false;
  return lastSeen === undefined || now.getTime() - Date.parse(lastSeen) > ACTIVE_CLAUDE_MS;
}

/**
 * Closes every stale session (sessionStale with sessionsLastSeen(root)), ending each at
 * min(now, max(started_at + STALE_SESSION_MS, lastSeen)). Returns the closed files.
 */
export function closeStaleSessions(root: string, now = new Date()): string[] {
  const dir = azPath(root, "sessions");
  if (!existsSync(dir)) return [];
  const lastSeen = sessionsLastSeen(root);
  const stale = loadProject(root).sessions.filter((s) => sessionStale(s, now, lastSeen.get(s.id)));
  return stale.map((s) => {
    // A long session that crashed keeps the commits it made after its first 12 hours.
    const seen = lastSeen.get(s.id);
    const end = Math.max(
      Date.parse(s.started_at) + STALE_SESSION_MS,
      seen ? Date.parse(seen) : -Infinity,
    );
    return closeSession(root, s.id, new Date(Math.min(now.getTime(), end)));
  });
}
