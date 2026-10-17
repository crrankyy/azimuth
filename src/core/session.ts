import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionIdFor } from "./allocate";
import { AzimuthError } from "./errors";
import { splitFrontmatter, updateFrontmatter } from "./frontmatter";
import { readCommits, toUtc } from "./git";
import { sharedCacheDir, withLock, writeFileAtomic } from "./lock";
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
  AZIMUTH_AGENT?: string;
  CLAUDECODE?: string;
}

/** Who is running this command: an agent inside Claude Code, or you. */
export function actorFromEnv(env: SessionEnv): Actor {
  if (env.AZIMUTH_ACTOR === "you" || env.AZIMUTH_ACTOR === "agent") return env.AZIMUTH_ACTOR;
  return env.CLAUDECODE === "1" ? "agent" : "you";
}

export function liveFile(root: string, claudeSession: string): string {
  return join(sharedCacheDir(root), "live", `${claudeSession.replace(/[^\w.-]/g, "_")}.jsonl`);
}

/** The current Azimuth session: explicit env, or the last one started in this Claude session. */
export function currentSession(root: string, env: SessionEnv): string | null {
  if (env.AZIMUTH_SESSION) return env.AZIMUTH_SESSION;
  if (!env.AZIMUTH_CLAUDE_SESSION) return null;
  let text: string;
  try {
    text = readFileSync(liveFile(root, env.AZIMUTH_CLAUDE_SESSION), "utf8");
  } catch {
    return null;
  }
  const lines = text.trimEnd().split("\n").reverse();
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as { kind?: string; ses?: string | null };
      if (event.kind === "session") return event.ses ?? null;
    } catch {
      // A torn line from a concurrent writer; skip it.
    }
  }
  return null;
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

/** Appends one live event line (also used by the Claude Code hooks). */
export function appendLive(
  root: string,
  claudeSession: string,
  event: Record<string, unknown>,
): void {
  const path = liveFile(root, claudeSession);
  const line = JSON.stringify(event);
  try {
    writeFileSync(path, `${line}\n`, { flag: "a" });
  } catch {
    writeFileAtomic(path, readFileSafe(path) + `${line}\n`);
  }
}

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
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
