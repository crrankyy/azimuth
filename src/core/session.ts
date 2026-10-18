import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionIdFor } from "./allocate";
import { AzimuthError } from "./errors";
import { splitFrontmatter, updateFrontmatter } from "./frontmatter";
import { readCommits, toUtc } from "./git";
import { withLock, writeFileAtomic } from "./lock";
import { appendLive, readLiveRecords } from "./live";
import { loadProject } from "./model";
import { azPath } from "./paths";
import { fill, TEMPLATES } from "./templates";
import type { Actor } from "./types";

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

/** The current Azimuth session: explicit env, or the last one started in this Claude session. */
export function currentSession(root: string, env: SessionEnv): string | null {
  if (env.AZIMUTH_SESSION) return env.AZIMUTH_SESSION;
  const claude = claudeSessionFromEnv(env);
  if (!claude) return null;
  const records = readLiveRecords(root, claude);
  const last = [...records].reverse().find((r) => r.kind === "session");
  return last?.kind === "session" ? last.ses : null;
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

export function startSession(root: string, opts: StartOptions): string {
  const now = opts.now ?? new Date();
  return withLock(root, () => {
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
    if (opts.claudeSession) {
      appendLive(root, opts.claudeSession, { kind: "session", at: stamp(now), ses: id });
    }
    return id;
  });
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

/** Sets ended_at and collects the commits made since the session started. */
export function closeSession(root: string, id: string | null, now = new Date()): string {
  const ses = requireSession(root, id);
  return withLock(root, () => {
    const model = loadProject(root);
    const session = model.sessions.find((s) => s.id === ses);
    if (!session) throw new AzimuthError("invalid", `${ses} has errors; run \`azimuth check\`.`);
    const started = Date.parse(session.started_at);
    const end = now.getTime();
    const commits = readCommits(root, model.config.git.log_depth)
      .filter((c) => Date.parse(c.at) >= started && Date.parse(c.at) <= end)
      .reverse();
    const touched = commits.flatMap((c) => c.refs);
    const path = join(root, sessionFile(ses));
    const updated = updateFrontmatter(readFileSync(path, "utf8"), {
      ended_at: stamp(now),
      commits: [...new Set([...session.commits, ...commits.map((c) => c.sha)])],
      touched: [...new Set([...session.touched, ...touched])],
    });
    writeFileAtomic(path, updated);
    return sessionFile(ses);
  });
}

const STALE_MS = 12 * 3_600_000;

/** Closes sessions left open for more than 12 hours (e.g. a crashed agent). */
export function closeStaleSessions(root: string, now = new Date()): string[] {
  const dir = azPath(root, "sessions");
  if (!existsSync(dir)) return [];
  const stale = loadProject(root).sessions.filter(
    (s) => s.ended_at === null && now.getTime() - Date.parse(s.started_at) > STALE_MS,
  );
  return stale.map((s) =>
    closeSession(
      root,
      s.id,
      new Date(Math.min(now.getTime(), Date.parse(s.started_at) + STALE_MS)),
    ),
  );
}
