import { existsSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { isAzimuthError } from "../core/errors";
import { AGENT_ID, liveFile, readLiveMeta, readLiveRecords, transcriptPathOf } from "../core/live";
import { normalizeTranscript, readTranscriptWindow } from "../core/transcript";
import type { TranscriptPage } from "../core/types";

/** [`$CLAUDE_CONFIG_DIR/projects` when set, `<home>/.claude/projects`]. */
export function defaultTranscriptRoots(
  env: { CLAUDE_CONFIG_DIR?: string },
  home: string,
): string[] {
  return [
    ...(env.CLAUDE_CONFIG_DIR ? [join(env.CLAUDE_CONFIG_DIR, "projects")] : []),
    join(home, ".claude", "projects"),
  ];
}

export type TranscriptOutcome =
  | { status: 200; body: TranscriptPage }
  | {
      status: 400 | 403 | 404;
      body: { ok: false; error: "invalid" | "forbidden" | "not-found"; message: string };
    };

function refuse(
  status: 400 | 403 | 404,
  error: "invalid" | "forbidden" | "not-found",
  message: string,
): TranscriptOutcome {
  return { status, body: { ok: false, error, message } };
}

/**
 * The real path of a transcript that may be served: a regular `.jsonl` file under one of the
 * real `roots`. Symlinks are resolved first, so one can't point outside them.
 */
function allowedPath(path: string, roots: string[]): string | null {
  const real = realpathSync(path);
  if (!real.endsWith(".jsonl") || !statSync(real).isFile()) return null;
  const inside = roots
    .filter((r) => existsSync(r))
    .map((r) => realpathSync(r))
    .some((r) => real.startsWith(r + sep));
  return inside ? real : null;
}

/**
 * One page of a live session's transcript: checks the agent and offset, finds the recorded path
 * (readLiveMeta, readLiveRecords, transcriptPathOf), checks its real path against `roots`, reads
 * a window and normalises it with places { root, home }.
 */
export function serveTranscript(req: {
  root: string;
  claudeSession: string;
  agent: string | null;
  after: string | null;
  roots: string[];
  home: string;
}): TranscriptOutcome {
  const { root, claudeSession, agent, after } = req;
  if (agent !== null && !AGENT_ID.test(agent))
    return refuse(400, "invalid", "agent must be a subagent ID (letters, digits, _ and -).");
  if (after !== null && !/^\d+$/.test(after))
    return refuse(400, "invalid", "after must be a byte offset.");
  if (!existsSync(liveFile(root, claudeSession)))
    return refuse(404, "not-found", `No live session ${claudeSession} in this project.`);
  const records = readLiveRecords(root, claudeSession);
  if (agent !== null && !records.some((r) => "agent_id" in r && r.agent_id === agent))
    return refuse(404, "not-found", `No agent ${agent} in live session ${claudeSession}.`);
  const path = transcriptPathOf(readLiveMeta(root, claudeSession), records, agent);
  if (!path || !existsSync(path))
    return refuse(404, "not-found", "No transcript is recorded for this agent.");
  const real = allowedPath(path, req.roots);
  if (!real)
    return refuse(
      403,
      "forbidden",
      "Only .jsonl files in Claude Code's projects folders are served.",
    );
  try {
    const window = readTranscriptWindow(real, after === null ? null : Number(after));
    return {
      status: 200,
      body: {
        ok: true,
        claude_session: claudeSession,
        agent,
        entries: normalizeTranscript(window.lines, { root, home: req.home }),
        next: window.next,
        skipped: window.skipped,
      },
    };
  } catch (e) {
    if (isAzimuthError(e) && e.code === "invalid") return refuse(400, "invalid", e.message);
    throw e;
  }
}
