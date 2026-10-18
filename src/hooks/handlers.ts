import { homedir } from "node:os";
import { isAbsolute, relative } from "node:path";
import { analyzeProject, buildIndex } from "../core/build-index";
import { statusBrief } from "../core/brief";
import { loadConfig } from "../core/config";
import { advance, describeEvents, userEventsSince, type Cursor } from "../core/delta";
import { toUtc } from "../core/git";
import {
  appendLive,
  launchRefs,
  pruneLive,
  readLiveRecords,
  summarizeLive,
  type LiveRecord,
} from "../core/live";
import { loadProject } from "../core/model";
import { findProjectRoot, tidyPaths, type Places } from "../core/paths";
import { claudeSessionFromEnv, type SessionEnv } from "../core/session";
import { viewerUrl } from "../server/registry";

/** What Claude Code sends a command hook on stdin (only the fields Azimuth reads). */
export interface HookInput {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  source?: string;
  reason?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  agent_id?: string;
  agent_type?: string;
  stop_hook_active?: boolean;
  tool_use_id?: string;
  tool_response?: unknown;
}

export interface HookOutput {
  stdout?: string;
  stderr?: string;
  exitCode: number;
}

export interface HookEnv {
  CLAUDE_PROJECT_DIR?: string;
  CLAUDE_ENV_FILE?: string;
  AZIMUTH_NO_VIEWER?: string;
  CLAUDE_CODE_REMOTE?: string;
  /** Claude Code's own process ID, set in hook commands. */
  CLAUDE_PID?: string;
}

export interface HookContext {
  env: HookEnv;
  now?: Date;
  /**
   * Starts the viewer if needed and returns its URL (wired by the server module). `waitMs` is how
   * long to wait for a newly started one; 0 returns at once.
   */
  ensureViewer?: (root: string, waitMs?: number) => Promise<string | null>;
  /** The plugin's own folder, hidden from live step summaries. */
  pluginDir?: string;
  /** Writes the session's environment exports (defaults to appending to CLAUDE_ENV_FILE). */
  writeEnv?: (lines: string[]) => void;
}

const OK: HookOutput = { exitCode: 0 };

/** Whether hooks may start the viewer: on in the config, and not turned off for this environment. */
export function autostartEnabled(root: string, env: HookEnv): boolean {
  return (
    loadConfig(root).config.viewer.autostart &&
    env.AZIMUTH_NO_VIEWER !== "1" &&
    env.CLAUDE_CODE_REMOTE !== "true"
  );
}

/** Claude Code's process ID from CLAUDE_PID, when it is one; the viewer stays up while it runs. */
function claudePid(env: HookEnv): { pid?: number } {
  const pid = Number(env.CLAUDE_PID);
  return Number.isInteger(pid) && pid > 0 ? { pid } : {};
}
const stamp = (now: Date) => toUtc(now.toISOString());

function projectRoot(input: HookInput, env: HookEnv): string | null {
  return findProjectRoot(env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
}

function context(event: string, text: string): HookOutput {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext: text },
    }),
  };
}

function block(reason: string): HookOutput {
  return { exitCode: 0, stdout: JSON.stringify({ decision: "block", reason }) };
}

const relTo = (root: string, file: string) =>
  isAbsolute(file) ? relative(root, file).split("\\").join("/") : file;

/** A path for display: relative inside the project, tidied (`~`, `<plugin>`) outside it. */
function displayPath(root: string, file: string, places: Omit<Places, "root">): string {
  const rel = relTo(root, file);
  return rel.startsWith("..") ? tidyPaths(file, { ...places, root }) : rel;
}

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The Agent tool (called Task in older Claude Code versions). */
const isAgentTool = (tool: string | undefined) => tool === "Agent" || tool === "Task";

/** The subagent an Agent tool call started, from its response (`agentId`). */
function spawnedAgent(response: unknown): string | null {
  const id = (response as { agentId?: unknown } | null)?.agentId;
  return typeof id === "string" && id ? id : null;
}

/** A short, secret-light description of a tool call for the live activity feed. */
export function describeTool(
  root: string,
  tool: string,
  input: Record<string, unknown> = {},
  places: Omit<Places, "root"> = { home: homedir() },
): { file: string | null; summary: string } {
  const pathOf = (input.file_path ?? input.notebook_path ?? input.path) as string | undefined;
  const file = typeof pathOf === "string" ? displayPath(root, pathOf, places) : null;
  switch (tool) {
    case "Bash":
      return {
        file: null,
        summary: clip(
          tidyPaths(
            String(input.command ?? "")
              .split("\n")[0]
              ?.replace(/\s+/g, " ")
              .trim() ?? "",
            { ...places, root },
          ),
        ),
      };
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return { file, summary: `Edited ${file ?? "a file"}` };
    case "Write":
      return { file, summary: `Wrote ${file ?? "a file"}` };
    case "Read":
      return { file, summary: `Read ${file ?? "a file"}` };
    case "Grep":
      return { file, summary: clip(`Searched for "${String(input.pattern ?? "")}"`) };
    case "Glob":
      return { file, summary: clip(`Listed ${String(input.pattern ?? "")}`) };
    case "Task":
    case "Agent":
      return {
        file: null,
        summary: clip(`Started an agent: ${String(input.description ?? input.prompt ?? "")}`),
      };
    case "WebFetch": {
      let host = "";
      try {
        host = new URL(String(input.url ?? "")).host;
      } catch {
        host = "a page";
      }
      return { file: null, summary: `Fetched ${host}` };
    }
    default:
      return { file, summary: tool };
  }
}

/** What the agent has already been told through `scope`, starting from the session start. */
/**
 * Where the scope's "since last time" begins. For prompts that is the previous prompt (or its
 * delta), even across a resume, /clear or compaction, so what you did while the session was
 * closed still reaches it; the first prompt starts from the session's first start. The wake
 * scope starts again at each start, since the next prompt reports anything older.
 */
function cursorOf(records: LiveRecord[], scope: "wake" | "prompt"): Cursor | null {
  for (const r of [...records].reverse()) {
    if (r.kind === "cursor" && r.scope === scope) return { at: r.at, keys: r.keys };
    if (scope === "prompt" && r.kind === "prompt") return { at: r.at, keys: [] };
    if (scope === "wake" && r.kind === "start") return { at: r.at, keys: [] };
  }
  const first = records.find((r) => r.kind === "start");
  return scope === "prompt" && first ? { at: first.at, keys: [] } : null;
}

function lastHandoff(root: string): string | null {
  const sessions = loadProject(root).sessions.filter((s) => s.handoff.trim());
  const latest = sessions.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
  if (!latest) return null;
  return `Last handoff (${latest.id}${latest.skill ? `, ${latest.skill}` : ""}: ${latest.goal}):\n${latest.handoff}`;
}

/**
 * For `azimuth init` run inside Claude Code: SessionStart ran before `.azimuth/` existed, so it
 * recorded nothing. Records the session's start now (with Claude Code's process ID, which keeps
 * the viewer up). Returns false outside a Claude Code session.
 */
export function recordSessionAfterInit(
  root: string,
  env: HookEnv & SessionEnv,
  now = new Date(),
): boolean {
  const id = claudeSessionFromEnv(env);
  if (!id) return false;
  appendLive(root, id, { kind: "start", at: stamp(now), source: "init", ...claudePid(env) });
  return true;
}

export async function sessionStart(input: HookInput, ctx: HookContext): Promise<HookOutput> {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id) return OK;
  const now = ctx.now ?? new Date();
  ctx.writeEnv?.([
    `export AZIMUTH_ACTOR=agent`,
    `export AZIMUTH_CLAUDE_SESSION=${JSON.stringify(id)}`,
  ]);
  pruneLive(root, now);
  appendLive(root, id, {
    kind: "start",
    at: stamp(now),
    source: input.source,
    ...claudePid(ctx.env),
  });
  const url =
    (autostartEnabled(root, ctx.env) ? await ctx.ensureViewer?.(root) : null) ?? viewerUrl(root);

  if (input.source === "compact") {
    const live = summarizeLive(id, readLiveRecords(root, id));
    const lines = ["Azimuth (context restored after compaction):"];
    if (live?.ses) lines.push(`- You are in Azimuth session ${live.ses}.`);
    if (live?.feature) {
      lines.push(
        `- You were working on ${live.task ?? live.feature}${live.task ? ` (${live.feature})` : ""}.`,
      );
      lines.push(
        `- Run \`azimuth show ${live.feature} --brief\` to reload its state before continuing.`,
      );
    } else {
      lines.push("- Run `azimuth status --brief` to reload the project state before continuing.");
    }
    return context("SessionStart", lines.join("\n"));
  }

  const { index } = buildIndex(root, { now });
  const parts = [
    "This repository is managed with Azimuth (protocol: .azimuth/PROTOCOL.md). Use the `azimuth` CLI and the /azimuth:* skills; never edit statuses by hand.",
    url ? `The Azimuth viewer is live at ${url}` : null,
    "",
    statusBrief(index, url),
  ];
  const handoff = lastHandoff(root);
  if (handoff) parts.push("", handoff);
  return context("SessionStart", parts.filter((p) => p !== null).join("\n"));
}

export function postToolUse(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id || !input.tool_name) return OK;
  const now = ctx.now ?? new Date();
  const { file, summary } = describeTool(root, input.tool_name, input.tool_input, {
    home: homedir(),
    plugin: ctx.pluginDir ?? null,
  });
  appendLive(root, id, {
    kind: "tool",
    at: stamp(now),
    tool: input.tool_name,
    file,
    summary,
    agent_id: input.agent_id ?? null,
    agent_type: input.agent_type ?? null,
    ...(isAgentTool(input.tool_name) && {
      tool_use_id: input.tool_use_id ?? null,
      spawned: spawnedAgent(input.tool_response),
    }),
  });
  // Wake the agent (asyncRewake) when you acted on what it is working on.
  const records = readLiveRecords(root, id);
  const cursor = cursorOf(records, "wake");
  if (!cursor) return OK;
  const live = summarizeLive(id, records);
  const model = loadProject(root);
  const session = live?.ses ? model.sessions.find((s) => s.id === live.ses) : undefined;
  const features = new Set([live?.feature, ...(session?.touched ?? [])].filter(Boolean));
  const events = userEventsSince(model, cursor).filter(
    (e) => e.feature !== null && features.has(e.feature),
  );
  if (events.length === 0) return OK;
  appendLive(root, id, { kind: "cursor", scope: "wake", ...advance(cursor, events) });
  return { exitCode: 2, stderr: `Azimuth: while you were working:\n${describeEvents(events)}` };
}

export function checkEdit(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const path = (input.tool_input?.file_path ?? input.tool_input?.notebook_path) as
    string | undefined;
  if (!root || typeof path !== "string") return OK;
  const file = relTo(root, path);
  if (!file.startsWith(".azimuth/") || file.startsWith(".azimuth/cache/")) return OK;
  const { problems } = analyzeProject(root, ctx.now ?? new Date());
  const errors = problems.filter((p) => p.severity === "error" && p.file === file);
  if (errors.length === 0) return OK;
  const lines = errors.map((p) => `- ${p.code}${p.line ? ` (line ${p.line})` : ""}: ${p.message}`);
  return block(
    `azimuth check found errors in ${file}:\n${lines.join("\n")}\nFix them before continuing.`,
  );
}

export async function userPromptSubmit(input: HookInput, ctx: HookContext): Promise<HookOutput> {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id) return OK;
  const now = ctx.now ?? new Date();
  const cursor = cursorOf(readLiveRecords(root, id), "prompt");
  appendLive(root, id, { kind: "prompt", at: stamp(now), ...claudePid(ctx.env) });
  // A viewer that stopped (crashed, killed, replaced by a rebuild) comes back with the next
  // prompt; it is started without waiting, so the prompt isn't held up.
  if (autostartEnabled(root, ctx.env)) await ctx.ensureViewer?.(root, 0);
  if (!cursor) return OK;
  const events = userEventsSince(loadProject(root), cursor);
  if (events.length === 0) return OK;
  appendLive(root, id, { kind: "cursor", scope: "prompt", ...advance(cursor, events) });
  return context(
    "UserPromptSubmit",
    `Azimuth: the user did this in the Azimuth viewer or CLI since your last turn (these are their own decisions):\n${describeEvents(events)}`,
  );
}

export function stop(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id) return OK;
  const now = ctx.now ?? new Date();
  const records = readLiveRecords(root, id);
  appendLive(root, id, { kind: "stop", at: stamp(now) });
  if (input.stop_hook_active) return OK;
  const touched = new Set(
    records.flatMap((r) =>
      r.kind === "tool" && r.file?.startsWith(".azimuth/") && r.tool !== "Read" ? [r.file] : [],
    ),
  );
  if (touched.size === 0) return OK;
  const { problems } = analyzeProject(root, now);
  const errors = problems.filter((p) => p.severity === "error" && touched.has(p.file));
  if (errors.length === 0) return OK;
  const lines = errors.map(
    (p) => `- ${p.file}${p.line ? `:${p.line}` : ""} ${p.code}: ${p.message}`,
  );
  return block(
    `You left Azimuth errors in files you edited:\n${lines.join("\n")}\nFix them before finishing (run \`azimuth check\`).`,
  );
}

export function sessionEnd(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id) return OK;
  appendLive(root, id, { kind: "end", at: stamp(ctx.now ?? new Date()), reason: input.reason });
  return OK;
}

/** PreToolUse for the Agent tool: records what the subagent is being asked to do. */
export function preToolUse(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id || !input.tool_use_id || !isAgentTool(input.tool_name)) return OK;
  const description = String(input.tool_input?.description ?? "").trim();
  const prompt = String(input.tool_input?.prompt ?? "");
  appendLive(root, id, {
    kind: "launch",
    at: stamp(ctx.now ?? new Date()),
    tool_use_id: input.tool_use_id,
    description: clip(description || prompt.trim().split("\n")[0] || ""),
    refs: launchRefs(description, prompt),
  });
  return OK;
}

/** SubagentStart: records the subagent so its lane appears before its first step. */
export function subagentStart(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id || !input.agent_id) return OK;
  appendLive(root, id, {
    kind: "subagent",
    at: stamp(ctx.now ?? new Date()),
    agent_id: input.agent_id,
    agent_type: input.agent_type ?? null,
  });
  return OK;
}

/** SubagentStop: records that the subagent finished. */
export function subagentStop(input: HookInput, ctx: HookContext): HookOutput {
  const root = projectRoot(input, ctx.env);
  const id = input.session_id;
  if (!root || !id || !input.agent_id) return OK;
  appendLive(root, id, {
    kind: "subagent-stop",
    at: stamp(ctx.now ?? new Date()),
    agent_id: input.agent_id,
  });
  return OK;
}

export const HOOKS: Record<
  string,
  (input: HookInput, ctx: HookContext) => HookOutput | Promise<HookOutput>
> = {
  "session-start": sessionStart,
  "post-tool-use": postToolUse,
  "check-edit": checkEdit,
  "user-prompt-submit": userPromptSubmit,
  stop,
  "session-end": sessionEnd,
  "pre-tool-use": preToolUse,
  "subagent-start": subagentStart,
  "subagent-stop": subagentStop,
};
